
import * as fs from 'node:fs';
import * as JSON5 from 'json5';
import { configSchema } from './config.sch';

export const root = __dirname + '/..';

export const consts = {
    openAIEnvKey: 'OPENAI_API_KEY_FILE',
};

interface FunctionsConfig {
    debug_mark_chat: {
        desc: string;
        note: string;
    },
    end_chat: {
        desc: string;
    },
    set_intelligence: {
        desc: string;
        intelligent: string;
    },
    send_message: {
        desc: string;
        message: string;
        user_name: string;
    },
}

export interface ChatCompletionCreateParamsSubset {
    model?: string;
    max_completion_tokens?: number | null;
    max_tokens?: number | null;
    parallel_tool_calls?: boolean;
    temperature?: number | null;
}

interface TextToSpeechConfig {
    voice?: {
        languageCode?: string;
        name?: string;
        ssmlGender?: 'SSML_VOICE_GENDER_UNSPECIFIED' | 'MALE' | 'FEMALE' | 'NEUTRAL';
    };
    coding?: {
        audioEncoding?: 'LINEAR16' | 'MP3' | 'OGG_OPUS' | 'MULAW' | 'ALAW' | 'PCM';
        speakingRate?: number;
        pitch?: number;
        volumeGainDb?: number;
        sampleRateHertz?: number;
    };
    fileExtension?: string;
}


export interface Config {
    languageCode: string;
    chatGPT: {
        standardOptions: ChatCompletionCreateParamsSubset;
        smarterOptions?: ChatCompletionCreateParamsSubset;
        jsonSchema: any;
        messages?: string[];
        maxToolsIterations?: number;
    };
    player: {
        command: string[];
        assistant: TextToSpeechConfig;
        system: TextToSpeechConfig;
    }
    functions: FunctionsConfig;
};

function getConfig() {
    let c = JSON5.parse(fs.readFileSync(root + '/data/config.json5', 'utf8'));
    if (process.argv.includes('--dev-skip-config-validation')) {
        return c;
    } else {
        return configSchema.parse(c);
    }
}

export const config = getConfig() as Config;
