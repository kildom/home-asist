import * as path from 'node:path';
import * as child_process from 'node:child_process';
import { config, root } from './config';
import { textSoundFile } from './text-to-speech';


interface SoundItem {
    file: Promise<string | undefined> | string | undefined;
    lowPriority?: boolean;
    process?: child_process.ChildProcess;
};


export class SoundPlayer {

    private active: SoundItem | undefined = undefined;
    private playQueue: SoundItem[] = [];
    private state: 'idle' | 'waiting' | 'playing' = 'idle';
    private waitingForSilence = new Set<((value: void | PromiseLike<void>) => void)>();

    public assistant(text: string): void {
        this.file(textSoundFile(text, false, false));
    }

    public system(text: string, longTermCache: boolean = true): void {
        this.file(textSoundFile(text, true, longTermCache));
    }

    public effect(name: 'progress' | 'fade-out' | 'ding', lowPriority?: boolean): void {
        this.file(path.join(root, `data/sounds/${name}.ogg`), lowPriority);
    }

    public file(file: Promise<string | undefined> | string | undefined, lowPriority?: boolean): void {
        this.playSoundItem({ file, lowPriority });
    }

    public waitForSilence(): Promise<void> | void {
        console.log(this.state);
        if (this.state === 'idle') return;
        return new Promise((resolve) => {
            this.waitingForSilence.add(resolve);
        });
    }

    public stop(includeHighPriority?: boolean): void {
        if (this.state === 'idle') return;
        this.playQueue = this.playQueue.filter(item => !includeHighPriority && !item.lowPriority);
        if (includeHighPriority || this.active?.lowPriority) {
            if (this.active?.process) {
                this.active.process.kill();
            }
            this.active = undefined;
            this.state = 'idle';
            this.playNext();
        }
    }

    private playSoundItem(item: SoundItem): void {
        if (!item.lowPriority) {
            let allLowPriority = this.playQueue.every((item) => item.lowPriority) && this.active?.lowPriority;
            if (typeof item.file === 'object' && allLowPriority) {
                item.file.then(() => {
                    if (this.playQueue.includes(item)) {
                        this.stop();
                    }
                });
            } else {
                this.stop();
            }
        }
        this.playQueue.push(item);
        this.playNext();
    }

    private playNext() {
        if (this.state !== 'idle') return;

        if (this.playQueue.length > 0) {
            let item = this.playQueue.shift()!;
            this.active = item;
            let fileOrPromise = item.file;
            if (fileOrPromise === undefined) {
                this.playNext();
            } else if (typeof fileOrPromise === 'string') {
                this.playFileNow(fileOrPromise, item);
            } else {
                fileOrPromise
                    .then((file) => {
                        if (this.active !== item) return;
                        if (file === undefined) {
                            this.playNext();
                        } else {
                            this.playFileNow(file, item);
                        }
                    })
                    .catch((err) => {
                        if (this.active !== item) return;
                        console.error(err);
                        this.playFileNow('data/sounds/error.mp3', item);
                    });
                console.log('to waiting');
                this.state = 'waiting';
            }
        } else {
            let list = [...this.waitingForSilence.values()];
            this.waitingForSilence.clear();
            for (let resolve of list) {
                resolve();
            }
        }
    }

    private playFileNow(fileName: string, item: SoundItem): void {
        console.log('Playing sound:', fileName);
        this.state = 'playing';
        try {
            let command = config.player.command[0];
            let args = config.player.command.slice(1).map((arg) => arg.replace('$$$', fileName));

            let newProcess = child_process.execFile(command, args, { encoding: 'utf-8', shell: false });

            newProcess.on('exit', (code) => {
                if (this.active !== item) return;
                console.log('Sound player exited with code', code);
                if (code !== 0) {
                    console.error(new Error(`Speech audio player exited with code ${code}`));
                }
                this.active = undefined;
                this.state = 'idle';
                this.playNext();
            });
            newProcess.on('error', (err) => {
                if (this.active !== item) return;
                console.log('Sound player exited with error', err);
                this.active = undefined;
                this.state = 'idle';
                this.playNext();
            });
            item.process = newProcess;
        } catch (err) {
            console.error('Could not play sound file:', fileName);
            console.error(err);
            this.active = undefined;
            this.state = 'idle';
            this.playNext();
        }
    }

}

async function manualTest1() {

    let player = new SoundPlayer();
    let sep = '\n---------------------------------------------------------\n'

    /*console.log(sep, 'Expected: ding, ding, out', sep);
    player.file(root + '/data/sounds/ding.mp3');
    player.file(root + '/data/sounds/ding.mp3');
    player.file(root + '/data/sounds/out.wav');
    await player.waitForSilence();

    console.log(sep, 'Expected: ding, ding', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.file(root + '/data/sounds/ding.mp3');
    player.file(root + '/data/sounds/out.wav', true);
    player.file(root + '/data/sounds/ding.mp3');
    player.stop();
    await player.waitForSilence();

    console.log(sep, 'Expected: half ding', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.file(root + '/data/sounds/ding.mp3');
    player.file(root + '/data/sounds/ding.mp3');
    await new Promise((resolve) => setTimeout(resolve, 200));
    player.stop(true);
    await player.waitForSilence();

    console.log(sep, 'Expected: half ding, out', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.file(root + '/data/sounds/ding.mp3', true);
    player.file(root + '/data/sounds/out.wav');
    await new Promise((resolve) => setTimeout(resolve, 200));
    player.stop(false);
    await player.waitForSilence();

    console.log(sep, 'Expected: half ding, delay, ding', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.file(root + '/data/sounds/ding.mp3', true);
    player.file(new Promise((resolve) => setTimeout(() => resolve(root + '/data/sounds/ding.mp3'), 2000)));
    await new Promise((resolve) => setTimeout(resolve, 200));
    player.stop(false);
    await player.waitForSilence();

    console.log(sep, 'Expected: ding', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.file(new Promise((resolve) => setTimeout(() => resolve(root + '/data/sounds/ding.mp3'), 2000)));
    await new Promise((resolve) => setTimeout(resolve, 200));
    player.stop(true);
    player.file(root + '/data/sounds/ding.mp3', true);
    await player.waitForSilence();

    console.log(sep, 'Expected: I am your assistant.', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.assistant('{{en}} I am your assistant.');
    await player.waitForSilence();*/

    console.log(sep, 'Expected: This is system message.', sep);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    player.system('{{en}} This is system message that I want to test how long it will take for ogg opus to be played or mp3.');
    await player.waitForSilence();
}

if (process.argv.includes('--test-player')) {
    manualTest1();
}
