import OpenAI from "openai";
import { Chat } from "./chat";
import { Instance } from "./instance";


export interface AssistantModuleQueryItems {
    initialMessages?: { priority: number, message: string }[];
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
}

export type AssistantToolCallResult = undefined
    | string
    | OpenAI.Chat.Completions.ChatCompletionToolMessageParam
    | OpenAI.Chat.Completions.ChatCompletionMessageParam[];

export interface AssistantModule {

    name: string;
    onRegister(chat: Chat): void;
    onQuery(chat: Chat): AssistantModuleQueryItems;
    onToolCall(chat: Chat, toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult;
    onSerialize(chat: Chat): void;
    onDeserialize(chat: Chat): void;

};

