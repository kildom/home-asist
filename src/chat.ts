import fs from 'node:fs';
import OpenAI from "openai";
import { Tool, Toolkit } from "./toolkit";
import { config, consts } from './config';
import { DumpObject } from './debug';
import { Phone } from './tools/phone';
import { ChatManager } from './tools/chat-manager';
import { Instance } from './instance';



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
    role: 'toolkit';
    message: OpenAI.Chat.Completions.ChatCompletionDeveloperMessageParam;
    fullTag?: string;
    priority: number;
    oldContent?: string;
}

type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam | ToolkitMessage;

interface ChatQueryResult {
    get(): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice>;
    onUpdate: ((choice: OpenAI.Chat.Completions.ChatCompletion.Choice) => void) | undefined;
}

type ProcessResult = 'repeat' | 'continue' | 'break';

export class Chat {

    private toolkits: Toolkit[] = [];
    private tools: Tool[] = [];
    private firstQuery = true;
    private messages: ChatMessage[] = [];
    private activeMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    public smarter: boolean = false;
    private dump = new DumpObject('chat');
    private active: boolean = true;

    public constructor(
        public instance: Instance,
    ) {
    }

    public addToolkit(toolkit: Toolkit): void {
        this.toolkits.push(toolkit);
    }

    public addTool(tool: Tool): void {
        this.tools.push(tool);
    }

    public setToolkitMessage(message: string | undefined | null, options?: {
        toolkit?: Toolkit;
        tag?: string;
        priority?: number;
    }): void {
        let fullTag: string | undefined = undefined;
        if (options?.toolkit || options?.tag) {
            let toolkitName = options?.toolkit?.name || '';
            let fullTag = `${toolkitName}::${options?.tag || ''}`;
            let existingMessage = this.messages.find(m => m.role === 'toolkit' && m.fullTag === fullTag) as ToolkitMessage | undefined;
            if (existingMessage) {
                existingMessage.message.content = message || '';
                return;
            }
        }
        this.messages.push({
            role: 'toolkit',
            message: {
                role: 'developer',
                content: message || '',
            },
            fullTag,
            priority: options?.priority ?? 50,
            oldContent: message || '',
        });
    }

    public start() {
        this.active = true;
        this.smarter = false;
        this.toolkits.sort((a, b) => a.name.localeCompare(b.name));
        for (let toolkit of this.toolkits) {
            toolkit.onRegister(undefined); // TODO: save storage for serialization
        }
        this.firstQuery = true;
        if (config.chatGPT.messages && config.chatGPT.messages.length > 0) {
            this.setToolkitMessage(config.chatGPT.messages.join('\n').trim(), { priority: 25 });
        }
    }

    public async query(message?: string): Promise<ChatQueryResult> {

        let openai = createOpenAI();

        if (this.firstQuery) {
            await this.prepareFirstQuery();
            this.firstQuery = false;
        }

        if (message !== undefined) {
            for (let toolkit of this.toolkits) {
                await toolkit.onQuery();
            }
        }

        let messages = this.prepareMessages(message);
        let tools = this.prepareTools();

        let body: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
            stream: true,
            messages,
            tools,
            // TODO: user: ...
            model: 'gpt-4o-mini',
            store: false,
            response_format: {
                type: 'json_schema',
                json_schema: config.chatGPT.jsonSchema,
            },
            stream_options: {
                include_usage: true,
            },

            ...(
                this.smarter
                    ? { ...config.chatGPT.standardOptions, ...config.chatGPT.smarterOptions }
                    : config.chatGPT.standardOptions
            ),
        };

        let dumpId = this.dump.dump(body, 'query');

        let requestStart = Date.now();
        let responseStream = await openai.chat.completions.create(body);
        let dumpItems: { [key: string]: any } = {};
        dumpItems[(Date.now() - requestStart).toString()] = '--- AFTER AWAIT ---';
        this.dump.dump(dumpItems, 'response', dumpId);

        let result: ChatQueryResult = {
            get: async () => {
                let usage: OpenAI.Chat.Completions.ChatCompletionChunk['usage'] | undefined = undefined;
                let toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[] = [];
                let choice: OpenAI.Chat.Completions.ChatCompletion.Choice = {
                    message: {
                        content: '',
                        role: 'assistant',
                        refusal: null,
                        tool_calls: toolCalls,
                    },
                    index: 0,
                    finish_reason: undefined as unknown as 'stop',
                    logprobs: null,
                };
                let prevEncoded = '';
                for await (let response of responseStream) {
                    // Put this response chunk into dump object
                    let t = Date.now() - requestStart;
                    while (t.toString() in dumpItems) t++;
                    let tmpEncoded = JSON.stringify({ ...response, choices: [...response.choices.map(c => ({ ...c, delta: { ...c.delta, content: '' } }))] });
                    if (prevEncoded === tmpEncoded) {
                        dumpItems[t.toString()] = response.choices[0].delta.content;
                    } else {
                        dumpItems[t.toString()] = response;
                        prevEncoded = tmpEncoded;
                    }
                    // Keep usage if present in any chunk
                    if (response.usage) {
                        usage = response.usage;
                    }
                    // Combine all choices into one
                    if (response.choices.length > 0) {
                        let c = response.choices[0];
                        if (c.logprobs) choice.logprobs = c.logprobs;
                        if (c.finish_reason) choice.finish_reason = c.finish_reason;
                        if (c.delta.content) choice.message.content += c.delta.content;
                        if (c.delta.role) choice.message.role = c.delta.role as any;
                        if (c.delta.refusal) choice.message.refusal = c.delta.refusal as any;
                        if (c.delta.tool_calls && c.delta.tool_calls.length > 0) {
                            for (let call of c.delta.tool_calls) {
                                let index = call.index;
                                if (!toolCalls[index]) {
                                    toolCalls[index] = {
                                        type: 'function',
                                        id: '',
                                        function: {
                                            name: '',
                                            arguments: '',
                                        }
                                    };
                                }
                                if (call.type) toolCalls[index].type = call.type;
                                if (call.id) toolCalls[index].id = call.id;
                                if (call.function?.name) toolCalls[index].function.name += call.function.name;
                                if (call.function?.arguments) toolCalls[index].function.arguments += call.function.arguments;
                            }
                        }
                    }
                    if (result.onUpdate) {
                        result.onUpdate(choice);
                    }
                }
                if (!choice.message.tool_calls?.length) {
                    delete choice.message.tool_calls;
                }
                if (!choice.message.content) {
                    choice.message.content = null;
                }
                // Put additional information into dump object and save to file
                dumpItems['--- USAGE ---'] = usage;
                dumpItems['--- FINAL RESULT ---'] = choice;
                this.dump.dump(dumpItems, 'response', dumpId);
                // TODO: save usage
                // Return the final result
                return choice;
            },
            onUpdate: undefined as ChatQueryResult['onUpdate'],
        };

        return result;
    }

    private prepareTools() {
        this.tools.sort((a, b) => compareToolScore(a) - compareToolScore(b));
        return this.tools
            .filter(t => !t.hidden)
            .map(t => t.tool);
    }

    private prepareMessages(message?: string): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
        let updatedMessages = this.messages.filter(m => m.role === 'toolkit' && m.oldContent !== m.message.content) as ToolkitMessage[];
        if (updatedMessages.length > 0) {
            for (let m of updatedMessages) {
                m.oldContent = m.message.content as string;
            }
            let unchangedMessages = this.messages.filter(m => !(m.role === 'toolkit' && m.oldContent !== m.message.content));
            let lastNonUserIndex = unchangedMessages.findLastIndex(m => m.role !== 'user');
            unchangedMessages.splice(lastNonUserIndex + 1, 0, ...updatedMessages);
            this.messages = unchangedMessages;
        }
        let firstNonToolkitMessage = this.messages.findIndex(m => m.role !== 'toolkit');
        if (firstNonToolkitMessage < 0) {
            firstNonToolkitMessage = this.messages.length;
        }
        let initialMessages = this.messages.slice(0, firstNonToolkitMessage) as ToolkitMessage[];
        let otherMessages = this.messages
            .slice(firstNonToolkitMessage)
            .filter(m => m.role !== 'toolkit' || m.message.content);
        initialMessages.sort((a, b) => a.priority - b.priority);
        let initialMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
            role: 'developer',
            content: initialMessages
                .map(m => m.message.content)
                .filter(m => m)
                .join('\n\n'),
        };
        let messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
        if (message) {
            this.activeMessages.push({
                role: 'user',
                content: message,
            });
        }
        messages = [
            initialMessage,
            ...otherMessages.map(m => m.role === 'toolkit' ? m.message : m),
            ...this.activeMessages,
        ];
        return messages;
    }

    public async process(choice: OpenAI.Chat.Completions.ChatCompletion.Choice): Promise<ProcessResult> {
        if (choice.finish_reason === 'length') {
            // TODO: play "Odpowiedź asystenta jest zbyt długa. Część odpowiedzi została pominięta."
        } else if (choice.finish_reason === 'content_filter') {
            // TODO: play "Odpowiedź asystenta zawiera kontrowersyje lub niebezpieczne informacje. Część lub całość odpowiedzi została pominięta."
        }
        let revertResponse = false;
        let revertQuery = false;
        let returnValues: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
        for (let call of choice.message.tool_calls ?? []) {
            if (call.type !== 'function') throw new Error('Unsupported tool call type: ' + call.type);
            let name = call.function.name;
            let argsText = call.function.arguments;
            console.log('tool:', name);
            let tool = this.tools.find(tool => tool.tool.function.name === name);
            if (!tool) {
                // TODO: say throw new Error('Unknown tool name: ' + call.function.name);
                console.error('Unknown tool name: ' + call.function.name);
                returnValues.push({
                    role: 'tool', tool_call_id: call.id, content: JSON.stringify({
                        status: 'error',
                        message: 'Unknown tool name: ' + call.function.name,
                    })
                });
                continue;
            }
            let args: any;
            if (tool.schema) {
                try {
                    args = JSON.parse(argsText);
                    args = tool.schema.parse(args);
                } catch (e) {
                    // TODO: say: Nieprawidłowe argumenty dla narzędzia: ${name}: e.message
                    console.error('Invalid arguemnt: ' + name, e);
                    returnValues.push({
                        role: 'tool', tool_call_id: call.id, content: JSON.stringify({
                            status: 'error',
                            message: 'Unknown tool name: ' + (e as Error).message,
                        })
                    });
                    continue;
                }
            } else {
                args = {};
            }
            // TODO: catch errors
            let res = await tool.callback.call(tool.toolkit, args);
            let returnContent = 'OK';
            if (typeof res === 'object') {
                if (typeof res === 'object' && 'revertType' in res && res.revertType === 'response') {
                    revertResponse = true;
                    if (res.stopProcessing) break;
                } else if (typeof res === 'object' && 'revertType' in res && res.revertType === 'query') {
                    revertQuery = true;
                    if (res.stopProcessing) break;
                } else {
                    returnContent = JSON.stringify(res);
                }
            } else {
                returnContent = res;
            }
            returnValues.push({ role: 'tool', tool_call_id: call.id, content: returnContent });
        }
        // TODO: say: response
        console.log('assistant:', choice.message.content);
        if (choice.message.content) {
            this.instance.player.assistant(choice.message.content)
        }
        if (revertQuery) {
            console.log('Reverting query');
            // Remove everything from activeMessages which is most recent user message and everything after it.
            this.activeMessages.splice(0);
            // Do not repeat query, since we need next user message at this point.
            return this.active ? 'continue' : 'break';
        } else if (revertResponse) {
            console.log('Reverting response');
            // Ignore currently processed response by forgetting about it and rerun the query to get new response.
            return 'repeat';
        } else if (returnValues.length > 0) {
            console.log('Return values: ', returnValues.length);
            // Keep currently processed response and tools return values, but rerun query to send return values to assistant.
            this.activeMessages.push(choice.message, ...returnValues);
            return 'repeat';
        } else {
            console.log('Done processing');
            // Commit active messages to chat context, not need to query again until new user message.
            this.messages.push(...this.activeMessages, choice.message);
            this.activeMessages.splice(0);
            return this.active ? 'continue' : 'break';
        }
    }

    private async prepareFirstQuery() {
        for (let toolkit of this.toolkits) {
            await toolkit.onFirstQuery();
        }
        this.tools.sort((a, b) => compareToolScoreOnStart(a) - compareToolScoreOnStart(b));
    }

    public stop() {
        this.active = false;
    }

}

async function test1() {
    let messages = [
        'Bądż mądrzejsza',
        'Podaj listę dziesięciu najpopularniejszych języków programowania.',
        // 'Wyszukaj w google jaka jest czwarta liczba pierwsza.',
        // 'Pomnóż ją przez 2.',
        // 'Wyślij tą liczbę na telefon użytkownika: Dominik.',
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
    for (let m of messages) {
        console.log('------', m.substring(0, 50));
        console.log('wait');
        for (let i = 0; i < 100; i++) chat.instance.player.effect('progress', true);
        let r = await chat.query(m);
        console.log('generate');
        let q = await r.get();
        console.log('process');
        let processResult = await chat.process(q);
        while (processResult === 'repeat') {
            console.log('repeat');
            for (let i = 0; i < 100; i++) chat.instance.player.effect('progress', true);
            let r = await chat.query();
            console.log('generate');
            let q = await r.get();
            console.log('process');
            processResult = await chat.process(q);
        }
        if (processResult === 'break') break;
        console.log('done');
    }
    new DumpObject('end').dump((chat as any).messages, 'messages');
    chat.instance.player.effect('fade-out');
    instance.player.waitForSilence();
}

test1();
