import * as sax from 'sax';
import { config } from './config';

// TODO: resolve something like that: <p this is broken paragraph text</p>


export function processMessage(inputText: string, system: boolean): string {
    inputText = inputText.trim();
    if (inputText.startsWith('{')) {
        let obj: any;
        try {
            obj = JSON.parse(inputText);
        } catch (e) {
            // TODO: report error
            let pos = inputText.indexOf('<speak');
            if (pos >= 0 && pos < 16) {
                obj = {
                    ssml: inputText
                        .substring(pos)
                        .replace(/\\"/g, '"')
                        .replace(/"\}\s*$/g, "")
                };
            } else {
                obj = { ssml: inputText };
            }
        }
        if (typeof obj !== 'object') {
            obj = { ssml: `${obj}` };
        }
        if (obj.ssml) {
            inputText = `${obj.ssml}`;
        } else {
            let entries = Object.entries(obj);
            entries.sort((a, b) => `${b[1]}`.length - `${a[1]}`.length);
            inputText = `${entries[0][1]}`;
        }
        inputText = inputText.trim();
    }
    let outputText: string;
    if (inputText.startsWith('<')) {
        outputText = processSSML(inputText, system);
    } else {
        outputText = processSSML(processPlainText(inputText), system);
    }
    return `<speak>${outputText}</speak>`;
}

function simpleMarkdownToSSML(inputText: string): string {
    return inputText
        .replace(/\*\*([a-z_0-9(\u0080-\uFFFF-][ \t,;:.()&!?a-z_0-9(\u0080-\uFFFF-]*)\*\*/gi, '<emphasis level="strong">$1</emphasis>')
        .replace(/^\s*[*-]\s+/gmi, '<break time="700ms"/>')
        .replace(/^\s*([0-9]+)\.\s+/gmi, '<break time="700ms"/><emphasis level="strong">$1</emphasis>) ')
        .replace(/\{\{([a-z-]+)\}\}/gi, '<lang xml:lang="$1">')
        ;
}

function processPlainText(inputText: string): string {
    inputText = inputText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p)
        .map(p => simpleMarkdownToSSML(p))
        .join('</p><p>');
    return `<p>${inputText}</p>`;
}

interface Element {
    name: string;
    attributes: Record<string, string>;
    children: Node[];
}

type Node = Element | string;

function processSSML(inputText: string, system: boolean): string {
    let root = parseXML('<speak>' + inputText + '</speak>');
    let output: string[] = [];
    processChildren(root, output, system);
    return output.join('');
}

function getLanguageCode(value: string | undefined) {
    if (value === undefined) return undefined;
    value = value.trim().toLowerCase();
    let parts = value.split(/[^a-z]/);
    for (let langKey of [value, parts[0]]) {
        langKey = langKey.replace(/[^a-z]/g, '');
        if (langKey in languages) {
            return languages[langKey];
        } else {
            for (let supportedKey of Object.keys(languages)) {
                if (supportedKey.startsWith(langKey)) {
                    return languages[supportedKey];
                }
            }
        }
    }
    return undefined;
}

function processChildren(root: Element, output: string[], system: boolean) {
    let lang = getLanguageCode(root.attributes['xml:lang'] || root.attributes['lang'] || root.attributes['language'] || root.attributes['xml:language']);
    if (lang) {
        let voice = system ? config.player.system.voice?.ssmlGender : config.player.assistant.voice?.ssmlGender;
        let gender =
            (voice === 'FEMALE') ? 'female' :
            (voice === 'MALE') ? 'male' :
            'neutral';
        output.push(`<voice language="${lang}" gender="${gender}">`);
    }
    for (let child of root.children) {
        processNode(child, output, system);
    }
    if (lang) {
        output.push('</voice>');
    }
}

function outputElement(node: Element, attributes: string[], output: string[], system: boolean) {
    let allowed = new Set(attributes);
    output.push(`<${node.name}`);
    for (let [key, value] of Object.entries(node.attributes)) {
        if (allowed.has(key)) {
            output.push(` ${key}="${xmlEscape(value)}"`);
        }
    }
    if (node.children.length === 0) {
        output.push('/>');
    } else {
        output.push('>');
        processChildren(node, output, system);
        output.push(`</${node.name}>`);
    }
}

function processNode(node: Node, output: string[], system: boolean) {
    if (typeof node === 'string') {
        output.push(xmlEscape(node));
        return;
    }
    switch (node.name) {

        case 'break':
            outputElement({
                name: node.name,
                attributes: node.attributes,
                children: [],
            }, ['time', 'strength'], output, system);
            processChildren(node, output, system);
            break;

        case 'say-as': {
            if (node.attributes['interpret-as']) {
                let what = node.attributes['interpret-as'].trim().toLowerCase();
                if (what.startsWith('phone')) {
                    what = 'telephone';
                //} else if (what.startsWith('digit')) {
                  //  what = 'spell-out'; // TODO: maybe 'cardinal'? -- need more experiments
                } else if (what.startsWith('number')) {
                    what = 'cardinal';
                }
                node.attributes['interpret-as'] = what;
            }
            outputElement(node, ['interpret-as', 'format', 'detail'], output, system);
            break;
        }

        case 'audio': // TODO: use system voice
            output.push('<voice gender="male"><prosody rate="150%">');
            output.push('<break time="800ms"/>Nie można wstawić pliku audio.<break strength="medium"/>');
            processChildren(node, output, system);
            output.push('</prosody></voice>');
            break;

        case 'p':
        case 's':
            outputElement(node, [], output, system);
            break;

        case 'sub':
            outputElement(node, ['alias'], output, system);
            break;

        case 'prosody':
            outputElement(node, ['rate', 'pitch', 'volume'], output, system);
            break;

        case 'phoneme':
            outputElement(node, ['alphabet', 'ph'], output, system);
            break;

        case 'strong':
            output.push('<emphasis level="strong">');
            processChildren(node, output, system);
            output.push('</emphasis></voice>');
            break;

        case 'emphasis':
            outputElement(node, ['level'], output, system);
            break;

        case 'voice':
            outputElement(node, ['gender', 'language', 'name'], output, system);
            break;

        case 'par':
        case 'media':
        case 'seq':
        case 'speak':
        case 'mark':
        case 'lang':
            processChildren(node, output, system);
            break;

        default:
            // Flatten unknown elements
            // TODO: log unknown elements
            //output.push(`Unknown tag: ${node.name}`);
            processChildren(node, output, system);
            break;
    }
}



function parseXML(inputText: string): Element {

    inputText = inputText
        .trim()
        .split(/\n(?:\s*\n)+/)
        .join('<break time="1000ms"/>');

    let parser = sax.parser(false, {
        trim: false,
        normalize: false,
        lowercase: true,
        xmlns: false,
        position: false,
        noscript: true,
        strictEntities: false,
        unquotedAttributeValues: true,
    } as any);

    let root: Element = {
        name: 'ROOT',
        attributes: {},
        children: [],
    };

    let stack = [root];

    parser.onopentag = (tag: sax.Tag) => {
        let element: Element = {
            name: tag.name,
            attributes: tag.attributes,
            children: [],
        };
        stack.at(-1)!.children.push(element);
        stack.push(element);
    };

    parser.onclosetag = () => {
        stack.pop();
    };

    parser.ontext = (t: string) => {
        stack.at(-1)!.children.push(t);
    };

    parser.oncdata = (t: string) => {
        stack.at(-1)!.children.push(t);
    };

    parser.onerror = (/*e*/) => {
        // TODO: log parsing errors
        parser.resume();
    };

    parser.onprocessinginstruction = () => {
        // TODO: log parsing errors
    };

    parser.write(inputText);
    parser.close();

    if (stack.length !== 1 || stack[0] !== root) {
        // TODO: log parsing errors
    }

    return root;
}

function xmlEscape(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const languages = Object.fromEntries([
    'af-ZA', 'ar-XA', 'bg-BG', 'bn-IN', 'ca-ES', 'cmn-CN', 'cmn-TW', 'cs-CZ',
    'da-DK', 'de-DE', 'el-GR', 'en-US', 'en-AU', 'en-GB', 'en-IN', 'es-ES',
    'es-US', 'eu-ES', 'fi-FI', 'fil-PH', 'fr-FR', 'fr-CA', 'gl-ES', 'gu-IN',
    'he-IL', 'hi-IN', 'hu-HU', 'id-ID', 'is-IS', 'it-IT', 'ja-JP', 'kn-IN',
    'ko-KR', 'lt-LT', 'lv-LV', 'ml-IN', 'mr-IN', 'ms-MY', 'nb-NO', 'nl-NL',
    'nl-BE', 'pa-IN', 'pl-PL', 'pt-PT', 'pt-BR', 'ro-RO', 'ru-RU', 'sk-SK',
    'sr-RS', 'sv-SE', 'ta-IN', 'te-IN', 'th-TH', 'tr-TR', 'uk-UA', 'vi-VN',
    'yue-HK',
].map(l => [l.toLowerCase().replace(/[^a-z]/g, ''), l]));

function test1() {
    let inputText = `
        < speak xml:lang="pl-PL" >
        <p><strong>Witaj!
        
        z</p>
        <lang xml:lang="en-PL">Hello!</lang>
        </speak>
        <speak><lang xml:lang="ja-JP">お母さんは猫を飼っています。</lang></speak>
        <speak>Czwarta liczba pierwsza pomnożona przez <say-as interpret-as="digits">2</say-as> to <say-as interpret-as="digits">14</say-as>.</speak>
        <speak>Oto przykład prostego kodu w Pythonie, który oblicza sumę liczb od jeden do sto.</speak> <speak>Możesz użyć funkcji <break time="300ms"/> sum<break time="300ms"/> z <break time="300ms"/> funkcją <break time="300ms"/> range<break time="300ms"/> w następujący sposób:</speak> <speak>sum(range(1, 101))</speak> <speak>To zwróci sumę tych liczb.</speak>
        `;

    console.log(processMessage(inputText, false));
}


function test2() {
    let inputText = `
        Witaj **świecie**!
        To jest lista:
        - raz
        - dwa
        1. raz
        2. dwa
        3. trzy
        {{en}} The exception occured in the code.
        `;

    console.log(processMessage(inputText, true));
}


//test1();
//test2();

