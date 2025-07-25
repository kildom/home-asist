


import * as fs from "node:fs";
import { google } from 'googleapis';
import { z } from "zod"
import { createOpenAI, Chat } from "../chat";
import { Toolkit, ToolResult } from "../toolkit";
import { html2md } from "../html2md";
import OpenAI from "openai";

interface SearchResult {
    title: string;
    link: string;
    snippet: string;
    response?: string;
}

interface WebSearchOptions {
    query: string;
    instructions?: string;
    input: OpenAI.Responses.ResponseInput;
    model: OpenAI.ResponsesModel;
    pages: number;
};

let openai = createOpenAI();

const googleSearchOptions = { // TODO: move to config
    // https://developers.google.com/custom-search/v1/reference/rest/v1/cse/list
    cx: '82bdeb1d5a7a545ac',
    hl: 'pl',
    gl: 'pl',
    filter: '1',
    safe: 'active',
};

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

async function googleSearch(query: string) {
    const searchResults = await customsearch.cse.list({
        q: query,
        auth: getKey(),
        ...googleSearchOptions,
    });
    let results: SearchResult[] = [];
    for (let item of searchResults.data.items ?? []) {
        results.push({
            title: item.title ?? '',
            link: item.link ?? '',
            snippet: item.snippet ?? '',
        });
    }
    console.log(`Found with Google ${results.length} results.`);
    return results;
}

async function sortResults(results: SearchResult[], options: WebSearchOptions) {

    let message = 'Oto kilka wyników wyszukiwania Google. Wybierz te, które mogą być potrzebne do odpowiedzenia na powyższe zapytanie. '
        + 'Odpowiedz tablicą w formacie JSON zawierającą numery wybranych wyników.\n\n';

    let index = 1;
    for (let result of results) {
        message += `# ${index}. ${result.title}\n`;
        message += `Link: ${result.link}\n`;
        message += `${result.snippet}\n\n`;
        index++;
    }

    let response = await openai.responses.create({
        model: options.model,
        input: [
            ...options.input,
            {
                role: 'user',
                content: message,
            }
        ],
        instructions: options.instructions,
        store: false,
        text: {
            format: {
                type: 'json_object',
            }
        }
    });

    let list = new Array<number>(options.pages).map((_, i) => i + 1);
    try {
        let obj = JSON.parse(response.output_text);
        let arr: any[] = list;
        if (Array.isArray(obj)) {
            arr = obj;
        } else if (typeof obj === 'object') {
            for (let key in obj) {
                if (Array.isArray(obj[key])) {
                    arr = obj[key];
                    break;
                }
            }
        }
        let num = new Set<number>(arr.map(x => parseInt(x)).filter(x => (x > 0 && x <= results.length)));
        for (let i = 1; i <= results.length && num.size < options.pages; i++) {
            num.add(i);
        }
        list = [...num];
    } catch (e) { }

    list.sort();

    for (let i = 1; i <= results.length; i++) {
        if (!list.includes(i)) {
            list.push(i);
        }
    }

    return list.map(x => results[x - 1]);
}


async function generateSummary(input: SearchResult, options: WebSearchOptions): Promise<SearchResult> {
    let htmlResponse = await fetch(input.link);
    let html = await htmlResponse.text();
    let markdown = html2md(html);

    let message = 'Oto treść strony internetowej. Na jej podstawie odpowiedz na powyższe zapytanie. '
        + 'Wyciągnij jak najwięcej informacji, które mogą być przydatne.\n\n';

    message += `# ${input.title}\n\n`;
    message += `Address: ${input.link}\n\n`;
    message += markdown;

    let response = await openai.responses.create({
        model: message.length > 8000 ? 'gpt-4o-mini' : options.model, // TODO: calculate all input tokens and use model from config.
        input: [
            ...options.input,
            {
                role: 'user',
                content: message,
            }
        ],
        instructions: options.instructions,
        store: false,
    });

    console.log(`Summary of ${input.link} generated.`);
    console.log(`    html ${html.length}, markdown ${markdown.length}, summary ${response.output_text.length}`);

    return {
        ...input,
        response: response.output_text,
    }

}

async function generateFinalMessage(inputs: SearchResult[], options: WebSearchOptions): Promise<string> {

    let message = 'Oto treść kilku stron internetowych. Na jej podstawie odpowiedz na powyższe zapytanie. '
        + 'Wyciągnij jak najwięcej informacji, które mogą być przydatne.\n\n';

    for (let input of inputs) {
        message += `# ${input.link}\n\n`;
        message += `## ${input.title}\n\n`;
        message += input.response!.replace(/^(\s*)(#+\s)/gm, '$1#$2').trim() + '\n\n';
    }

    let response = await openai.responses.create({
        model: message.length > 8000 ? 'gpt-4o-mini' : options.model, // TODO: calculate all input tokens and use model from config.
        input: [
            ...options.input,
            {
                role: 'user',
                content: message.trim(),
            }
        ],
        store: false,
    });

    console.log(`Final message generated.`);
    console.log(`    input ${message.length}, result ${response.output_text.length}`);

    return response.output_text;
}

async function doWebSearch(options: WebSearchOptions): Promise<string> {

    let results = await googleSearch(options.query);
    results = await sortResults(results, options);

    let processedResults: SearchResult[] = [];
    /*let promises = new Set<Promise<void>>;
    mainLoop:
    for (let i = 0; i < results.length; i++) {
        while (promises.size + processedResults.length >= options.pages) {
            if (processedResults.length >= options.pages) {
                break mainLoop;
            }
            let promise = promises.values().next().value;
            promises.delete(promise!);
            await promise;
        }
        let promise = generateSummary(results[i], options)
            .then(r => {
                if (r) {
                    processedResults.push(r);
                }
            })
            .catch(e => {
                console.error('Error processing result:', e);
            })
            .finally(() => {
                promises.delete(promise!);
            });
        promises.add(promise);
    }*/

    for (let i = 0; i < results.length && processedResults.length < options.pages; i++) {
        try {
            let r = await generateSummary(results[i], options)
            if (r) {
                processedResults.push(r);
            }
        } catch (e) {
            console.error('Error processing result:', e);
        }
    }
    let message = await generateFinalMessage(processedResults, options);

    return message;
}


export const search_google = z.object({
    query: z.string(),
    search_context_size: z.enum(['low', 'medium', 'high']).optional(),
}).describe('function search_google');


export class Web extends Toolkit {

    public constructor(chat: Chat) {
        super(chat, 'web');
    }

    public onRegister(): null {
        this.addTool(search_google, this.searchGoogle);
        return null;
    }

    private async searchGoogle({ query, search_context_size }: z.infer<typeof search_google>): Promise<ToolResult> {
        let pages = 3;
        switch (search_context_size) {
            case 'low':
                this.player.system('Szybkie wyszukiwanie w internecie: ');
                pages = 2;
                break;
            case 'medium':
                this.player.system('Zwykłe wyszukiwanie w internecie: ');
                pages = 2;
                break;
            case 'high':
                this.player.system('Dokładne wyszukiwanie w internecie: ');
                pages = 10
                break;
        }
        this.player.system(query);
        let obj = this.chat.prepareMessages(false);
        return await doWebSearch({
            input: obj.messages,
            query: query,
            model: this.chat.getCurrentModel(),
            instructions: 'Pełnij rolę asystenta, który wyszujuje informacje w internecie.', // TODO: Different instructions than obj.instructions,
            pages,
        })
    }
}


async function test1() {

    //const userQuery = 'Podaj trzy pizze z pizzerii Paolo w Cholerzynie, które zawierają szynkę. Podaj składniki pizzy i cenę. Wyślij numer telefonu do nich na mój telefon.';
    //const googleQuery = 'pizzeria Paolo Cholerzyn menu szynka';
    //const userQuery = 'Jaki jest numer telefonu do oddziału chirugi ogólnej szpitalu w proszowicach? Podaj mi adres strony internetowej, gdzie mogę go znaleźć.';
    //const googleQuery = 'szpital w proszowicach chirurgia ogólna telefon';
    const userQuery = 'Kiedy jest druga tura wyborów prezydenckich w Polsce?';
    const googleQuery = 'druga tura wyborów prezydenckich 2025 Polska';
    //const userQuery = 'Ile dzieci ma Lech Wałęsa?';
    //const googleQuery = 'dzieci Lech Wałęsa';
    //const userQuery = 'Jakie są funkcje biblioteki kongresu w USA?';
    //const googleQuery = 'biblioteki kongresu USA';
    //const userQuery = 'Jaki długi jest dziób flaminga?';
    //const googleQuery = 'flaming dziób długość';

    let result = await doWebSearch({
        input: [{ type: 'message', role: 'user', content: userQuery }],
        query: googleQuery,
        model: 'gpt-4o-mini',
        instructions: 'Pełnij rolę asystenta, który odpowiada na pytania użytkownika.',
        pages: 3,
    });

    console.log(result);
}

if (process.argv.includes('--test-web')) {
    test1();
}
