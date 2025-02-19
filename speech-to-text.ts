

import * as speech from '@google-cloud/speech';

import * as config from './config';
import { Instance } from './instance';
import { ignoreErrors } from './common';

const wavHeader = new Uint8Array([
    // R   I     F     F  |   size = 2147479588   |  W     A     V     E  |  f     m     t    space
    0x52, 0x49, 0x46, 0x46, 0x24, 0xf0, 0xff, 0x7f, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
    // chunk size = 16    |fmt=1 (PCM)|channels=1 |  sample rate = 16000  |   byte rate = 32000   |
    0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00,
    // block=2|bit/smpl=16|  d     a     t     a  | chunk size=2147479552 |
    0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0xF0, 0xff, 0x7f,
]);


let client: speech.SpeechClient | undefined = undefined;


export class SpeechToTextError extends Error { }


export interface SpeechToTextResult {
    text: string;
    final: boolean;
}

export class SpeechToText {

    // #region >> SpeechToText

    private finalTextWaiting: string = '';
    private nonFinalTextWaiting: string = '';
    private addSpaceSeparator = false;
    private recognizeStream: ReturnType<speech.SpeechClient['streamingRecognize']> | undefined = undefined;
    private writeQueue: Int16Array[] | undefined = [];
    private writeQueueSamples: number = 0;
    private audioHandler: any;
    private error: any = undefined;
    private readWaiting: {
        resolve: (value: SpeechToTextResult) => void;
        reject: (reason?: any) => void;
    } | undefined = undefined;


    public constructor(
        private instance: Instance,
    ) {
        this.writeQueue = [new Int16Array(wavHeader.buffer)];
    }

    // #endregion

    // #region Output

    public read(): Promise<SpeechToTextResult> {
        if (this.error) {
            return Promise.reject(this.error);
        } else if (this.finalTextWaiting.length > 0) {
            let text = this.finalTextWaiting;
            this.finalTextWaiting = '';
            this.nonFinalTextWaiting = '';
            return Promise.resolve({ text, final: true });
        } else if (this.nonFinalTextWaiting.length > 0) {
            let text = this.nonFinalTextWaiting;
            this.nonFinalTextWaiting = '';
            return Promise.resolve({ text, final: false });
        } else if (this.readWaiting) {
            let callbacks = this.readWaiting;
            this.readWaiting = undefined;
            callbacks.resolve({ text: '', final: false });
            return new Promise((resolve, reject) => {
                this.readWaiting = { resolve, reject };
            });
        } else if (!this.recognizeStream) {
            return Promise.reject(new Error('Read before or after active recognition.'));
        } else {
            return new Promise((resolve, reject) => {
                this.readWaiting = { resolve, reject };
            });
        }
    }

    private newData(result: speech.protos.google.cloud.speech.v1.IStreamingRecognitionResult) {
        let text = result.alternatives?.[0]?.transcript ?? '';
        let final = !!result.isFinal;

        if (final) {
            text = text?.trim();
            if (!text) return;
            if (this.addSpaceSeparator) {
                text = ' ' + text;
            }
            this.addSpaceSeparator = true;
            this.nonFinalTextWaiting = '';
        }

        if (this.readWaiting) {
            let callbacks = this.readWaiting;
            this.readWaiting = undefined;
            callbacks.resolve({ text, final });
        } else if (final) {
            this.finalTextWaiting += text;
        } else if (text) {
            this.nonFinalTextWaiting = text;
        }
    }

    // #endregion

    // #region Input

    public feedInitialSamples(samples: Int16Array[]): void {
        if (this.recognizeStream) throw new Error('Invalid state');
        this.writeQueue?.push(...samples.map(x => x.slice()));
        // writeQueueSamples not updated, since initial samples do not count towards buffer overflow.
    }

    private write(data: Int16Array): void {
        if (this.writeQueue) {
            this.writeQueueSamples += data.length;
            this.writeQueue.push(data.slice());
            if (this.writeQueueSamples > config.speechToText.maxWriteQueueSeconds * config.sampleRate) {
                this.cleanup(new SpeechToTextError('Buffer overflow. Service is not accepting data fast enough.'));
            }
        } else if (this.recognizeStream) {
            let moreWritesAllowed = this.recognizeStream.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            if (!moreWritesAllowed) {
                this.writeQueue = [];
                this.writeQueueSamples = 0;
            }
        }
    }

    private drain() {
        while (this.writeQueue && this.writeQueue.length > 0 && this.recognizeStream) {
            let data = this.writeQueue.shift()!;
            this.writeQueueSamples -= data.length;
            let moreWritesAllowed = this.recognizeStream.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            if (!moreWritesAllowed) {
                return;
            }
        }
        this.writeQueue = undefined;
    }

    // #endregion

    // #region Connection and callbacks

    public start(): void {

        if (!client) {
            client = new speech.SpeechClient();
        }

        this.finalTextWaiting = '';

        this.recognizeStream = client.streamingRecognize({
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: config.sampleRate,
                languageCode: config.file.language,
                ...config.file.recognition,
            },
            interimResults: true,
        });

        this.audioHandler = (samples: Int16Array) => {
            this.write(samples);
        };

        this.instance.on('audio', this.audioHandler);

        this.recognizeStream
            .on('error', (err) => {
                this.cleanup(err);
            })
            .on('close', () => {
                this.cleanup(new SpeechToTextError('Stream closed unexpectedly.'));
            })
            .on('end', () => {
                this.cleanup(new SpeechToTextError('Stream ended unexpectedly.'));
            })
            .on('drain', () => {
                this.drain();
            })
            .on('data', (data: speech.protos.google.cloud.speech.v1.IStreamingRecognizeResponse) => {
                if (data.error) {
                    this.cleanup(new SpeechToTextError(data.error.message ?? 'Unknown error'));
                } else if (data.results && data.results.length === 1) {
                    this.newData(data.results[0]);
                }
            });

        this.drain();
    }

    public stop(): void {
        this.cleanup();
    }

    [Symbol.dispose]() {
        this.cleanup();
    }

    private cleanup(err?: any) {
        if (err) {
            this.error = err;
        }
        if (this.readWaiting) {
            if (err) {
                this.readWaiting.reject(err);
            } else {
                this.readWaiting.resolve({ text: '', final: false });
            }
            this.readWaiting = undefined;
        }
        if (this.recognizeStream) {
            let stream = this.recognizeStream;
            this.recognizeStream = undefined;
            ignoreErrors(() => this.instance.off('audio', this.audioHandler));
            ignoreErrors(() => stream.removeAllListeners());
            ignoreErrors(() => stream.end());
            setTimeout(() => ignoreErrors(() => stream.destroy()), 500);
        }
    }

    // #endregion

}

