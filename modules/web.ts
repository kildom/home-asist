import { Chat, TaggedMessage } from "../chat";
import { Instance } from "../instance";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import * as fs from "node:fs";
import { TextSoundItem } from "../text-to-speech";
import OpenAI from "openai";
import axios from 'axios';
import { encoding_for_model } from 'tiktoken';
import { exec } from 'child_process';
import { google } from 'googleapis';
import { html2md } from "../html2md";
import path from "node:path";

const customsearch = google.customsearch('v1');

const envKey = 'GOOGLE_SEARCH_API_KEY_FILE';
let key: string | undefined = undefined;

function getKey(): string {

    if (!key) {
        if (!(envKey in process.env)) {
            throw new Error('Environment variable GOOGLE_SEARCH_API_KEY_FILE is not set.');
        }
        let fileName = process.env[envKey]!;
        key = fs.readFileSync(fileName, 'utf8');
    }

    return key;
}


const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: "function",
        function: {
            name: "search_google",
            description: "Funkcja szuka podaną frazę przy pomocy Google. Funkcja zwraca URL do strony wyszukiwania i kilka pierwszych wyników.",
            strict: true,
            parameters: {
                type: "object",
                required: [
                    "query"
                ],
                properties: {
                    query: {
                        type: "string",
                        description: "Szukana fraza"
                    }
                },
                additionalProperties: false
            },
        }
    },
    {
        type: "function",
        function: {
            name: "fetch_page",
            description: "Funkcja pobiera zawartość strony z podanego adresu URL. Jeżeli strona jest zbyt długa, zostanie skrócona zachowując istotne informacje na zadany temat.",
            strict: true,
            parameters: {
                type: "object",
                required: [
                    "url",
                    "topic",
                    "keep_links",
                ],
                properties: {
                    url: {
                        type: "string",
                        description: "Adres URL strony do pobrania"
                    },
                    topic: {
                        type: "string",
                        description: "Krótki opis tematu, dla którego strona jest pobierana"
                    },
                    keep_links: {
                        type: 'boolean',
                        description: 'Czy przy streszczaniu zachować linki w celu późniejszego pobrania podstron lub stron powiązanych'
                    },
                },
                additionalProperties: false
            },
        }
    }
];

interface ResultToChat {
    title: string,
    link: string,
    snippet: string,
}

export class Web extends AssistantModule {

    constructor(chat: Chat) {
        super(chat, 'Web');
    }

    public onQuery(): undefined | AssistantModuleQueryItems | Promise<undefined | AssistantModuleQueryItems> {

        /*let indexes = this.chat.getTaggedMessagesIndex('web-summary');

        if (indexes.length > 0) {
            let last;
            for (last = this.chat.messages.length - 1; last >= 0; last--) {
                let msg = this.chat.messages[last];
                if (msg.role === 'assistant' && !msg.tool_calls?.length) {
                    break;
                }
            }
            for (let i of indexes.filter(index => index < last)) {
                let msg = this.chat.messages[i];
                if (msg.role === 'taggedMessage') {
                    msg.message.content = msg.data;
                    msg.tag = 'web-summary-deleted';
                }
            }
        }*/

        return {
            tools,
            initialMessages: [
                {
                    priority: 30,
                    message: 'Jeżeli potrzebujesz informacji z jakiejś strony użyj funckji "fetch_page", również wtedy, gdy takie informacje już są wcześniej w rozmowie.',
                }
            ],
        };
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        if (toolCall.type === 'function' && toolCall.function.name === 'search_google') {
            return this.searchGoogle(toolCall.function.arguments);
        } else if (toolCall.type === 'function' && toolCall.function.name === 'fetch_page') {
            return this.fetchPage(toolCall);
        }
        return 'Error';
    }

    private async fetchPage(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): Promise<AssistantToolCallResult> {
        this.instance.player.say('Pobieranie strony');
        let url: string;
        let topic: string;
        let keepLinks: boolean;
        try {
            let obj = JSON.parse(toolCall.function.arguments);
            url = `${obj.url}`;
            topic = `${obj.topic}`;
            let keepLinksStr = `${obj.keep_links}`.toLowerCase();
            try {
                keepLinks = !!JSON.parse(keepLinksStr);
            } catch (e) {
                keepLinks = !keepLinksStr.match(/^([n0f]|of)/);
            }
            let html = (await axios.get(url)).data;
        } catch (e) {
            console.error(e);
            this.instance.player.say(`<speak>Błąd przetwarzania danych od asystenta: <lang xml:lang="en-US">${e.message.substring(0, 60)}</lang></speak>`);
            return `Error: ${e.message}`;
        }
        let html: string;
        try {
            html = (await axios.get(url)).data;
            if (html.length === 0) {
                html = await new Promise((resolve, reject) => {
                    let outputFile = path.resolve('data/tmp/'+this.chat.uuid);
                    exec(`wget -q -O ${outputFile} ${url}`, (error, stdout, stderr) => {
                        if (error) {
                            reject(new Error(`Error fetching URL with wget: ${error.message}`));
                            return;
                        }
                        html = fs.readFileSync(outputFile, 'utf8');
                        resolve(html);
                    });
                });
            }
        } catch (e) {
            console.error(e);
            this.instance.player.say('Błąd pobierania strony');
            return `Error: ${e.message}`;
        }
        if (!html.substring(0, 200).toLowerCase().includes('<html')) {
            fs.writeFileSync(`_debug/error-${new Date().toISOString().replace(':', '-')}.html`, html);
            this.instance.player.say('Adres nie zawiera poprawnej strony HTML');
            return `Error: It is not a valid HTML page`;
        }
        let markdown: string;
        try {
            markdown = html2md(html);
        } catch (e) {
            console.error(e);
            this.instance.player.say('Błąd przetwarzania strony');
            return `Error: ${e.message}`;
        }

        const encoder = encoding_for_model('gpt-4o-mini');
        const tokens = encoder.encode(markdown);
        const tokenCount = tokens.length;
        const tooLong = (tokenCount > 2000);
        encoder.free();

        if (tooLong) {
            this.instance.player.say('Streszczanie strony');
            let res = await this.chat.sideQuery({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'developer',
                        content: `Napisz długie streszczenie tekstu ze szczególym uwzględnieniem następującego tematu: ${topic}`,
                    },
                    {
                        role: 'user',
                        content: markdown,
                    }
                ],
            });
            markdown = res.choices[0].message.content ?? '';
            if (markdown.length < 3) {
                this.instance.player.say('Nie udało się skrócić strony');
                return 'Error: Unable to shorten the page';
            }
        }

        let messages: (OpenAI.Chat.Completions.ChatCompletionMessageParam | TaggedMessage)[] = [
            {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: markdown,
            },
            {
                role: 'developer',
                content: 'Powyżej znajduje się streszczenie strony związane z wybranym tematem. Jeżeli chcesz później ponownie skorzystać z informacji z tej strony, nie wykożystuj powyższego streszczenia, ale wywołaj funkcję "fetch_page" z parametrem "url" ustawionym na: ' + url,
            }
        ];

        if (tooLong) {
            messages[0] = {
                role: 'taggedMessage',
                tag: 'web-summary',
                data: 'Aby pobrać zawartość tej strony wywołaj ponownie funkcję "fetch_page" z aktualym tematem i parametrem url: ' + url,
                message: messages[0] as any,
            }
        }

        return messages;
    }

    private async searchGoogle(args: string): Promise<AssistantToolCallResult> {
        try {
            let query = `${JSON.parse(args).query}`;
            this.instance.player.say('Google: ' + query);
            const searchResults = await customsearch.cse.list({
                q: query,
                auth: getKey(),
                ...config.file.googleSearch,
            });
            let results: ResultToChat[] = [];
            for (let item of searchResults.data.items ?? []) {
                results.push({
                    title: item.title ?? '',
                    link: item.link ?? '',
                    snippet: item.snippet ?? '',
                });
            }
            return JSON.stringify({
                url: 'https://google.pl/search?q=' + encodeURIComponent(query),
                results,
            });
        } catch (e) {
            console.error(e);
            this.instance.player.say(`<speak>Błąd przetwarzania danych od asystenta: <lang xml:lang="en-US">${e.message.substring(0, 60)}</lang></speak>`);
            return `Error: ${e.message}`;
        }
    }
}
