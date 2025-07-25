
/* Implement following state machine:

digraph MainStateMachine {

    init [label="init"]
    exit [label="exit"]
    
    init -> waiting
    waiting -> preRecognition [label="[non-final text]"]
    waiting -> recognition [label="[final text]"]
    preRecognition -> recognition [label="[final text]"]
    recognition -> preQuery [label="[timeout 3s]"]
    recognition -> recognition [label="[any text]"]
    preRecognition -> preQuery [label="[timeout 5s]"]
    preRecognition -> preRecognition [label="[non-final text]"]
    preQuery -> query [label="[first response]"]
    query -> waiting [label="[query done]"]
    preQuery -> recognition [label="[query text changed\nand final exists]"]
    preQuery -> preRecognition [label="[query text changed\nand only non-final]"]
    waiting -> exit [label="[timeout 7s]"]

}

*/

import { Chat } from "./chat";
import { delay, ignoreErrors, waitMultiple } from "./common";
import { Instance } from "./instance";
import { NodeRecorder } from "./recorder-node";
import { SpeechToText } from "./speech-to-text";
import { ChatManager } from "./tools/chat-manager";
import { Home } from "./tools/home";
import { Phone } from "./tools/phone";
import { Web } from "./tools/web";

const NO_SPEECH_TIMEOUT = 70000000;
const RECOGNITION_FINAL_TIMEOUT = 3000;
const RECOGNITION_NON_FINAL_TIMEOUT = 5000;

async function chatRound(instance: Instance, chat: Chat) {

    console.log('Chat Round start');
    instance.player.effect('ding');
    instance.player.waitForSilence();
    let stt = new SpeechToText();
    stt.start();
    let rec = new NodeRecorder();
    rec.onData = (data) => stt.write(data);
    rec.onStopped = () => console.log('stopped');
    rec.onError = (err) => console.log('error', err);
    await rec.start();

    let queryText = '';
    let chatQueryPromise: Promise<boolean> | undefined = undefined;
    let chatStartPromise: Promise<void>;
    let activeFunction: (() => void | Promise<void>) | undefined;

    function showQueryText() {
        process.stdout.write(`\r${stt.finalText}\x1b[32m${stt.nonFinalText}\x1b[0m           \r`);
    }

    async function waiting() {
        console.log('WAITING');
        let res = await waitMultiple({
            timeout: delay(NO_SPEECH_TIMEOUT),
            speech: stt.wait(),
        });
        console.log('   ', res.key);
        if (res.key === 'timeout') {
            activeFunction = undefined;
        } else {
            activeFunction = recognition;
        }
    }

    function recognition() {
        let timeout = delay(stt.nonFinalText ? RECOGNITION_NON_FINAL_TIMEOUT : RECOGNITION_FINAL_TIMEOUT);
        activeFunction = recognitionInner;

        async function recognitionInner() {
            queryText = stt.finalText + stt.nonFinalText;
            showQueryText();
            let res = await waitMultiple({
                timeout,
                speech: stt.wait(),
            });
            if (res.key === 'timeout') {
                activeFunction = queryText ? startQuery : waiting;
            } else if (queryText != stt.finalText + stt.nonFinalText) {
                timeout.resetDelay(stt.nonFinalText ? RECOGNITION_NON_FINAL_TIMEOUT : RECOGNITION_FINAL_TIMEOUT);
            } else {
                timeout.resetDelayEarliest(stt.nonFinalText ? RECOGNITION_NON_FINAL_TIMEOUT : RECOGNITION_FINAL_TIMEOUT);
            }
        }
    }

    function startQuery() {

        chatQueryPromise = chat.query(queryText);
        chatStartPromise = chat.waitForInitialData();
        activeFunction = startQueryInner;

        async function startQueryInner() {
            let res = await waitMultiple({
                start: chatStartPromise,
                chat: chatQueryPromise!,
                speech: stt.wait(),
            });
            if (res.key === 'speech') {
                if (queryText != stt.finalText + stt.nonFinalText) {
                    await chat.cancelQuery();
                    activeFunction = recognition;
                }
            } else {
                activeFunction = undefined;
            }
        }
    }

    activeFunction = waiting;
    while (activeFunction) {
        await activeFunction();
    };

    try { await rec.stop(); } catch (err) { }
    try { stt.stop(); } catch (err) { }

    for (let i = 0; i < 10; i++) instance.player.effect('progress', true);

    let continueChat = await chatQueryPromise;

    return !!continueChat;
}

async function main() {
    let instance = new Instance();
    let chat = new Chat(instance);
    new Phone(chat);
    new Home(chat);
    new ChatManager(chat);
    new Web(chat);
    chat.start();

    while (chat.active) {
        if (!await chatRound(instance, chat)) {
            console.log('Chat ended');
            break;
        }
        await instance.player.waitForSilence();
    }

    instance.player.effect('fade-out');
    await instance.player.waitForSilence();
    process.exit(0);
}

main();
