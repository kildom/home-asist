// Import the Cloud Speech-to-Text library
const speech = require('@google-cloud/speech').v2;
// Imports the Google Cloud client library
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');

// Instantiates a client
const client = new speech.SpeechClient();

// Your local audio file to transcribe
// const audioFilePath = "path/to/audio/file";
const projectId = 'aitests-451123';
const recognizerId = 'aitests-recognizer';

// Creates a Recognizer:
async function createRecognizer() {
    const recognizerRequest = {
        parent: `projects/${projectId}/locations/global`,
        recognizerId: recognizerId,
        recognizer: {
            languageCodes: ['en-US'],
            model: 'latest_long',
        },
    };

    const operation = await client.createRecognizer(recognizerRequest);
    const recognizer = operation[0].result;
    const recognizerName = recognizer.name;
    console.log(`Created new recognizer: ${recognizerName}`);
}


async function delRecognizer() {
    const recognizerName= "projects/302702647459/locations/global/recognizers/aitests-recognizer";
    await client.deleteRecognizer({
        name: recognizerName
    });
}

async function showRecognizers() {
    console.log(await client.listRecognizers({
        parent: 'projects/302702647459/locations/global',
        showDeleted: true,
    }));
}

async function transcribeFile() {
    const audioFilePath = 'output.mp3';
    const recognizerName= 'projects/302702647459/locations/global/recognizers/_';

    const content = fs.readFileSync(audioFilePath).toString('base64');

    let t1 = Date.now();

    const response = await client.recognize({
        recognizer: recognizerName,
        config: {
            // Automatically detects audio encoding
            languageCodes: ['pl-PL'],
            model: 'latest_long',
            features: {
                //enableAutomaticPunctuation: true,
                enableWordConfidence: true,
                enableWordTimeOffsets: true,
            },
            autoDecodingConfig:{},
        },
        content: content,
    });

    let t2 = Date.now();
    let res = '';

    for (const result of response[0].results) {
        console.log(`Transcript: ${result.alternatives[0].transcript}`);
        res += result.alternatives[0].transcript;
    }
    
    fs.writeFileSync('output.txt', res);
    for (const result of response[0].results) {
        console.log(result);
        console.log(result.alternatives[0].words);
    }
    console.log(t2 - t1);
}

async function toTextQuickStart() {
    // Creates a client
    const client2 = new textToSpeech.TextToSpeechClient({
        projectId: '302702647459',
    });
    
  // The text to synthesize
  const text = `Aby wytłumaczyć obserwowane efekty (np. grawitacyjną spójność rozległych galaktyk o małej widocznej masie), przypuszcza się, że zasadniczą część masy galaktyk stanowi hipotetyczna ciemna materia, czyli cząstki lub obiekty emitujące zbyt mało promieniowania, by mogły być wykryte. Zgodnie z tym modelem, z obliczeń wynika, że ciemna materia stanowi ponad 90% masy galaktyk. Mimo to jej natura nie jest znana. Istnieją dowody na to, iż w centrum wielu lub nawet wszystkich galaktyk mogą istnieć supermasywne czarne dziury.`;

  let t1 = Date.now();
  // Construct the request
  // Performs the text-to-speech request
  const [response] = await client2.synthesizeSpeech({
    input: {text: text},
    // Select the language and SSML voice gender (optional)
    voice: {
        languageCode: 'pl-PL',
        ssmlGender: 'FEMALE',
        name: 'pl-PL-Standard-A',
    },
    // select the type of audio encoding
    audioConfig: {audioEncoding: 'MP3'},
  });
  let t2 = Date.now();

  console.log(t2 - t1);

  // Save the generated binary audio content to a local file
  fs.writeFileSync('output.mp3', response.audioContent, 'binary');
  console.log('Audio content written to file: output.mp3');
}

async function main() {
    //await createRecognizer();
    await transcribeFile();        
    //await delRecognizer();
    //await showRecognizers();
    //await toTextQuickStart();
}

main();
