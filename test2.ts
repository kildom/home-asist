import { create } from "./recorder-node";
import { GoogleSpeechToText } from "./speech-to-text";
import { SpeechPlayer } from "./text-to-speech";


async function test2() {

    let speechSource = await speechToTextConnect();

    let text = '';

    retrySpeech:
    do {
        do {
            let r = await PromiseUtils.race({
                speech: speechSource.read(),
                delay: delay(text === '' ? 5000 : 1000),
            });
            if (r.key === 'speech') {
                // speech activity, postpone query even when the result is not final.
                r.promises.delay.cancel();
                if (r.speech.final) {
                    if (text !== '' && !text.endsWith(' ') && !r.speech.text.startsWith(' ')) {
                        text += ' ';
                    }
                    text += r.speech.text;
                }
            } else if (r.key === 'delay') {
                // no speech activity, query the current text, but keep listening in case user starts to speak again.
                break;
            }
        } while (true);

        if (text === '') {
            // TODO: handle silence
        }

        console.log('Query: ', text);

        let assistant = await queryAssistant(text);

        let r = await PromiseUtils.rage({
            speech: speechSource.read(),
            assistant: assistant.read(),
            delay: delay(10000),
        });

        switch (r.key) {
            case 'speech':
                r.promises.delay.cancel();
                assistant.cancel();
                if (r.speech.final) {
                    if (text !== '' && !text.endsWith(' ') && !r.speech.text.startsWith(' ')) {
                        text += ' ';
                    }
                    text += r.speech.text;
                }
                continue retrySpeech;

            case 'assistant':
                r.promises.delay.cancel();
                speechSource.close();
                break retrySpeech;

            case 'delay':
                throw new Error('Timeout - not implemented'); // TODO: Implement Open AI API timeout
        }
    } while (true);

    assistant.response
}