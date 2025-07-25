

import * as speech from '@google-cloud/speech';

import { Instance } from './instance';
import { ignoreErrors } from './common';

const SAMPLE_RATE = 16000;
const MAX_WRITE_QUEUE_SECONDS = 7;

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

    public finalText: string = '';
    public nonFinalText: string = '';
    public error: any = undefined;

    private recognizeStream: ReturnType<speech.SpeechClient['streamingRecognize']> | undefined = undefined;
    private writeQueue: Int16Array[] | undefined = [];
    private writeQueueSamples: number = 0;

    private waitPromise: Promise<void> | undefined = undefined;
    private waitResolveCallback: (() => void) | undefined = undefined;


    public constructor() {
        this.writeQueue = [new Int16Array(wavHeader.buffer)];
    }

    public wait(): Promise<void> {
        if (!this.waitPromise) {
            this.waitPromise = new Promise((resolve) => {
                this.waitResolveCallback = resolve;
            });
        }
        return this.waitPromise;
    }

    private waitResolve() {
        if (this.waitResolveCallback) {
            let func = this.waitResolveCallback;
            this.waitResolveCallback = undefined;
            this.waitPromise = undefined;
            func();
        }
    }


    // #endregion

    // #region Output

    private newData(result: speech.protos.google.cloud.speech.v1.IStreamingRecognitionResult) {
        let text = (result.alternatives?.[0]?.transcript ?? '').trim();
        let final = !!result.isFinal;

        let newFinalText = this.finalText;
        let newNonFinalText = this.nonFinalText;

        if (final) {
            if (text) {
                if (newFinalText) {
                    newFinalText += ' ';
                }
                newFinalText += text;
            }
            newNonFinalText = '';
        } else {
            newNonFinalText = text;
            if (newFinalText) {
                newNonFinalText = ' ' + newNonFinalText;
            }
        }

        if (this.finalText !== newFinalText || this.nonFinalText !== newNonFinalText) {
            this.finalText = newFinalText;
            this.nonFinalText = newNonFinalText;
            this.waitResolve();
        }
    }

    // #endregion

    // #region Input

    public feedInitialSamples(samples: Int16Array[]): void {
        if (this.recognizeStream) throw new Error('Invalid state');
        this.writeQueue?.push(...samples.map(x => x.slice()));
        // writeQueueSamples not updated, since initial samples do not count towards buffer overflow.
    }

    public write(data: Int16Array): void {
        if (this.writeQueue) {
            this.writeQueueSamples += data.length;
            this.writeQueue.push(data.slice());
            if (this.writeQueueSamples > MAX_WRITE_QUEUE_SECONDS * SAMPLE_RATE) {
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

        this.finalText = '';
        this.nonFinalText = '';
        this.error = undefined;

        this.recognizeStream = client.streamingRecognize({
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: SAMPLE_RATE,
                languageCode: 'pl-PL',
                //...config.file.recognition, // TODO: Config
            },
            interimResults: true,
        });

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
        this.waitResolve();
        if (this.recognizeStream) {
            let stream = this.recognizeStream;
            this.recognizeStream = undefined;
            ignoreErrors(() => stream.removeAllListeners());
            ignoreErrors(() => stream.end());
            setTimeout(() => ignoreErrors(() => stream.destroy()), 500);
        }
    }

    // #endregion

}


async function test1() {
    let recMod = await import('./recorder-node');
    let stt = new SpeechToText();
    stt.start();
    let rec = new recMod.NodeRecorder();
    rec.onData = (data) => stt.write(data);
    rec.onStopped = () => console.log('stopped');
    rec.onError = (err) => console.log('error', err);
    await rec.start();
    console.log('Say "stop" and wait to stop the test.');
    while (stt.finalText.indexOf('stop') < 0) {
        await stt.wait();
        process.stdout.write(`\r${stt.finalText}\x1b[32m${stt.nonFinalText}\x1b[0m           \r`);
    }
    console.log('\nStopping...');
    stt.stop();
    await rec.stop();
}


if (process.argv.includes('--test-stt')) {
    test1();
}
