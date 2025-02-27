import OpenAI from "openai";
import { Chat, TaggedMessage } from "./chat";
import { Instance } from "./instance";


export interface AssistantModuleQueryItems {
    initialMessages?: { priority: number, message: string }[];
    tools?: OpenAI.Chat.Completions.ChatCompletionTool[];
}

export interface ModuleTool {
    isDynamic?: boolean; // dynamic tools are put at the end allowing non-dynamic tools caching.
    isHidden?: boolean; // hidden tools are not available for the assistant.
    tools: OpenAI.Chat.Completions.ChatCompletionTool;
    /* Tools buckets in chat appearance order:
       - static, visible
       - static, hidden
       - dynamic, visible and hidden
       */
}

export interface ModuleMessage {
    isDynamic?: boolean;
    message: string;
}


export type AssistantToolCallResult =
    | boolean
    | string
    | OpenAI.Chat.Completions.ChatCompletionToolMessageParam
    | (OpenAI.Chat.Completions.ChatCompletionMessageParam | TaggedMessage)[];

export class AssistantModule {

    public instance: Instance;

    public constructor(
        public chat: Chat,
        public name: string
    ) {
        this.instance = chat.instance;
        this.chat.addModule(this);
    }

    public onRegister(): void | Promise<void> {
        /* Suggested chat methods to use:
         *     this.chat.addTool(tool, isDynamic) - 
         *     this.chat.addSystemMessage(message, priority, isDynamic) - priority is used to sort messages,
         *         dynamic messages are put before each message query and removed after query to avoid cache
         *         misses.
         */
    }

    public onBeforeFirstQuery(): void | Promise<void> {
        /* Suggested chat methods to use: the same as in onRegister. */

    }

    public onQuery(): undefined | AssistantModuleQueryItems | Promise<undefined | AssistantModuleQueryItems> {
        /* Modify the chat state (messages and tools) to prepare for the next query. */
        return undefined;
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        throw new Error("This method must be implemented.");
    }

    public onSerialize(): void | Promise<void> {
    }

    public onDeserialize(): void | Promise<void> {
    }

    /*
    Module timeline:
     - constructor - Module is added to the chat.
     ** All modules are created and added to the chat.
     - onRegister - Module is registered in the chat.
       If there are longer task to do, it should be done asynchronously and waiting for it should be in 'onBeforeFirstQuery' method.
     ** User asked first question.
     - onBeforeFirstQuery - Module is prepared for the first query.
     - onQuery - Query to assistant is being prepared.
     - onToolCall - Assistant response requested a tool from this module.
     ** Repeat from onQuery until the chat ends.
     ** Chat ends, but it is saved for later.
     - onSerialize - Chat will be saved, so module should prepare for serialization.
     - onExit - Chat ended and module should clean up.

     ** Chat will be resumed.
     - constructor
     - onRegister
     ** Chat is restored.
     - onDeserialize
     ** User asked first question.
     - onBeforeFirstQuery... and the rest is the same as before.
    */

};

