const recorder = require('node-record-lpcm16');

// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
const client = new speech.SpeechClient();

/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'pl-PL';
//const languageCode = 'en-US';

let finalText = '';
let interimText = '';

// Create a recognize stream
const recognizeStream = client
    .streamingRecognize({
        config: {
            encoding: encoding,
            sampleRateHertz: sampleRateHertz,
            languageCode: languageCode,
            enableAutomaticPunctuation: true,
            enableSpokenPunctuation: {value: true},
            model: 'latest_long',
        },
        interimResults: true,
    })
    .on('error', console.error)
    .on('data', data => {
        /*process.stdout.write(
            data.results[0] && data.results[0].alternatives[0]
                ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
                : '\n\nReached transcription time limit, press Ctrl+C\n'
        );*/
        let res = data.results[0];
        if (data.results[0].isFinal) {
            finalText += res.alternatives[0].transcript;
            interimText = '';
        } else {
            interimText = res.alternatives[0].transcript;
        }
        let spaces = 120 - finalText.length - interimText.length;
        console.log(`${finalText}\x1b[33m${interimText}\x1b[0m${' '.repeat(spaces)}`);
    }
    );

// Start recording and send the microphone input to the Speech API.
// Ensure SoX is installed, see https://www.npmjs.com/package/node-record-lpcm16#dependencies
recorder
    .record({
        sampleRateHertz: sampleRateHertz,
        threshold: 0,
        // Other options, see https://www.npmjs.com/package/node-record-lpcm16#options
        verbose: false,
        recordProgram: 'rec', // Try also "arecord" or "sox"
        silence: '10.0',
    })
    .stream()
    .on('error', console.error)
    .pipe(recognizeStream);

console.log('Listening, press Ctrl+C to stop.');
