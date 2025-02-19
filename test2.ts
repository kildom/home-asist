import { create } from "./recorder-node";
import { GoogleSpeechToText_old } from "./speech-to-text";
import { SpeechPlayer } from "./text-to-speech";


async function test2() {

    let speechSource = await speechToTextConnect();

    let text = '';

    retrySpeech:
    do {
        do {
            let r = await PromiseUtils.race({
                speech: speechSource.read(),
                delay: delay(text === '' ? 7000 : 1000),
            });
            if (r.key === 'speech') {
                // speech activity, postpone query even when the result is not final.
                r.promises.delay.cancel();
                if (r.speech.final) {
                    // TODO: If final, but the same as previous non-final, do not reset timer.
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

        if (text !== '') {
            // TODO: handle silence - end conversation
        }

        console.log('Query: ', text);

        // TODO: put it into assistantQuery function with speechSource as optional parameter
        let assistant = await queryAssistant(text);

        let r = await PromiseUtils.race({
            speech: speechSource?.read(),
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
                playDing(QUERY_ACCEPTED);
                r.promises.delay.cancel();
                speechSource.close();
                speechSource = undefined;
                break retrySpeech;

            case 'delay':
                throw new Error('Timeout - not implemented'); // TODO: Implement Open AI API timeout
        }
    } while (true);

    let loopCounter = 0;
    while (true) {
        loopCounter++;
        if (loopCounter > 10) {
            throw new Error('Too much message exchange between assistant and system.');
        }
        // playDing(QUERY_PROCESSING); - every function should play its own audio at the beginning, so ding is not needed here
        // If there are no functions, the response reading should start immediately
        let responseAudioPromise = undefined;
        if (assistant.response.text) {
            responseAudioPromise = prepareResponse(assistant.results.text); // including request to google TTS if needed
        }
        let results = await processFunctions(assistant.response); // including functions execution
        if (responseAudioPromise) {
            await waitForSystemAudioDone(); // system sounds should be queued and interrupted here is waiting more than 2 seconds.
            let responseAudio = await responseAudioPromise;
            readResponsePromise = readResponse(responseAudio);
        }
        if (results.queryBack) {
            await queryAssistant(results.queryBack);
            await readResponsePromise;
            continue;
        } else {
            await readResponsePromise;
            break;
        }
    }
}
