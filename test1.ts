import { create } from "./recorder-node";
import { GoogleSpeechToText } from "./speech-to-text";
import { SpeechPlayer } from "./text-to-speech";


let rec = create();
let speech = new GoogleSpeechToText();

rec.onError = (err) => {
    console.log('Recorder error', err);
};

rec.onStopped = () => {
    console.log('Recorder STOP');
};

rec.onData = (data) => {
    speech.write(data);
};

speech.onError = (err) => {
    console.log('Speech error', err);
};

speech.onStopped = () => {
    console.log('Speech STOP');
};

let isSystem = false;

speech.onData = (previousText, newText, final) => {
    if (final) {
        let player = new SpeechPlayer();
        player.onError = (err) => {
            console.error(err);
        };
        player.onStopped = () => {
            console.log('Speech audio player stopped');
        };
        player.onResponse = () => {
            console.log('Speech audio player started');
        }
        player.play(newText, false, isSystem);
        isSystem = !isSystem;
    }
    console.log(`${previousText}\x1b${final ? '[32m' : '[33m'}${newText}\x1b[0m`);
};


speech.start();
rec.start();
