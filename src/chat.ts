import fs from 'node:fs';
import OpenAI from "openai";
import { RevertFlags, Tool, Toolkit } from "./toolkit";
import { config, consts } from './config';
import { DumpObject, ProgressiveDump } from './debug';
import { Phone } from './tools/phone';
import { ChatManager } from './tools/chat-manager';
import { Instance } from './instance';
import { type } from 'node:os';

/*
 * 
 * - Chat context from before query() call including messages from toolkits even recently added or updated.
 * - Query message from user.
 * - Response with function call.
 * - Function call result.
 * - Response with function call.
 * - Function call result.
 * - ...
 * - Response without function call.
 */

type ProgressCallback = (progress: 'starting' | 'querying' | 'waiting' | 'receiving' | 'processing' | 'done' | 'error') => void | Promise<void>;

let openai: OpenAI | undefined = undefined;

function createOpenAI(): OpenAI {

    if (!openai) {

        if (!(consts.openAIEnvKey in process.env)) {
            throw new Error(`Environment variable ${consts.openAIEnvKey} is not set.`);
        }

        let fileName = process.env[consts.openAIEnvKey]!;
        let key = fs.readFileSync(fileName, 'utf8');

        openai = new OpenAI({
            apiKey: key,
        });
    }

    return openai;
}

function compareToolScoreOnStart(tool: Tool) {
    return (tool.hidden ? 2 : 0) + (tool.dynamic ? 1 : 0);
}

function compareToolScore(tool: Tool) {
    return tool.hidden ? 2 : 0;
}

interface ToolkitMessage {
    type: 'Toolkit';
    message: OpenAI.Responses.EasyInputMessage;
    fullTag?: string;
    priority: number;
    oldContent?: string;
}

interface InputOutputItem {
    index: number;
    output: OpenAI.Responses.ResponseOutputItem;
    input: (OpenAI.Responses.ResponseInputItem | undefined);
    tool: Tool | undefined;
}

type ChatMessage = OpenAI.Responses.ResponseInputItem | ToolkitMessage;

interface ChatQueryResult {
    get(): Promise<OpenAI.Responses.Response>;
    onUpdate: ((response: OpenAI.Responses.Response) => void) | undefined;
}

type ProcessResult = 'repeat' | 'continue' | 'break';

export class Chat {

    private toolkits: Toolkit[] = [];
    private tools: Tool[] = [];
    private messages: ChatMessage[] = [];
    private activeQueryMessage: OpenAI.Responses.EasyInputMessage = { content: '', role: 'user', type: 'message' };
    private activeMessages: OpenAI.Responses.ResponseInputItem[] = [];
    public smarter: boolean = false;
    private dump = new DumpObject('chat');
    private active: boolean = true;
    private firstQuery: boolean = true;
    private enableWebSearch: boolean = false;

    /** Report progress of the query. You can throw an error to abort the query until first 'processing'.
     * Throwing an error after first 'processing' will put chat in undefined state.
     */
    public onProgress: ProgressCallback | undefined = undefined;

    public constructor(
        public instance: Instance,
    ) {
        createOpenAI();
    }

    /** Add toolkit to the chat.
     */
    public addToolkit(toolkit: Toolkit): void {
        this.toolkits.push(toolkit);
    }

    /** Add a tool. This is used by the toolkit to register a tool.
     * @param tool - The tool to add.
     */
    public addTool(tool: Tool): void {
        this.tools.push(tool);
    }

    /** Set or add a developer message.
     *
     * It will be added at the end of the chat. The message can be changed later if `toolkit` and `tag` are provided.
     * Updated message will be moved to the end of the chat. If message is empty, it will be removed.
     *
     * Starting messages will be concatenated and used as instructions for the assistant.
     */
    public setToolkitMessage(message: string | undefined | null, options?: {
        toolkit?: Toolkit;
        tag?: string;
        priority?: number;
    }): void {
        let fullTag: string | undefined = undefined;
        if (options?.toolkit || options?.tag) {
            let toolkitName = options?.toolkit?.name || '';
            fullTag = `${toolkitName}::${options?.tag || ''}`;
            let existingMessage = this.messages.find(m => m.type === 'Toolkit' && m.fullTag === fullTag) as ToolkitMessage | undefined;
            if (existingMessage) {
                existingMessage.message.content = message || '';
                return;
            }
        }
        this.messages.push({
            type: 'Toolkit',
            message: {
                type: 'message',
                role: 'developer',
                content: message || '',
            },
            fullTag,
            priority: options?.priority ?? 50,
            oldContent: message || '',
        });
    }

    /** Start the chat session.
     */
    public start() {
        this.active = true;
        this.smarter = false;
        this.toolkits.sort((a, b) => a.name.localeCompare(b.name));
        for (let toolkit of this.toolkits) {
            toolkit.onRegister(undefined); // TODO: save storage for serialization
        }
        if (config.chatGPT.messages && config.chatGPT.messages.length > 0) {
            this.setToolkitMessage(config.chatGPT.messages.join('\n').trim(), { priority: 25 });
        }
    }

    /** Prepares tools for the query based on tools provided by toolkits.
     *
     * @returns array of tools that can be passed to OpenAI API.
     */
    private prepareTools() {
        this.tools.sort((a, b) => compareToolScore(a) - compareToolScore(b));
        let tools: OpenAI.Responses.Tool[] = this.tools
            .filter(t => !t.hidden)
            .map(t => t.tool);
        if (this.enableWebSearch) {
            tools?.unshift({
                type: "web_search_preview",
                user_location: {
                    type: 'approximate',
                    ...config.chatGPT.webUserLocation,
                },
                search_context_size: 'high',
            });
        }
        return tools;
    }

    /** Prepares messages for the query based on current chat context and messages provided by toolkits.
     * 
     * @returns array of messages that can be passed to OpenAI API.
     */
    private prepareMessages(): { messages: OpenAI.Responses.ResponseInputItem[], instructions: string } {
        // Move updated messages just before last user message
        let updatedMessages = this.messages.filter(m => m.type === 'Toolkit' && m.oldContent !== m.message.content) as ToolkitMessage[];
        if (updatedMessages.length > 0) {
            let unchangedMessages = this.messages.filter(m => !(m.type === 'Toolkit' && m.oldContent !== m.message.content));
            for (let m of updatedMessages) {
                m.oldContent = m.message.content as string;
            }
            let lastNonUserIndex = unchangedMessages.findLastIndex(m => m.type !== 'message' || m.role !== 'user');
            unchangedMessages.splice(lastNonUserIndex + 1, 0, ...updatedMessages);
            this.messages = unchangedMessages;
        }
        // Get starting toolkit messages and user it as instructions message
        let firstNonToolkitMessage = this.messages.findIndex(m => m.type !== 'Toolkit');
        if (firstNonToolkitMessage < 0) {
            firstNonToolkitMessage = this.messages.length;
        }
        let initialMessages = this.messages.slice(0, firstNonToolkitMessage) as ToolkitMessage[];
        let otherMessages = this.messages
            .slice(firstNonToolkitMessage)
            .filter(m => m.type !== 'Toolkit' || m.message.content);
        initialMessages.sort((a, b) => a.priority - b.priority);
        let instructions = initialMessages
            .map(m => m.message.content)
            .filter(m => m)
            .join('\n\n')
            .trim();
        let messages: OpenAI.Responses.ResponseInputItem[] = [
            ...otherMessages.map(m => m.type === 'Toolkit' ? m.message : m),
            this.activeQueryMessage,
            ...this.activeMessages,
        ];
        return { messages, instructions };
    }

    private async prepareFirstQuery() {
        for (let toolkit of this.toolkits) {
            await toolkit.onFirstQuery();
        }
        this.tools.sort((a, b) => compareToolScoreOnStart(a) - compareToolScoreOnStart(b));
    }

    public async query(message: string): Promise<boolean> {

        await this.onProgress?.('starting');

        this.activeQueryMessage = {
            type: 'message',
            role: 'user',
            content: message,
        };
        this.activeMessages = [];

        if (this.firstQuery) {
            await this.prepareFirstQuery();
            this.firstQuery = false;
        }

        try {
            for (let toolkit of this.toolkits) {
                await toolkit.onQuery();
            }

            for (let i = 0; i < 10; i++) {
                await this.onProgress?.('querying');
                let response = await this.getResponse();
                await this.onProgress?.('processing');
                let continueProcessing = await this.processResponse(response);
                if (!continueProcessing) {
                    break;
                } else if (i === 10 - 1) { // TODO: config number of cycles
                    throw new Error('Too many request-response cycles.');
                }
            }

            this.onProgress?.('done');

        } catch (e) {
            for (let toolkit of this.toolkits) {
                try {
                    await toolkit.onAbort();
                } catch (e) {
                    console.error('Error during toolkit onAbort:', e);
                    this.instance.player.system('Wystąpił błąd podczas przetwarzania odpowiedzi.');
                }
            }
            this.onProgress?.('error');
            throw e;
        }

        return this.active;
    }

    private async getResponse(): Promise<OpenAI.Responses.Response> {

        let { messages, instructions } = this.prepareMessages();
        let tools = this.prepareTools();

        let requestBody: OpenAI.Responses.ResponseCreateParamsStreaming = {
            stream: true,
            instructions,
            input: messages,
            tools,
            // TODO: user: ...
            model: 'gpt-4.1',
            store: false,
            text: {
                format: {
                    type: 'json_schema',
                    ...config.chatGPT.jsonSchema,
                }
            },
            ...config.chatGPT.standardOptions,
            ...(this.smarter ? { ...config.chatGPT.smarterOptions } : null),
        };

        this.dump.dump(requestBody, 'request');
        let streamDump = this.dump.progressive('stream');

        const responseStream = await openai!.responses.create(requestBody);
        let responseDone = false;

        try {
            await this.onProgress?.('waiting');

            let prevEncoded = '';
            for await (let event of responseStream) {
                if (prevEncoded === '') {
                    await this.onProgress?.('receiving');
                }
                // Dump response
                let tmpEncoded = JSON.stringify({ ...event, delta: undefined });
                if (prevEncoded === tmpEncoded) {
                    streamDump.dump((event as any).delta ?? '[[REPEATED]]')
                } else {
                    streamDump.dump(event);
                    prevEncoded = tmpEncoded;
                }
                if (event.type.startsWith('response.web_search_call')) {
                    this.instance.player.system('Przeszukiwanie internetu');
                    for (let i = 0; i < 100; i++) this.instance.player.effect('progress', true);
                } else if (event.type === 'error') {
                    throw new Error(event.message);
                } else if (event.type === 'response.completed') {
                    // TODO: count usage
                    this.dump.dump(event.response.output, 'response');
                    for (let item of event.response.output) {
                        delete item.id;
                    }
                    return event.response;
                } else if (event.type === 'response.failed') {
                    throw new Error(event.response.error?.message);
                }
            }
            responseDone = true;

        } finally {
            try {
                if (!responseDone) {
                    responseStream.controller.abort();
                }
            } catch (e) { }
        }
        throw new Error('Response stream ended without completion');
    }

    async processResponse(response: OpenAI.Responses.Response): Promise<boolean> {

        if (response.incomplete_details?.reason === 'max_output_tokens') {
            // TODO: play "Odpowiedź asystenta jest zbyt długa. Część odpowiedzi została pominięta."
        } else if (response.incomplete_details?.reason === 'content_filter') {
            // TODO: play "Odpowiedź asystenta zawiera kontrowersyje lub niebezpieczne informacje. Część lub całość odpowiedzi została pominięta."
        } else if (response.incomplete_details?.reason) {
            // TODO: Play "Odpowiedź asystenta nie została przetworzona z powodu: ${response.incomplete_details.reason}"
        }

        let revertFlags: RevertFlags = RevertFlags.None;

        this.activeMessages.push(...response.output);

        let items: InputOutputItem[] = response.output.map((item, i) => ({
            index: i,
            output: item,
            input: undefined as (OpenAI.Responses.ResponseInputItem | undefined),
            tool: item.type === 'function_call'
                ? (this.tools.find(tool => tool.tool.name === item.name)
                    ?? this.tools.find(tool => tool.tool.name === 'fallback_function'))
                : undefined,
        }));

        items.sort((a, b) => (b.tool?.priority ?? 0) - (a.tool?.priority ?? 0));

        for (let item of items) {
            switch (item.output.type) {
                case 'message':
                    this.readMessage(item.output.content);
                    break;
                case 'web_search_call':
                case 'reasoning':
                    // Nothing to do here
                    break;
                case 'function_call':
                    revertFlags |= await this.callTool(item);
                    break;
                default:
                    throw new Error('Unsupported message type: ' + item.output.type);
            }
            if (revertFlags & RevertFlags.StopProcessing) {
                break;
            }
        }
        if (revertFlags & RevertFlags.Query) {
            // Stop processing without committing any messages to the chat context.
            // It will restore chat to state from before query() call.
            this.activeMessages.splice(0);
            return false;
        } else if (revertFlags & RevertFlags.Response) {
            // Remove all active messages, but continue processing.
            // It will restart everything from the last user message.
            this.activeMessages.splice(0);
            return true;
        }

        items.sort((a, b) => a.index - b.index);

        let inputs = items
            .filter(item => item.input)
            .map(item => item.input!);

        if (inputs.length > 0) {
            // We need to rerun the query since we have to update the assistant with new data.
            this.activeMessages.push(...inputs);
            return true;
        } else {
            // The query is done, we can commit the messages to the chat context and stop processing.
            this.messages.push(
                this.activeQueryMessage, ...this.activeMessages);
            return false;
        }
    }

    private async callTool(item: InputOutputItem): Promise<RevertFlags> {
        let tool = item.tool;
        let output = item.output;
        if (!tool || output.type !== 'function_call') {
            return RevertFlags.None;
        }
        let args: any;
        if (tool.schema) {
            try {
                args = JSON.parse(output.arguments);
                args = tool.schema.parse(args);
            } catch (e) {
                // TODO: say: Nieprawidłowe argumenty dla narzędzia: ${name}: e.message
                console.error('Invalid argument: ' + output.name, e);
                item.input = {
                    type: 'function_call_output',
                    call_id: output.call_id,
                    output: JSON.stringify({
                        status: 'error',
                        message: 'Invalid arguments: ' + ((e as any)?.message ?? 'Unknown error'),
                    }),
                };
                return RevertFlags.None;
            }
        } else {
            args = {};
        }
        // TODO: catch errors
        let res = await tool.callback.call(tool.toolkit, args);
        let returnContent = 'OK';
        if (typeof res === 'number') {
            return res;
        } else if (typeof res === 'object') {
            returnContent = JSON.stringify(res);
        } else if (typeof res === 'string') {
            returnContent = res;
        }
        item.input = {
            type: 'function_call_output',
            call_id: output.call_id,
            output: returnContent,
        };
        return RevertFlags.None;
    }

    private readMessage(content: (OpenAI.Responses.ResponseOutputText | OpenAI.Responses.ResponseOutputRefusal)[]) {
        let fullText = '';
        for (let text of content) {
            switch (text.type) {
                case 'output_text':
                    fullText += text.text;
                    break;
                case 'refusal':
                    this.instance.player.system('Asystent odmówił odpowiedzi');
                    this.instance.player.system('{{en}} ' + text.refusal, false);
                    break;
            }
        }
        if (fullText) {
            try {
                console.error(JSON.parse(fullText).ssml);
            } catch (e) {
                console.error(fullText);
            }
            this.instance.player.assistant(fullText);
        }
    }


    /*
    
     */

    //////////////////////////////////////////////////////////////////////////////////////////

    public stop() {
        this.active = false;
    }

}

async function test1() {
    let messages = [
        // 'Podaj trzy pizze z pizzeri paolo w cholerzynie zawierające szynkę.',
        // 'Spradź w internecie i podaj listę dziesięciu najpopularniejszych języków programowania aktualnie.',
        // 'Spradź w internecie, kiedy są najbliższe wybory prezydenckie w Polsce?',
        // 'Podaj listę dziesięciu najpopularniejszych języków programowania.',
        // 'Wyszukaj w google jaka jest czwarta liczba pierwsza. Odpowiedz w języku japońskim.',
        'Bądź mądrzejsza',
        'Jaka jest czwarta liczba pierwsza.',
        'Pomnóż ją przez 2.',
        'Wyślij mi tą liczbę na telefon.',
        // 'Bądź mądrzejsza i Mój numer telefonu to +48 234 12 12 33.',
        // 'Wyślij wiadomość z tym numerem na telefonu do mnie, czyli Dominik.',
        // 'Bądź głupsza',
        // 'Jak masz na imię?',
        // 'Do widzenia',
        // 'Bądż mądrzejsza, a następnie wyślij wiadomość z aktualną datą i czasem na telefon użytkownika: Dominik.',
        // 'Wyślij wiadomość z aktualną datą i czasem na telefon użytkownika: Dominik.',
        // 'Do widzenia',
        // 'Jak masz na imię?',
        // 'Bądż mądrzejsza i powiedz jaka jest dziesiąta liczba pierwsza.',
        // 'Jaka jest dziesiąta liczba pierwsza.',
        // 'Przetłumacz na japoński zdanie: mama ma kota.',
        // 'A teraz na angielski.',
        // 'A teraz na hebrajski.',
        // 'Powiedz to jeszcze raz ale znacznie wolniej',
        // 'Oznacz tą rozmowę w celu debugowania.',
        // 'Podaj kod w Python\'ie, który oblicza sumę liczb od 1 do 100.',
        // 'oznacz tą rozmowę z opiem kod został nieprawidłowo odczytany',
        // 'Bądź mądrzejsza i opowiedz jakąś zabawną historyjkę.',
    ]
    let instance = new Instance();
    let chat = new Chat(instance);
    new Phone(chat);
    new ChatManager(chat);
    chat.start();
    chat.onProgress = progress => console.log('progress', progress);
    for (let m of messages) {
        console.log('------', m.substring(0, 50));
        console.log('wait');
        for (let i = 0; i < 100; i++) chat.instance.player.effect('progress', true);
        let active = await chat.query(m);
        if (!active) break;
        console.log('done');
    }
    new DumpObject('end').dump((chat as any).messages, 'messages');
    chat.instance.player.effect('fade-out');
    instance.player.waitForSilence();
}

async function test2() {
    let openai = createOpenAI();
    const responseStream = await openai.responses.create({
        //"stream": true,
        "instructions": "Pełnij funkcję inteligentego domu o imieniu Zefira. Używaj formy damskiej w stosunku do siebie.\nWszystkie odpowiedzi podawaj w formacie SSML. Jeżeli używasz język na inny niż polski,\ndodaj odpowiednie znaczniki SSML `<lang>`. Jeżeli użytkownik poprosi, żebyś mówiła wolniej lub szybciej,\ndadaj odpowiednie znaczniki SSML `<prosody>`.\n\nTwoje odpowiedzi będą wysłuchiwane, a nie odczytywane. Odpowiadaj tak, aby łatwo dało się słuchać twoich wypowiedzi.\nNie generuj zbyt długich wypowiedzi.\n\nUdzielaj odpowiedzi tak, jakbyś mówiła, a nie pisała. Liczby i wzory matematyczne zapisuj słownie.\nTo nie dotyczy argumentów funkcji i narzędzi.\nWiadomości od użytkownika pochodzą z systemu rozpoznawania mowy. Mogą zawierać błędy interpunkcyjne.\nMogą zawieraz znaki interpunkcyjne zapisane słownie.\n\nAktualna data i czas: 2025-05-20T12:41:50, wtorek",
        "input": [
            {
                "type": "message",
                "role": "user",
                "content": "Kiedy są najbliższe wybory prezydenckie w Polsce?"
            }
        ],
        "tools": [
            {
                "type": "web_search_preview",
                "user_location": {
                    "type": "approximate",
                    "city": "Kraków",
                    "country": "PL",
                    "region": "Małopolskie",
                    "timezone": "CET"
                }
            },
        ],
        "model": "gpt-4o",
        "store": false,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "ssml_response",
                "schema": {
                    "type": "object",
                    "properties": {
                        "ssml": {
                            "type": "string",
                            "description": "The assistant's response formatted in SSML."
                        }
                    },
                    "required": [
                        "ssml"
                    ],
                    "additionalProperties": false
                },
                "strict": true
            }
        }
    }/* || {
        stream: true,
        model: "gpt-4.1",
        tools: [{ type: "web_search_preview" }],
        input: 'Spradź w internecie, kiedy są najbliższe wybory prezydenckie w Polsce?',
    }*/);
    console.log(JSON.stringify(responseStream, null, 2));
    /*for await (const event of responseStream) {
        switch (event.type) {
            case 'error':
                console.error('Error:', event.message);
                break;
            case 'response.completed':
                console.log('Response completed:', event.response);
                break;
            case 'response.web_search_call.in_progress':
                break;
        }
        console.log(JSON.stringify(event, null, 2));
    }*/
}

if (process.argv.includes('--test-chat')) {
    test1();
    //test2();
}

