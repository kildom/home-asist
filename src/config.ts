
import * as fs from 'node:fs';
import * as JSON5 from 'json5';
import { configSchema } from './config.sch';

export const root = __dirname + '/..';

export const consts = {
    openAIEnvKey: 'OPENAI_API_KEY_FILE',
};

export interface ChatCompletionCreateParamsSubset {
    model?: string;
    max_completion_tokens?: number | null;
    max_tokens?: number | null;
    parallel_tool_calls?: boolean;
    temperature?: number | null;
}

export interface Config {
    chatGPT: {
        standardOptions: ChatCompletionCreateParamsSubset;
        smarterOptions?: ChatCompletionCreateParamsSubset;
        jsonSchema: any;
        messages?: string[];
        maxToolsIterations?: number;
    };
};

function getConfig() {
    let c = JSON5.parse(fs.readFileSync(root + '/data/config.json5', 'utf8'));
    return configSchema.parse(c);
}

export const config = getConfig() as Config;
