import fs from 'node:fs';
import OpenAI from "openai";
import { functionTool, Tool, Toolkit, ToolPrototype } from "./toolkit";


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

function compareToolScoreOnStart(tool: Tool) {
    return (tool.hidden ? 2 : 0) + (tool.dynamic ? 1 : 0);
}

export class Chat {

    private toolkits: Toolkit[] = [];
    private tools: Tool[] = [];
    private firstQuery = true;
    private initialMessages: { message: string, priority: number }[] = [];
    private initialMessage: string = '';

    public addToolkit(toolkit: Toolkit): void {
        this.toolkits.push(toolkit);
    }

    public addTool(tool: Tool): void;
    public addTool(toolPrototype: ToolPrototype, toolkit: Toolkit, callback: Tool['callback']): void;
    public addTool(toolOrProto: ToolPrototype | Tool, toolkit?: Toolkit, callback?: Tool['callback']): void {
        let tool: Tool = toolkit ? functionTool(toolOrProto as ToolPrototype, toolkit!, callback!) : toolOrProto as Tool;
        this.tools.push(tool);
    }

    public addInitialMessage(message: string, priority: number = 50): void {
        this.initialMessages.push({ message, priority });
    }

    public addDeveloperMessage(message: string | undefined | null): void {
    }

    public setDeveloperMessage(message: string | undefined | null, toolkit: Toolkit, tag?: string): void {
        //this.dynamicMessages.push({ message, toolkit, tag });
    }

    public start() {
        this.toolkits.sort((a, b) => a.name.localeCompare(b.name));
        for (let toolkit of this.toolkits) {
            toolkit.onRegister(undefined); // TODO: save storage for serialization
        }
        this.firstQuery = true;
    }

    public async query(message?: string): Promise<OpenAI.Chat.Completions.ChatCompletion.Choice> {

        let openai = createOpenAI();

        if (this.firstQuery) {
            await this.prepareFirstQuery();
            this.firstQuery = false;
        }

        throw new Error('Not implemented');
    }

    private async prepareFirstQuery() {
        for (let toolkit of this.toolkits) {
            await toolkit.onFirstQuery();
        }
        this.tools.sort((a, b) => compareToolScoreOnStart(a) - compareToolScoreOnStart(b));
        this.initialMessages.sort((a, b) => a.priority - b.priority);
        this.initialMessage = this.initialMessages.map(m => m.message.trim()).filter(m => m).join('\n\n');
    }

}