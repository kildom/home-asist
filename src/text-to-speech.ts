
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

    console.log('----------', text);

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


async function create2(filePath: string, text: string, voiceName: string) {

    if (client === undefined) {
        client = new textToSpeech.TextToSpeechClient({
            //projectId: config.file.google?.projectId ?? '',
        });
    }

    const [response] = await client.synthesizeSpeech({
        input: {
            text,
        },
        voice: {
            languageCode: config.languageCode,
            name: voiceName,
        },
        audioConfig: {
            audioEncoding: 'LINEAR16',
            sampleRateHertz: 16000,
        },
    });

    if (response.audioContent) {
        fs.writeFileSync(filePath, response.audioContent, 'binary');
    } else {
        throw new Error('No audio content returned from service');
    }
}

async function test2() {
    const voices = [
        'pl-PL-Chirp3-HD-Achernar',
        'pl-PL-Chirp3-HD-Achird',
        'pl-PL-Chirp3-HD-Algenib',
        'pl-PL-Chirp3-HD-Algieba',
        'pl-PL-Chirp3-HD-Alnilam',
        'pl-PL-Chirp3-HD-Aoede',
        'pl-PL-Chirp3-HD-Autonoe',
        'pl-PL-Chirp3-HD-Callirrhoe',
        'pl-PL-Chirp3-HD-Charon',
        'pl-PL-Chirp3-HD-Despina',
        'pl-PL-Chirp3-HD-Enceladus',
        'pl-PL-Chirp3-HD-Erinome',
        'pl-PL-Chirp3-HD-Fenrir',
        'pl-PL-Chirp3-HD-Gacrux',
        'pl-PL-Chirp3-HD-Iapetus',
        'pl-PL-Chirp3-HD-Kore',
        'pl-PL-Chirp3-HD-Laomedeia',
        'pl-PL-Chirp3-HD-Leda',
        'pl-PL-Chirp3-HD-Orus',
        'pl-PL-Chirp3-HD-Puck',
        'pl-PL-Chirp3-HD-Pulcherrima',
        'pl-PL-Chirp3-HD-Rasalgethi',
        'pl-PL-Chirp3-HD-Sadachbia',
        'pl-PL-Chirp3-HD-Sadaltager',
        'pl-PL-Chirp3-HD-Schedar',
        'pl-PL-Chirp3-HD-Sulafat',
        'pl-PL-Chirp3-HD-Umbriel',
        'pl-PL-Chirp3-HD-Vindemiatrix',
        'pl-PL-Chirp3-HD-Zephyr',
        'pl-PL-Chirp3-HD-Zubenelgenubi',
        'pl-PL-Standard-A',
        'pl-PL-Standard-B',
    ];
    const rates = [0.8, 1, 1.3, 1.6];
    const pitches = [-20, -10, 0, 10, 20];
    const targetText = 'Hej Dona tu'
    const text1 = [
        'Klej do naprawy.',
        'Hej domatorze',
        'Jej dom, a to nie jej dom.',
    ];
    const text2 = [
        'Dzisiaj pada deszcz od samego rana.',
        'Zrobiłem sobie kawę i usiadłem przy oknie.',
        'Kot wskoczył na parapet i zamiauczał.',
        'Nie zapomnij zamknąć drzwi na klucz.',
        'Samochód przejechał z dużą prędkością.',
        'Wczoraj oglądałem ciekawy film.',
        'Czas przygotować się do kolacji.',
        'Książka leżała na biurku cały dzień.',
        'Pociąg przyjechał dziesięć minut wcześniej.',
        'Zgubiłem parasol na przystanku.',
        'W lodówce zabrakło mleka.',
        'Telefon nagle przestał działać.',
        'W sklepie było bardzo tłoczno.',
        'Zaspałem dziś do pracy.',
        'Dzieci bawiły się w ogrodzie.',
        'Zrobiło się zimno, trzeba założyć kurtkę.',
        'Zupa była zbyt słona.',
        'Usłyszałem dziwny hałas w nocy.',
        'Wysłałem paczkę na poczcie.',
        'Muszę kupić nowe buty.',
        'Drzewa zaczynają tracić liście.',
        'Lubię spacerować po lesie.',
        'Znów zapomniałem hasła do konta.',
        'Zjadłem kanapkę z serem i pomidorem.',
        'Spotkaliśmy się na przystanku autobusowym.',
        'Zgasło światło w całym bloku.',
        'Komputer potrzebuje aktualizacji.',
        'Widziałem dziś sowę w parku.',
        'Przesunęli termin spotkania.',
        'Szukam nowego mieszkania w okolicy.',
        'Zapisałem się na kurs językowy.',
        'Psa trzeba wyprowadzić na spacer.',
        'Drukarka znów się zacięła.',
        'Chleb już się kończy.',
        'Wrócę późno wieczorem.',
        'Na stole leży twoja torba.',
        'W telewizji leciał ciekawy reportaż.',
        'Sprawdź pogodę na jutro.',
        'Zgubiłem klucze od samochodu.',
        'Przyniosłem ci herbatę.',
        'Moje ulubione ciastka zniknęły.',
        'Otwórz okno, jest duszno.',
        'Skończyły się baterie w pilocie.',
        'Zbieramy się na wycieczkę.',
        'Muszę zrobić pranie.',
        'Rower stoi przed domem.',
        'Zbliża się burza.',
        'Zasłony są nowe i jeszcze pachną.',
        'Czekam na ciebie przed wejściem.',
        'Zjadłem śniadanie godzinę temu.',
        'Dodaj do listy jeszcze pomidory.',
        'Na dole torby znalazłem długopis.',
        'Ej, znowu zostawiłeś światło w łazience.',
        'Tutaj nie ma zasięgu, chodźmy dalej.',
        'Do wczoraj miałem nadzieję na lepszą pogodę.',
        'Ej, dokąd tak pędzisz o tej porze?',
        'Na dachu siedział gołąb i coś grzebał.',
        'Domyślam się, że to nie był przypadek.',
        'Tutaj zawsze parkuję rower.',
        'Dobrze, że doniosłeś to na czas.',
        'Ej, nie rób takiej miny.',
        'Nad domem przeleciał balon.',
        'Donata nie było w szkole od tygodnia.',
        'Tutaj ktoś chyba zostawił kurtkę.',
        'Znalazłem to na dole szafy.',
        'Ej, czy ta doniczka zawsze tu stała?',
        'Do wczoraj nie wiedziałem o tej zmianie.',
        'Tutaj nie ma już wolnych miejsc.',
        'Nad ranem usłyszałem dziwne dźwięki.',
        'Dodaj trochę soli do zupy.',
        'Na stole leżą twoje notatki.',
        'Ej, oddaj mi ten długopis.',
        'Tutaj chyba ktoś zgubił telefon.',
        'Do końca dnia zostały trzy godziny.',
        'Na dzisiaj to już wszystko.',
        'Dobrze się czujesz? Wyglądasz na zmęczonego.',
        'Ej, nie zapomnij o zadaniu domowym.',
        'Tutaj często widuję wiewiórki.',
        'Nad lasem zbierają się chmury.',
        'Doniosę ci to po spotkaniu.',
        'Na dziedzińcu grają dzieci.',
        'Ej, zostaw te papiery na biurku.',
        'Do jutra mam napisać raport.',
        'Tu naprawdę cicho, słychać tylko ptaki.',
        'Nad głową przelatuje samolot.',
        'Dodatek do herbaty był bardzo aromatyczny.',
        'Na obiad zrobię coś prostego.',
        'Ej, czy mogę tu usiąść?',
        'Tutaj była wcześniej tablica ogłoszeń.',
        'Doniczki stoją równo na parapecie.',
        'Do sklepu idę na piechotę.',
        'Na tej ulicy zawsze są korki.',
        'Ej, co to za dźwięk?',
        'Tu kończy się nasza mapa.',
        'Nad rzeką widać było mgłę.',
        'Dobrze, że przypomniałeś o spotkaniu.',
        'Na ławce leżała gazeta.',
        'Ej, zamknij proszę drzwi.',
        'Tutaj wszystko wygląda inaczej niż wczoraj.',
        'Do tej pory nikt się nie zgłosił.',
        'Dona powiedziała, że przyjdzie później.',
        'Natu czekała na przystanku ponad godzinę.',
        'Ejdo, nie zapomnij zabrać parasola!',
        'Wczoraj spotkałem Donę w bibliotece.',
        'Natu lubi długie spacery po lesie.',
        'Ejdo, to twoje klucze leżą na stole?',
        'Dona zamknęła drzwi bardzo cicho.',
        'Natu zawsze siedzi przy oknie.',
        'Ejdo, sprawdź wiadomości na telefonie.',
        'Dona dodała miód do herbaty.',
        'Czy Natu już wyjechała na weekend?',
        'Ejdo, możesz podać mi notatnik?',
        'Dona nie miała pojęcia o tym spotkaniu.',
        'Natu napisała list do przyjaciela.',
        'Ejdo, ktoś puka do drzwi!',
        'Dona zapomniała wziąć ładowarki.',
        'Natu kupiła nową książkę o podróżach.',
        'Ejdo, zostawiłeś światło w kuchni.',
        'Dona maluje bardzo realistyczne obrazy.',
        'Natu szukała kluczy przez pół godziny.',
        'Ejdo, gdzie schowałeś pilot?',
        'Dona przyszła z dużym psem.',
        'Natu często chodzi bez telefonu.',
        'Ejdo, przypomnij mi o jutrzejszym spotkaniu.',
        'Dona zostawiła wiadomość na lodówce.',
        'Natu mówiła, że spadł śnieg w górach.',
        'Ejdo, nie wchodź tam bez latarki.',
        'Dona wysłała mi wczoraj długiego maila.',
        'Natu wyglądała na bardzo zmęczoną.',
        'Ejdo, ktoś dzwoni do drzwi.',
        'Dona uczy się grać na gitarze.',
        'Natu zbiera stare monety.',
        'Ejdo, zamknij proszę okno w sypialni.',
        'Dona zarezerwowała stolik w restauracji.',
        'Natu zaprosiła mnie na urodziny.',
        'Ejdo, włożyłeś już pranie?',
        'Dona wzięła urlop na przyszły tydzień.',
        'Natu zaczęła nowy projekt w pracy.',
        'Ejdo, nie zapomnij o zakupach.',
        'Dona wybrała kolor niebieski do pokoju.',
        'Natu wysłała kartkę z wakacji.',
        'Ejdo, zobacz, kto przyszedł.',
        'Dona chciała iść do kina, ale było zamknięte.',
        'Natu wypiła herbatę z imbirem.',
        'Ejdo, gdzie zaparkowałeś samochód?',
        'Dona znalazła portfel na chodniku.',
        'Natu zadzwoniła późno wieczorem.',
        'Ejdo, odbierz paczkę z recepcji.',
        'Dona powiedziała, że przyjdzie z koleżanką.',
        'Natu lubi ciszę i spokój po pracy.',
    ];

    for (let voice of voices) {
        console.log(voice);
        await create2(`wakeupword/data/tmp/ggl/${voice}.wav`, 'Hej Zefiro, tu.', voice);
    }
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
    test2();
}
