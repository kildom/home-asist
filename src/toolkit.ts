import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Chat } from "./chat";
import { Instance } from "./instance";


export type ToolResult =
    | string // Normal response.
    | object // Response that will be converted to JSON.
    | {
        revertType:
            | 'response' // Revert chat to state from before message containing this tool invocation.
            | 'query', // Revert chat to state from before latest user query message.
        stopProcessing?: boolean,
    }
    ; // Or, throw an error to indicate a failure.


export interface ToolPrototype {
    name: string,
    description: string,
    args?: z.ZodType,
    dynamic?: boolean,
    hidden?: boolean,
}

export interface Tool {
    tool: OpenAI.Chat.Completions.ChatCompletionTool;
    dynamic: boolean; // dynamic tools are put at the end allowing non-dynamic tools caching.
    hidden: boolean; // hidden tools are not available for the assistant.
    toolkit: Toolkit;
    schema?: z.ZodType;
    callback: (args: any) => ToolResult | Promise<ToolResult>;
    /* To maximize cache hits, for the first time, sort tool in following order:
       - static, visible
       - dynamic, visible
       - static, hidden
       - dynamic, hidden
       Each time use order:
       - visible
       - hidden
       Since sort() is stable, right order is preserved.
       */
}

export type ToolArgsInfer<T extends ToolPrototype> = z.infer<Exclude<T['args'], undefined>>;

export function functionTool(proto: ToolPrototype, toolkit: Toolkit, callback: Tool['callback']): Tool {
    let result: Tool = {
        tool: {
            type: 'function',
            function: {
                name: proto.name,
                description: proto.description,
                strict: false,
            },
        },
        dynamic: proto.dynamic || false,
        hidden: proto.hidden || false,
        toolkit,
        schema: proto.args,
        callback,
    };
    if (proto.args) {
        let rf = zodResponseFormat(proto.args, proto.name);
        delete rf.json_schema.schema!['$schema'];
        result.tool.function.parameters = rf.json_schema.schema;
        result.tool.function.strict = true;
    }
    return result;
}


export class Toolkit {

    public instance: Instance;

    public constructor(
        public chat: Chat,
        public name: string
    ) {
        //this.instance = chat.instance;
        this.chat.addToolkit(this);
    }

    /**
     * Called when the toolkit is registered in the chat.
     *
     * If some long running operation is required, it should be done asynchronously and waiting for it should be in `onFirstQuery` method.
     *
     * The method returns a value that will be stored if the chat is serialized.
     * It must be JSON serializable.
     * When chat is restored from serialization, the `storage` parameter will be passed.
     * Otherwise, if this is new chat, `storage` will be `undefined`.
     */
    public onRegister(storage: any): Object | null | Promise<Object | null> {
        return null;
    }

    /**
     * This method is called when the first query is made.
     *
     * It is also called when the chat is restored from serialization and the first query is made.
     * Long running operation started in `onRegister` should be finished here.
     */
    public onFirstQuery(): void | Promise<void> {
    }

    /**
     * This method is called before each query.
     */
    public onQuery(): void | Promise<void> {
    }

    /**
     * Called when chat is going to be serialized.
     */
    public onSerialize(): void | Promise<void> {
    }

}
