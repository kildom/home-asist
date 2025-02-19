import { ChatCompletionMessageToolCall } from "openai/resources/index.mjs";
import { Chat } from "../chat";
import { Instance } from "../instance";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import { TextSoundItem } from "../text-to-speech";


export class ChatManager implements AssistantModule {

    public name = 'Chat Manager';

    constructor(
        public instance: Instance
    ) { }

    onRegister(chat: Chat): void {
    }

    onQuery(chat: Chat): AssistantModuleQueryItems {
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

    onToolCall(chat: Chat, toolCall: ChatCompletionMessageToolCall): AssistantToolCallResult {
        if (toolCall.type === 'function' && toolCall.function.name === 'end_conversation') {
            chat.instance.player.play(new TextSoundItem('Asystent zakończył rozmowę.', false, true));
            chat.terminate = true;
        }
        return undefined;
    }

    onSerialize(chat: Chat): void {
    }

    onDeserialize(chat: Chat): void {
    }

}
