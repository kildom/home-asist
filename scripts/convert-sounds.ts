
import * as child_process from 'child_process';
import * as fs from 'fs';

for (let file of fs.readdirSync('data/sounds')) {
    if (!file.endsWith('.wav')) continue;
    let name = file.replace(/\.wav$/, '.ogg');
    console.log('Converting', file, 'to', name);
    child_process.execSync(`ffmpeg -i data/sounds/${file} -c:a libopus -ar 16000 -b:a 24k -y data/sounds/${name}`);
}

