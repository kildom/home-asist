
import * as fs from 'node:fs';
import * as JSON5 from 'json5';
import { protos as speechProtos } from '@google-cloud/speech';
import { protos as texttospeechProtos } from '@google-cloud/text-to-speech';
import OpenAI from 'openai';

export interface SynthesisOptions {
    voice?: texttospeechProtos.google.cloud.texttospeech.v1.IVoiceSelectionParams;
    coding?: texttospeechProtos.google.cloud.texttospeech.v1.IAudioConfig;
}

export interface ConfigFile {
    language: string;
    recognition?: {
        config?: speechProtos.google.cloud.speech.v1.IStreamingRecognitionConfig | speechProtos.google.cloud.speech.v1p1beta1.IStreamingRecognitionConfig;
        noMessageTimeout?: number;
        endOfMessageTimeout?: number;
    }
    synthesis?: {
        chat?: SynthesisOptions;
        system?: SynthesisOptions;
    };
    recorder?: any;
    directories?: {
        cache?: string;
    };
    google?: {
        projectId?: string;
        projectName?: string;
        keyFilename?: string;
    };
    player?: {
        player?: string;
        players?: string[];
    };
    chatGPT?: {
        options?: OpenAI.ChatCompletionCreateParamsNonStreaming;
        initialMessages?: string[];
    };
}

export const sampleRate = 16000;

export const file: ConfigFile = JSON5.parse(fs.readFileSync(__dirname + '/config.json5', 'utf8'));

export const speechToText = {
    maxWriteQueueSeconds: 10,
};

export const recorder = {
    maxReconnectCount: 5,
};
