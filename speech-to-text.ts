

import * as speech from '@google-cloud/speech';

import * as config from './config';

const BUFFER_OVERFLOW_SECONDS = 10;

const wavHeader = new Uint8Array([
    // R   I     F     F  |   size = 2147479588   |  W     A     V     E  |  f     m     t    space
    0x52, 0x49, 0x46, 0x46, 0x24, 0xf0, 0xff, 0x7f, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20,
    // chunk size = 16    |fmt=1 (PCM)|channels=1 |  sample rate = 16000  |   byte rate = 32000   |
    0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x80, 0x3e, 0x00, 0x00, 0x00, 0x7d, 0x00, 0x00,
    // block=2|bit/smpl=16|  d     a     t     a  | chunk size=2147479552 |
    0x02, 0x00, 0x10, 0x00, 0x64, 0x61, 0x74, 0x61, 0x00, 0xF0, 0xff, 0x7f,
]);


export interface SpeechToText {

    /**
     * Start recognizing audio.
     */
    start(): Promise<void>;

    /**
     * Stop recognizing audio.
     */
    stop(): Promise<void>;

    write(data: Int16Array): void;

    /**
     * Callback when new text data is available.
     * @param previousText  The previous recognized text (in previous events).
     * @param newText       The new recognized text (in this event).
     * @param final         `true` if the recognized text is final, `false` if it is interim and final text may change.
     */
    onData?: (previousText: string, newText: string, final: boolean) => void;

    /**
     * Callback when an error occurs. The `onStopped` will be also called later.
     * @param err Error object.
     */
    onError?: (err: Error) => void;

    /**
     * Callback when the recognizer is stopped. It is always called either after `stop` or when an error occurs.
     */
    onStopped?: () => void;

}

let client: speech.SpeechClient | undefined = undefined;

export class GoogleSpeechToText implements SpeechToText {

    public onData?: ((previousText: string, newText: string, final: boolean) => void) | undefined;
    public onError?: ((err: Error) => void) | undefined;
    public onStopped?: (() => void) | undefined;

    private stream: ReturnType<speech.SpeechClient['streamingRecognize']> | undefined = undefined;
    private previousText: string = '';
    private writeQueue: Int16Array[] | undefined = [];
    private writeQueueSamples: number = 0;

    async start(): Promise<void> {

        if (!client) {
            client = new speech.SpeechClient();
        }

        this.previousText = '';
        this.writeQueue = undefined;

        this.stream = client.streamingRecognize({
            config: {
                encoding: 'LINEAR16',
                sampleRateHertz: config.sampleRate,
                languageCode: config.file.language,
                ...config.file.recognition,
            },
            interimResults: true,
        });

        this.stream.on('error', (err) => {
            this.cleanup(err);
        });

        this.stream.on('close', () => {
            this.cleanup();
        });

        this.stream.on('end', () => {
            this.cleanup();
        });

        this.stream.on('drain', () => {
            while (this.writeQueue && this.writeQueue.length > 0 && this.stream) {
                let data = this.writeQueue.shift()!;
                this.writeQueueSamples -= data.length;
                let moreWrites = this.stream.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
                if (!moreWrites) {
                    return;
                }
            }
            this.writeQueue = undefined;
        });

        this.stream.on('data', data => {
            let res = data.results[0];
            this.onData?.(this.previousText, res.alternatives[0].transcript, res.isFinal);
            if (res.isFinal) {
                this.previousText += res.alternatives[0].transcript;
            }
        });

        this.write(new Int16Array(wavHeader.buffer));
    }

    async stop(): Promise<void> {
        this.stream?.end();
    }

    write(data: Int16Array): void {
        
        if (!this.stream) {
            return;
        }

        if (this.writeQueue) {
            this.writeQueueSamples += data.length;
            this.writeQueue.push(data.slice());
            if (this.writeQueueSamples > BUFFER_OVERFLOW_SECONDS * config.sampleRate) {
                this.cleanup(new Error('Buffer overflow. Service is not accepting data fast enough.'));
            }
        } else {
            let moreWrites = this.stream.write(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            if (!moreWrites) {
                this.writeQueue = [];
                this.writeQueueSamples = 0;
            }
        }
    }

    private cleanup(err?: Error): void {

        if (!this.stream) return;

        if (err) {
            this.onError?.(err);
        }
        this.onStopped?.();

        try {
            this.stream.end();
        } catch (err) { }

        this.writeQueue = undefined;
    }

}

