import OpenAI from 'openai';
import * as fs from 'fs';
import * as config from './config';
import { Instance } from "./instance";
import { ChatManager } from "./modules/chat-manager";
import { AssistantModule } from "./module";
import { TextSoundItem } from './text-to-speech';


const envKey = 'OPENAI_API_KEY_FILE';

let openai: OpenAI | undefined = undefined;

function createOpenAI(): OpenAI {

    if (!openai) {

        if (!(envKey in process.env)) {
            throw new Error('Environment variable OPENAI_API_KEY_FILE is not set.');
        }

        let fileName = process.env[envKey]!;
        let key = fs.readFileSync(fileName, 'utf8');

        openai = new OpenAI({
            apiKey: key,
        });
    }

    return openai;
}

export interface ChatTool {
    tool: OpenAI.Chat.Completions.ChatCompletionTool;
    module: AssistantModule;
}

export interface ChatQueryResult {
    result: OpenAI.Chat.Completions.ChatCompletion.Choice;
    newMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
}

export interface TaggedMessage {
    role: 'taggedMessage';
    tag: string;
    data?: any;
    message: OpenAI.Chat.Completions.ChatCompletionMessageParam;
}

export class Chat {
    
    messages: (OpenAI.Chat.Completions.ChatCompletionMessageParam | TaggedMessage)[] = [];
    tools: { [key: string]: ChatTool } = {};
    modules: { [key: string]: AssistantModule } = {};
    modulesStorage: { [key: string]: { [key: string]: any } } = {};
    initialMessage: OpenAI.Chat.Completions.ChatCompletionDeveloperMessageParam = { role: 'developer', content: '' };
    newMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    terminate: boolean = false;
    firstQuery: boolean = true;


    public addModule(module: AssistantModule) {
        this.modules[module.name] = module;
    }

    async start(): Promise<void> {
        for (let module of Object.values(this.modules)) {
            await module.onRegister();
        }
    }

    getModuleStorage<T>(module: AssistantModule): T {
        if (!(module.name in this.modulesStorage)) {
            this.modulesStorage[module.name] = {};
        }
        return this.modulesStorage[module.name] as T;
    }

    getTaggedMessagesIndex(tag: string): number[] {
        let result:number[] = [];
        for (let i = 0; i < this.messages.length; i++) {
            let message = this.messages[i];
            if (message.role === 'taggedMessage' && message.tag === tag) {
                result.push(i);
            }
        }
        return result;
    }

    getTaggedMessages(tag: string) {
        return this.messages.filter(x => x.role === 'taggedMessage' && x.tag === tag);
    }

    removeTaggedMessages(tag: string) {
        this.messages = this.messages.filter(x => x.role !== 'taggedMessage' || x.tag !== tag);
    }

    public constructor(
        public instance: Instance
    ) {
    }

    public async query(message?: string): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> {

        let openai = createOpenAI();

        if (this.firstQuery) {
            for (let module of Object.values(this.modules)) {
                await module.onBeforeFirstQuery();
            }
            this.firstQuery = false;
        }

        this.tools = {};
        let initialInstructions: string[][] = [];

        if (message) {
            this.newMessages = [{
                role: 'user',
                content: message,
            }];
        } else {
            this.newMessages = [];
        }

        for (let module of Object.values(this.modules)) {
            let items = await module.onQuery();
            if (items && items.initialMessages) {
                for (let item of items.initialMessages) {
                    let { priority, message } = item;
                    if (!initialInstructions[priority]) {
                        initialInstructions[priority] = [];
                    }
                    initialInstructions[priority].push(message);
                }
            }
            if (items && items.tools) {
                for (let tool of items.tools) {
                    this.tools[tool.function.name] = { tool, module };
                }
            }
        }

        //console.log(JSON.stringify(this.tools, null, 2));

        this.initialMessage.content = initialInstructions
            .reduce((acc, x) => (acc.push(...x), acc), [])
            .join('\n\n');

        let t = Date.now();

        console.log('================ QUERY:', JSON.stringify({
            model: 'gpt-4o',
            store: false,
            ...(config.file.chatGPT?.options as any),
            messages: [
                this.initialMessage,
                ...this.messages.map(x => x.role === 'taggedMessage' ? x.message : x),
                ...this.newMessages,
            ],
            tools: [
                ...Object.values(this.tools).map(x => x.tool)
            ],
        }, null, 2));

        let response = await openai.chat.completions.create({
            model: 'gpt-4o',
            store: false,
            ...(config.file.chatGPT?.options as any),
            messages: [
                this.initialMessage,
                ...this.messages.map(x => x.role === 'taggedMessage' ? x.message : x),
                ...this.newMessages,
            ],
            tools: [
                ...Object.values(this.tools).map(x => x.tool)
            ],
        });
        console.log(Date.now() - t, 'ms');

        return response.choices[0];
    }

    public async process(result: OpenAI.Chat.Completions.ChatCompletion.Choice): Promise<boolean> {
        console.log('================ PROCESSING:', result.message);
        let again = false;
        let messageSound: TextSoundItem | undefined = undefined;
        if (result.message.content) {
            messageSound = new TextSoundItem(addLanguages(result.message.content), false);
        }
        this.messages.push(...this.newMessages);
        this.messages.push(result.message);
        for (let call of result.message.tool_calls ?? []) {
            if (call.type !== 'function') continue;
            let { id, 'function': func } = call;
            if (!this.tools[func.name]) {
                this.instance.player.say(
                    `<speak>Asystent IA wywołał nieznaną funkcję systemową: <lang xml:lang="en-US">${func.name.substring(0, 30)}</lang></speak>`);
                continue;
            }
            let tool = this.tools[func.name];
            let res = await tool.module.onToolCall(call);
            if (typeof res === 'string') {
                this.messages.push({
                    role: 'tool',
                    tool_call_id: id,
                    content: res
                });
                again = true;
            } else if (Array.isArray(res)) {
                this.messages.push(...res);
                again = true;
            } else {
                this.messages.push({
                    role: 'tool',
                    tool_call_id: id,
                    content: res ? "OK" : "Wystąpił nieznany błąd.",
                });
                again = true;
            }
        }
        this.instance.player.play(messageSound);
        return again;
    }

}


function escape(unsafe: string) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

const languages = {
  af: 'af-ZA',
  ar: 'ar-XA',
  bg: 'bg-BG',
  bn: 'bn-IN',
  ca: 'ca-ES',
  cmn: 'cmn-CN',
  //cmn: 'cmn-TW',
  cs: 'cs-CZ',
  da: 'da-DK',
  de: 'de-DE',
  el: 'el-GR',
  //en: 'en-AU',
  //en: 'en-GB',
  //en: 'en-IN',
  en: 'en-US',
  es: 'es-ES',
  //es: 'es-US',
  eu: 'eu-ES',
  fi: 'fi-FI',
  fil: 'fil-PH',
  //fr: 'fr-CA',
  fr: 'fr-FR',
  gl: 'gl-ES',
  gu: 'gu-IN',
  he: 'he-IL',
  hi: 'hi-IN',
  hu: 'hu-HU',
  id: 'id-ID',
  is: 'is-IS',
  it: 'it-IT',
  ja: 'ja-JP',
  kn: 'kn-IN',
  ko: 'ko-KR',
  lt: 'lt-LT',
  lv: 'lv-LV',
  ml: 'ml-IN',
  mr: 'mr-IN',
  ms: 'ms-MY',
  nb: 'nb-NO',
  //nl: 'nl-BE',
  nl: 'nl-NL',
  pa: 'pa-IN',
  pl: 'pl-PL',
  //pt: 'pt-BR',
  pt: 'pt-PT',
  ro: 'ro-RO',
  ru: 'ru-RU',
  sk: 'sk-SK',
  sr: 'sr-RS',
  sv: 'sv-SE',
  ta: 'ta-IN',
  te: 'te-IN',
  th: 'th-TH',
  tr: 'tr-TR',
  uk: 'uk-UA',
  vi: 'vi-VN',
  yue: 'yue-HK',
}


function getSSMLLanguage(lang: string): string {
    return languages[lang.trim().toLowerCase()] ?? lang.trim().toLowerCase();
}

function addLanguages(text: string): string {
    let parts = text.split(/(\([a-z][a-z]\))/);
    if (parts.length === 1) {
        return text;
    }
    let result = '<speak>';
    let defaultLang = getSSMLLanguage(config.file.language);
    let lang = defaultLang;
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            result += escape(parts[i]);
        } else {
            let oldLang = lang;
            lang = getSSMLLanguage(parts[i].substring(1, 3));
            if (lang === oldLang) {
                // Nothing to do
            } else if (lang === defaultLang) {
                result += '</voice>';
            } else if (oldLang === defaultLang) {
                result += `<voice gender="female" language="${lang}">`; // female/male z konfiguracji
            } else {
                result += '</voice>';
                result += `<voice gender="female" language="${lang}">`;
            }
        }
    }
    if (lang !== defaultLang) {
        result += '</voice>';
    }
    result += '</speak>';
    console.log(result);
    return result;
}

