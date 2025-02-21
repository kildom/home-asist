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

const apiKeys = JSON.parse(fs.readFileSync('drafts/callmebot-api-key.json', 'utf8'));
const apiURL = 'https://api.callmebot.com/whatsapp.php';

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
        type: 'function',
        function: {
            // TODO: If not configured or wrong key/phone, return instructions how to configure.
            name: 'send_message',
            description: 'Funkcja wysyła wiadomość lub URL do telefonu użytkownika. Funckja wymaga nazwy użytkownika, więc zapytaj jeżeli jeszcze nie znasz.  Liczby i numery wysyłaj w formie cyfrowej, nie używaj formy słownej.',
            parameters: {
                type: 'object',
                required: [
                    'message',
                    'user_name'
                ],
                properties: {
                    message: {
                        type: 'string',
                        description: 'Wiadomość lub URL do wysłania.' // TODO: Inform about maximum message length or divide into more messages automatically.
                    },
                    user_name: {
                        type: 'string',
                        description: 'Nazwa użytkownika. Właściciel telefonu.'
                    }
                },
                additionalProperties: false
            },
            strict: true
        }
    },
    // TODO: Function (or some other method) to set user phone number and api key.
];

export class Phone extends AssistantModule {

    constructor(chat: Chat) {
        super(chat, 'Phone');
    }

    public onQuery(): undefined | AssistantModuleQueryItems | Promise<undefined | AssistantModuleQueryItems> {
        return { tools };
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        if (toolCall.type === 'function' && toolCall.function.name === 'send_message') {
            return this.sendMessage(toolCall.function.arguments);
        }
        return 'Error';
    }

    private async sendMessage(args: string): Promise<AssistantToolCallResult> {
        try {
            let obj = JSON.parse(args);
            let message = `${obj.message}`;
            let userName = `${obj.user_name}`;
            this.instance.player.say('Telefon: ' + userName);
            let [phone, key] = Object.entries(apiKeys)[0];
            let url = `${apiURL}?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${key}`;
            let result = await axios.get(url);
            if (result.status !== 200) throw new Error('Error sending message. HTTP status: ' + result.status);
            console.log(result.data);
            return 'OK';
        } catch (e) {
            console.error(e);
            this.instance.player.say(`<speak>Błąd przetwarzania danych od asystenta: <lang xml:lang="en-US">${e.message.substring(0, 60)}</lang></speak>`);
            return `Error: ${e.message}`;
        }
    }
}
