import { Chat } from "../chat";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import { TextSoundItem } from "../text-to-speech";
import OpenAI from "openai";


export class ChatManager extends AssistantModule {


    constructor(chat: Chat) {
        super(chat, 'Chat Manager');
    }

    public onQuery(): undefined | AssistantModuleQueryItems | Promise<undefined | AssistantModuleQueryItems> {
        let items: AssistantModuleQueryItems = {
            tools: [{
                type: 'function',
                function: {
                    name: 'end_conversation',
                    description: 'Funkcja kończąca rozmowę. Wywołaj tę funkcję, gdy użytkownik poprosił o zakończenie rozmowy lub pożegnał się.',
                    strict: false,
                },
            }],
            initialMessages: [
                { priority: 30, message: `Aktualna data i czas: ${chatTime(new Date())}` },
                { priority: 40, message: 'Pomieszczenie, gdzie znajduje się użytkownik: salon' },
            ]
        }
        if (config.file.chatGPT?.initialMessages) {
            items.initialMessages!.push({ priority: 20, message: config.file.chatGPT.initialMessages.join('\n') });
        }
        return items;
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        if (toolCall.type === 'function' && toolCall.function.name === 'end_conversation') {
            this.chat.terminate = true;
        }
        return true;
    }

}
