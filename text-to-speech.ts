
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import * as child_process from 'node:child_process';

import createPlayer from 'play-sound';
import * as textToSpeech from '@google-cloud/text-to-speech';

import * as config from './config';

let player: ReturnType<typeof createPlayer> | undefined = undefined;
let cacheDir = '';
let client: textToSpeech.TextToSpeechClient | undefined = undefined;

export class SpeechPlayer {

    public onError?: (err: Error) => void;
    public onResponse?: () => void;
    public onStopped?: () => void;

    private process: child_process.ChildProcessWithoutNullStreams | undefined = undefined;

    async play(text: string, ssml: boolean, system: boolean) { // TODO: short therm cache / long therm cache

        if (cacheDir === '') {
            cacheDir = path.resolve(__dirname, config.file.directories?.cache ?? 'cache');
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }
            console.log('Cache directory:', cacheDir);
        }

        let hash = crypto.createHash('sha256')
            .update(ssml ? 'ssml' : 'text', 'utf8')
            .update(system ? 'system' : 'chat', 'utf8')
            .update(text, 'utf8')
            .digest('hex');

        let fileName = path.resolve(cacheDir, hash + '.ogg');
        if (!fs.existsSync(fileName)) {
            await this.create(fileName, text, ssml, system);
        }

        this.onResponse?.();

        if (!player) {
            player = createPlayer({});
        }

        this.process = player.play(fileName, { ...config.file.player }, (err) => {
            if (err) {
                console.error(err);
            }
        });

        if (!this.process) {
            throw new Error('Could not play speech audio.');
        }

        this.process.on('exit', (code) => {
            if (code !== 0) {
                this.onError?.(new Error(`Speech audio player exited with code ${code}`));
            }
            this.onStopped?.();
        });
    }

    private async create(fileName: string, text: string, ssml: boolean, system: boolean) {

        if (client === undefined) {
            client = new textToSpeech.TextToSpeechClient({
                projectId: config.file.google?.projectId ?? '',
            });
        }

        let opt = system ? config.file.synthesis?.system : config.file.synthesis?.chat;
        let input: textToSpeech.protos.google.cloud.texttospeech.v1.ISynthesisInput;

        input = ssml ? { ssml: text } : { text: text };

        const [response] = await client.synthesizeSpeech({
            input,
            voice: {
                languageCode: config.file.language,
                ...opt?.voice,
            },
            audioConfig: {
                audioEncoding: 'OGG_OPUS',
                sampleRateHertz: config.sampleRate,
                ...opt?.coding,
            },
        });

        if (response.audioContent) {
            fs.writeFileSync(fileName, response.audioContent, 'binary');
        } else {
            throw new Error('No audio content returned from service');
        }
    }
}