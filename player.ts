import { Instance } from "./instance";
import createPlayer from 'play-sound';
import * as child_process from 'node:child_process';
import * as config from './config';

export interface SoundItem {
    getFile(): Promise<string> | string | undefined;
}


class FileSoundItem implements SoundItem {
    private file: string;

    public constructor(file: string) {
        this.file = file;
    }

    public getFile(): string {
        return this.file;
    }
}

export class SoundPlayer {

    private playQueue: SoundItem[] = [];
    private player: any = createPlayer();
    private process: child_process.ChildProcessWithoutNullStreams | undefined = undefined;
    private state: 'idle' | 'waiting' | 'playing' = 'idle';
    private waitingForSilence = new Set<((value: void | PromiseLike<void>) => void)>();

    public constructor(instance: Instance) {
    };

    public play(sound: SoundItem | string | undefined): void {
        if (typeof sound === 'undefined') {
            // do nothing
            return;
        } else if (typeof sound === 'string') {
            this.playQueue.push(new FileSoundItem(sound));
        } else {
            this.playQueue.push(sound);
        }
        this.playNext();
    }

    private playNext() {
        while (this.state === 'idle' && this.playQueue.length > 0) {
            let item = this.playQueue.shift()!;
            let fileOrPromise = item.getFile();
            if (fileOrPromise === undefined) {
                continue;
            } else if (typeof fileOrPromise === 'string') {
                this.playFileNow(fileOrPromise);
                break;
            } else {
                fileOrPromise
                    .then((file) => {
                        this.playFileNow(file);
                    })
                    .catch((err) => {
                        console.error(err);
                        this.playFileNow('data/sounds/error.mp3');
                    });
                this.state = 'waiting';
                break;
            }
        }

        if (this.state === 'idle') {
            let list = [...this.waitingForSilence.values()];
            this.waitingForSilence.clear();
            for (let resolve of list) {
                console.log('resolvef');
                resolve();
            }
        }
    }

    private playFileNow(fileName: string) {
        console.log('Playing sound:', fileName);
        this.state = 'playing';
        this.process = this.player.play(fileName, { ...config.file.player }, (err: any) => {
            if (err) {
                this.process = undefined;
                console.error(err);
                this.state = 'idle';
                this.playNext();
            }
        });

        if (!this.process) {
            console.error('Could not play sound file:', fileName);
            this.state = 'idle';
            this.playNext();
            return;
        }

        this.process.on('exit', (code) => {
            console.log('Sound player exited with code', code);
            if (code !== 0) {
                console.error(new Error(`Speech audio player exited with code ${code}`));
            }
            this.process = undefined;
            this.state = 'idle';
            this.playNext();
        });
    }

    public waitForSilence(): Promise<void> {
        console.log(this.state);
        if (this.state === 'idle') {
            return Promise.resolve();
        } else {
            return new Promise((resolve) => {
                this.waitingForSilence.add(resolve);
            });
        }
    }
}
