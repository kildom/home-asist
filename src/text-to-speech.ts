
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

import * as textToSpeech from '@google-cloud/text-to-speech';

import { config, root } from './config';
import { processMessage } from './ssml-process';

let client: textToSpeech.TextToSpeechClient | undefined = undefined;


async function create(filePath: string, text: string, system: boolean) {

    if (client === undefined) {
        client = new textToSpeech.TextToSpeechClient({
            //projectId: config.file.google?.projectId ?? '',
        });
    }

    let opt = system ? config.player.system : config.player.assistant;

    const [response] = await client.synthesizeSpeech({
        input: {
            ssml: text,
        },
        voice: {
            languageCode: config.languageCode,
            ...opt?.voice,
        },
        audioConfig: {
            audioEncoding: 'OGG_OPUS',
            sampleRateHertz: 16000,
            ...opt?.coding,
        },
    });

    if (response.audioContent) {
        fs.writeFileSync(filePath, response.audioContent, 'binary');
    } else {
        throw new Error('No audio content returned from service');
    }
}

export async function textSoundFile(text: string, system: boolean, longTermCache: boolean) {

    let cacheDir = path.join(root, longTermCache ? 'data/cache-lt' : 'data/cache');
    let fileExtension = (system ? config.player.system.fileExtension : config.player.assistant.fileExtension) ?? '.ogg';
    let opt = JSON.stringify(system ? config.player.system : config.player.assistant);

    text = processMessage(text, system);

    let hash = crypto.createHash('sha256')
        .update(system ? 'system|' : 'assistant|', 'utf8')
        .update(opt, 'utf8')
        .update(text, 'utf8')
        .digest('hex');

    let fileDir = longTermCache ? cacheDir : path.join(cacheDir, hash.substring(0, 2));
    let filePath = path.join(fileDir, hash.substring(2) + fileExtension);

    if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
    }

    if (!fs.existsSync(filePath)) {
        await create(filePath, text, system);
    }

    return filePath;
}


async function manualTest1() {
    async function play(file: Promise<string>) {
        let cp = await import('child_process');
        cp.execSync('mplayer -msglevel all=1 -quiet -noar -noconsolecontrols -nojoystick -nolirc -nomouseinput ' + await file);
    }
    await play(textSoundFile('Witaj świecie!', false, true));
    await play(textSoundFile('<speak>Witaj <emphasis level="strong">świecie</emphasis>!</speak>', false, true));
    await play(textSoundFile('{{en}}Hello World!', false, true));
    await play(textSoundFile('Witaj świecie!', true, true));
    await play(textSoundFile('{{en}}Hello World!', true, true));
    await play(textSoundFile('Oto lista nienumerowana:\n* pozycja pierwsza,\n* pozycja druga,\n* pozycja trzecia.\nI to już koniec.', false, true));
    await play(textSoundFile('Oto lista numerowana:\n1. pozycja pierwsza,\n2. pozycja druga,\n3. pozycja trzecia.\nI to już koniec.', false, true));
}

if (process.argv.includes('--test-text-to-speech')) {
    manualTest1();
}
