import { Chat } from "../chat";
import { Instance } from "../instance";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import * as fs from "node:fs";
import { TextSoundItem } from "../text-to-speech";
import OpenAI from "openai";

import { google } from 'googleapis';

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
    }/*,
    {
        type: "function",
        function: {
            name: "fetch_page",
            strict: true,
            parameters: {
                type: "object",
                required: [
                    "url",
                    "topic"
                ],
                properties: {
                    url: {
                        type: "string",
                        description: "Adres URL strony do pobrania"
                    },
                    topic: {
                        type: "string",
                        description: "Krótki opis tematu, dla którego strona jest pobierana"
                    }
                },
                additionalProperties: false
            },
            description: "Funkcja pobiera zawartość strony z podanego adresu URL. Jeżeli strona jest zbyt długa, zostanie skrócona zachowując istotne informacje na zadany temat."
        }
    }*/
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
        return { tools };
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        if (toolCall.type === 'function' && toolCall.function.name === 'search_google') {
            return this.searchGoogle(toolCall.function.arguments);
        }
        return 'Error';
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
