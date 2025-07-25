import { Readable } from 'node:stream';

import { record } from 'node-record-lpcm16';

import { Recorder } from './recorder';

const SAMPLE_RATE = 16000;


export class NodeRecorder implements Recorder {

    public onError?: ((err: Error) => void) | undefined;
    public onData?: ((data: Int16Array) => void) | undefined;
    public onStopped?: () => void;

    private recorder!: ReturnType<typeof record>;
    private stream!: Readable;
    private isOpen = false;
    private dataReady = false;
    private dataDetectionState = 0;
    private unalignedByte: number | undefined = undefined;
    private closePromisesPending: ((value: void | PromiseLike<void>) => void)[] = [];

    public async start(): Promise<void> {
        this.recorder = record({
            sampleRate: SAMPLE_RATE,
            sampleRateHertz: SAMPLE_RATE,
            channels: 1,
            threshold: 0,
            endOnSilence: false,
            verbose: false,
            recordProgram: 'sox',
            recorder: 'sox', // TODO: Config
            silence: '31536000',
            //...config.file.recorder,
        });

        this.stream = this.recorder.stream();

        this.isOpen = true;

        this.stream.on('error', (err) => {
            this.cleanup(err);
        });

        this.stream.on('close', () => {
            this.cleanup();
        });

        this.stream.on('end', () => {
            this.cleanup();
        });

        this.stream.on('data', (data: Uint8Array) => {
            if (this.isOpen) {
                if (!this.dataReady) {
                    let offset = this.detectDataStart(data);
                    data = data.subarray(offset);
                }
                if (this.dataReady) {
                    if (this.unalignedByte !== undefined) {
                        let oldData = data;
                        data = new Uint8Array(data.length + 1);
                        data[0] = this.unalignedByte;
                        this.unalignedByte = undefined;
                        data.set(oldData, 1);
                    }
                    if (data.length % 2 === 1) {
                        this.unalignedByte = data[data.length - 1];
                        data = data.subarray(0, data.length - 1);
                    }
                    this.onData?.(new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2));
                }
            }
        });
    }

    private detectDataStart(data: Uint8Array) {
        for (let i = 0; i < data.length; i++) {
            if ((this.dataDetectionState === 0 && data[i] === 0x64)
                || (this.dataDetectionState === 1 && data[i] === 0x61)
                || (this.dataDetectionState === 2 && data[i] === 0x74)
                || (this.dataDetectionState === 3 && data[i] === 0x61)
                || (this.dataDetectionState === 4)
                || (this.dataDetectionState === 5)
                || (this.dataDetectionState === 6)
                || (this.dataDetectionState === 7)
            ) {
                this.dataDetectionState++;
                if (this.dataDetectionState === 8) {
                    this.dataReady = true;
                    return i + 1;
                }
            } else {
                this.dataDetectionState = 0;
            }
        }
        return data.length;
    }

    public stop(): Promise<void> {
        if (this.isOpen) {
            return new Promise<void>((resolve, reject) => {
                this.closePromisesPending.push(resolve);
                this.recorder.stop();
            });
        } else {
            return Promise.resolve();
        }
    }

    private cleanup(err?: Error): void {
        let wasOpen = this.isOpen;
        this.isOpen = false;
        while (this.closePromisesPending.length > 0) {
            this.closePromisesPending.pop()!();
        }
        if (wasOpen) {
            if (err) {
                this.onError?.(err);
            }
            this.onStopped?.();
        }
        try {
            this.recorder.stop();
        } catch (err) { }
        try {
            this.stream.destroy();
        } catch (err) { }
    }

}

async function test1() {
    let chunks: Uint8Array[] = [];
    let rec = new NodeRecorder();
    rec.onStopped = () => console.log('closed');
    rec.onError = (err) => console.log('error', err);
    rec.onData = (data) => {
        console.log('data', data.length);
        chunks.push(new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice());
    }

    console.log('start');
    await rec.start();
    console.log('started');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('stop');
    await rec.stop();
    console.log('stopped');
    require('node:fs').writeFileSync('test.raw', Buffer.concat(chunks));
    
}

if (process.argv.includes('--test-recorder')) {
    test1();
}
