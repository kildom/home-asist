import { delay, waitMultiple } from "./common";
import { Instance } from "./instance";
import { SpeechToText } from "./speech-to-text";
import * as config from "./config";
import { Chat } from "./chat";
import OpenAI from "openai";
import { ChatManager } from "./modules/chat-manager";
import { TextSoundItem } from "./text-to-speech";
import { Home } from "./modules/home";
import { Web } from "./modules/web";

function endOfMessageTimeout(userMessage: string) {
    console.log('Speech timeout', userMessage === ''
        ? config.file.recognition?.noMessageTimeout ?? 10000
        : config.file.recognition?.endOfMessageTimeout ?? 2000);
    return delay(userMessage === ''
        ? config.file.recognition?.noMessageTimeout ?? 10000
        : config.file.recognition?.endOfMessageTimeout ?? 2000);
}

async function executeOneRound(instance: Instance, chat: Chat, previousAudio?: Int16Array[]) {

    let userMessage = '';
    let nonFinalText = '';
    using recognition = new SpeechToText(instance);
    if (previousAudio) {
        recognition.feedInitialSamples(previousAudio);
    }
    recognition.start();

    let messageTimer = endOfMessageTimeout(userMessage);

    let assistantResult: OpenAI.ChatCompletion.Choice;

    retrySpeechRecognition:
    do {
        do {
            let res = await waitMultiple({
                timeout: messageTimer,
                speech: recognition.read(),
            });
            if (res.key === 'timeout') {
                // no speech activity, query the current text, but keep listening in case user starts to speak again.
                break;
            } else if (res.key === 'speech' && res.speech) {
                console.log('Speech: ',res.speech.final,  res.speech.text);
                let resetTimer = true;
                if (res.speech.final) {
                    resetTimer = (res.speech.text !== nonFinalText || userMessage === '');
                    userMessage += res.speech.text;
                    nonFinalText = '';
                } else {
                    nonFinalText = res.speech.text;
                }
                if (resetTimer) {
                    messageTimer.cancelDelay();
                    messageTimer = endOfMessageTimeout(userMessage);
                }
            }
        } while (true);

        if (nonFinalText !== '') {
            userMessage += ' ' + nonFinalText.trim();
        }

        if (userMessage === '') {
            // Nothing from user, end conversation.
            return false;
        }

        console.log('Query: ', userMessage);

        let responsePromise = chat.query(userMessage);

        let res = await waitMultiple({
            assistant: responsePromise,
            speech: recognition.read(),
            delay: delay(12000),
        });

        if (res.key === 'delay') {
            throw new Error('IA Assistant timeout');
        } else if (res.key === 'speech' && res.speech) {
            console.log('Speech: ',res.speech.final,  res.speech.text);
            res.promises.delay.cancelDelay();
            messageTimer.cancelDelay();
            messageTimer = endOfMessageTimeout(userMessage);
            if (res.speech.final) {
                userMessage += res.speech.text;
                nonFinalText = '';
            } else {
                nonFinalText = res.speech.text;
            }
            console.log('Go back to speech recognition');
            continue retrySpeechRecognition;
        } else if (res.key === 'assistant') {
            res.promises.delay.cancelDelay();
            recognition.stop();
            assistantResult = res.assistant!;
            break retrySpeechRecognition;
        }
    } while (true);


    let loopCounter = 0;
    let queryAgain: boolean;
    do {
        loopCounter++;
        if (loopCounter > 10) {
            instance.player.say('Błąd rozmowy. Za dużo rządań do systemu od asystenta IA.');
            break;
        }
        queryAgain = await chat.process(assistantResult);
        queryAgain = queryAgain;
        if (queryAgain) {
            assistantResult = await chat.query();
        }
    } while (queryAgain);

    console.log('Before exit');

    await instance.player.waitForSilence();

    return !chat.terminate;
}

async function main() {
    let instance = new Instance();
    let chat = new Chat(instance);
    let managerModule = new ChatManager(chat);
    let home = new Home(chat);
    let web = new Web(chat);
    instance.start();
    await chat.start();
    let continueConversation = true;
    while (continueConversation) {
        console.log('=============================================================\nStarting new round');
        continueConversation = await executeOneRound(instance, chat);
    }
    instance.player.play('data/sounds/out.wav');
    await instance.player.waitForSilence();
    process.exit();
}

async function main_old() {

    let prev: Int16Array[] | undefined = [];
    console.log('Starting instance');
    let instance: Instance = new Instance();
    instance.start();
    instance.on('audio', (data) => {
        if (prev) prev.push(data);
    });
    {
        using recognition = new SpeechToText(instance);
        console.log('instance started');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        console.log('Starting recognition');
        recognition.feedInitialSamples(prev);
        prev = undefined;
        recognition.start();
        let timeoutDelay = delay(10000);
        while (true) {
            let res = await waitMultiple({
                text: recognition.read(),
                delay: timeoutDelay,
            });
            if (res.key === 'delay') {
                console.log('Timeout');
                break;
            } else if (res.key === 'text') {
                console.log(res.text);
            }
        }
        console.log('Stop recognition');
    }
    await delay(1000);
    process.exit();
}

main();
