import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { Chat } from "./chat";
import { Instance } from "./instance";
import { config } from "./config";
import { SoundPlayer } from "./player";

export enum RevertFlags {
    None = 0, // No revert.
    Response = 1 << 0, // Revert chat to state from before message containing this tool invocation.
    Query = 1 << 1, // Revert chat to state from before latest user query message.
    StopProcessing = 1 << 8, // Stop processing the query.
}

export type ToolResult =
    | string // Normal response.
    | object // Response that will be converted to JSON.
    | RevertFlags // Revert chat state
    ; // Or, throw an error to indicate a failure.


export enum ToolState {
    Normal,
    Hidden,
    Dynamic,
    DynamicHidden,
}

export interface Tool {
    tool: OpenAI.Responses.FunctionTool;
    dynamic: boolean; // dynamic tools are put at the end allowing non-dynamic tools caching.
    hidden: boolean; // hidden tools are not available for the assistant.
    toolkit: Toolkit;
    schema?: z.ZodType;
    callback: (args: any) => ToolResult | Promise<ToolResult>;
    priority: number; // Priority of the tool. Higher number means higher priority.
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


export class Toolkit {

    public instance: Instance;
    public player: SoundPlayer;

    public constructor(
        public chat: Chat,
        public name: string
    ) {
        this.instance = chat.instance;
        this.player = this.instance.player;
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
     * This method is called when query was aborted before being processed.
     * It may be aborted even before onQuery() is called.
     */
    public onAbort(): void | Promise<void> {
    }

    /**
     * Called when chat is going to be serialized.
     */
    public onSerialize(): void | Promise<void> {
    }

    protected addTool<T extends z.ZodTypeAny>(
        schema: T,
        callback: (args: z.infer<T>) => ToolResult | Promise<ToolResult>,
        initialState: ToolState = ToolState.Normal,
        priority: number = 50
    ): Tool {
        let m = schema.description?.match(/^function\s+([a-z0-9_]+)$/i);
        if (!m) throw new Error('Function name not found in description');
        let name = m[1];
        console.log(config.functions);
        if (!(name in config.functions)) throw new Error(`Function ${name} prompts not configured.`);
        let prompts = (config.functions as any)[name] as { [key: string]: string };
        let result: Tool = {
            tool: {
                type: 'function',
                name,
                description: prompts.desc,
                strict: false,
                parameters: {
                    type: 'object',
                    properties: {},
                    required: [],
                },
            },
            dynamic: initialState === ToolState.Dynamic || initialState === ToolState.DynamicHidden,
            hidden: initialState === ToolState.Hidden || initialState === ToolState.DynamicHidden,
            toolkit: this,
            callback,
            priority,
        };
        if ((schema instanceof z.ZodObject) && Object.keys(schema.shape).length > 0) {
            let rf = zodResponseFormat(schema, name);
            delete rf.json_schema.schema!['$schema'];
            delete rf.json_schema.schema!.description;
            result.schema = schema;
            if (rf.json_schema.schema) {
                result.tool.parameters = rf.json_schema.schema;
                result.tool.strict = true;
            }
            let props = result.tool.parameters?.properties as { [key: string]: { [key: string]: any } };
            for (let key of Object.keys(props)) {
                if (!(key in prompts)) throw new Error(`Prompt for ${key} not found in config.`);
                props[key].description = prompts[key];
            }
        }
        this.chat.addTool(result);
        return result;
    }

}
