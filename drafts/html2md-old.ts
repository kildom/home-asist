

import * as fs from 'node:fs';
import { JSDOM } from 'jsdom';

const axios = require('axios');

const url = 'https://www.pizzapaolo.pl/restauracja/pizza-paolo-cholerzyn';


interface SimpleMarker {
    type: 'paragraph-separator' | 'list-separator' | 'horizontal-line' | 'line-separator';
};

interface HeadingMarker {
    type: 'heading';
    level: number;
    children: Marker[];
};

interface TextMarker {
    type: 'text';
    text: string;
};

interface LinkMarker {
    type: 'link';
    text: string;
    url: string;
};

interface ListMarker {
    type: 'list';
    ordered: boolean;
    items: Marker[][];
};

type Marker = SimpleMarker | HeadingMarker | TextMarker | LinkMarker | ListMarker;

interface State {
    output: Marker[];
    allowHeadings: boolean;
};

function traverseChildren(node: Node, state: State) {
    node.childNodes.forEach(node => traverseNode(node, state));
}

function traverseNode(node: Node, state: State) {
    let temp: Marker[] = [];
    if (!node) return;
    let output = state.output;

    switch (node.nodeName.toUpperCase()) {

        case '#COMMENT':
        case 'SCRIPT':
        case 'STYLE':
        case 'NOSCRIPT':
        case 'TEMPLATE':
        case 'SVG':
        case 'META':
            // Ignore those
            break;

        case 'BUTTON':
        case 'IMG':
            // TODO: Can be implemented
            break;

        case '#TEXT':
            //if (node.textContent?.trim()) console.log(node.textContent?.trim());
            //if (node.textContent?.trim().includes('Kamikadze')) throw new Error('Kamikadze');
            output.push({
                type: 'text',
                text: (node.textContent ?? '').replace(/[\r\n\s]+/g, ' '),
            });
            break;

        case 'STRONG': // TODO: Bold
        case 'I': // TODO: Italics
        case 'SMALL':
        case 'SPAN':
            traverseChildren(node, state);
            break;

        case 'BR':
            state.allowHeadings = false;
            output.push({ type: 'line-separator' });
            break;

        case 'SECTION':
        case 'MAIN':
        case 'ARTICLE':
        case 'FOOTER':
            state.allowHeadings = false;
            output.push({ type: 'horizontal-line' });
            traverseChildren(node, state);
            output.push({ type: 'horizontal-line' });
            break;

        case 'P':
        case 'DIV':
        case 'HEADER':
        case 'NAV':
        case 'ASIDE':
            state.allowHeadings = false;
            output.push({ type: 'paragraph-separator' });
            traverseChildren(node, state);
            output.push({ type: 'paragraph-separator' });
            break;

        case 'UL':
        case 'OL': {
            state.allowHeadings = false;
            [state.output, temp] = [temp, state.output];
            traverseChildren(node, state);
            [state.output, temp] = [temp, state.output];
            let thisItem: ListMarker = {
                type: 'list',
                ordered: node.nodeName === 'OL',
                items: [[]],
            }
            let bucket = thisItem.items[0];
            for (let item of temp) {
                if (item.type === 'list-separator') {
                    if (bucket.length > 0) {
                        bucket = [];
                        thisItem.items.push(bucket);
                    }
                } else {
                    bucket.push(item);
                }
            }
            state.output.push(thisItem);
            break;
        }

        case 'LI':
            state.allowHeadings = false;
            output.push({ type: 'list-separator' });
            traverseChildren(node, state);
            break;

        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
        case 'H7':
        case 'H8':
        case 'H9':
            output.push({ type: 'paragraph-separator' });
            [state.output, temp] = [temp, state.output];
            state.allowHeadings = true;
            traverseChildren(node, state);
            [state.output, temp] = [temp, state.output];
            if (state.allowHeadings) {
                state.allowHeadings = false;
                output.push({
                    type: 'heading',
                    level: parseInt(node.nodeName[1]),
                    children: temp,
                });
            } else {
                output.push({
                    type: 'heading',
                    level: parseInt(node.nodeName[1]),
                    children: [],
                });
                state.output.push(...temp);
            }
            output.push({ type: 'paragraph-separator' });
            break;

        case 'A':
            output.push({
                type: 'link',
                text: 'TODO',
                url: (node as HTMLAnchorElement).href.replace('about:blank', ''),
            });
            traverseChildren(node, state);
            break;

        default:
            console.error(`Unknown node type: ${node.nodeName}`);
            process.exit(1);
            break;
    }
}

async function main() {

    //let response = await axios.get(url);
    //let html = response.data;
    let html = fs.readFileSync('drafts/test.html', 'utf8');

    const dom = new JSDOM(html);

    let state: State = {
        output: [],
        allowHeadings: true,
    };

    // Start from the <body> element
    traverseChildren(dom.window.document.querySelector("body") as Node, state);

    let output: string[] = [];

    generate(output, state.output);

    fs.writeFileSync('drafts/test2.md', output.join('\n'));
    fs.writeFileSync('drafts/test2.json', JSON.stringify(state.output, null, 2));

    //console.log(state.output);

}

function generate(output: string[], markers: Marker[]) {
    let paragraph = '';
    for (let marker of [...markers, { type: 'paragraph-separator' } as SimpleMarker]) {
        switch (marker.type) {
            case 'paragraph-separator':
                paragraph = paragraph.replace(/[\s\r\n]+/g, ' ').trim();
                if (paragraph) {
                    output.push('', paragraph, '');
                }
                paragraph = '';
                break;
            case 'list-separator':
                output.push('');
                console.error('List separator not implemented');
                process.exit();
                break;
            case 'horizontal-line':
                output.push('', '---', '');
                break;
            case 'line-separator':
                paragraph += output.push('<br/>'); // TODO: Use \
                break;
            case 'heading':
                //output.push(`${'#'.repeat(marker.level)} ${prefix}`);
                //generate(output, prefix, marker.children);
                output.push('\n');
                break;
            case 'text':
                paragraph += marker.text;
                break;
            case 'link':
                paragraph += `[${marker.text}](${marker.url})`;
                break;
            case 'list':
                output.push('');
                for (let item of marker.items) {
                    output.push(marker.ordered ? '1. ' : ' - ');
                    let itemOutput: string[] = [];
                    generate(itemOutput, item);
                    itemOutput = itemOutput.map(x => '   ' + x);
                    output.push(...itemOutput, '');
                }
                break;

        }
    }
}



function traverseNode2(node: Node, state: State) {
    let temp: Marker[] = [];
    if (!node) return;
    let output = state.output;

    switch (node.nodeName.toUpperCase()) {

        case '#COMMENT':
        case 'SCRIPT':
        case 'STYLE':
        case 'NOSCRIPT':
        case 'TEMPLATE':
        case 'SVG':
        case 'META':
        case 'BR':
            // Ignore those
            break;

        case 'BUTTON':
        case 'IMG':
            // TODO: Can be implemented
            break;

        case '#TEXT':
            //if (node.textContent?.trim()) console.log(node.textContent?.trim());
            //if (node.textContent?.trim().includes('Kamikadze')) throw new Error('Kamikadze');
            output.push({
                type: 'text',
                text: (node.textContent ?? '').replace(/[\r\n\s]+/g, ' '),
            });
            break;

        case 'STRONG': // TODO: Bold
        case 'I': // TODO: Italics
        case 'SMALL':
        case 'SPAN':
            traverseChildren2(node, state);
            break;

        case 'SECTION':
        case 'MAIN':
        case 'ARTICLE':
        case 'FOOTER':
            traverseChildren2(node, state);
            break;

        case 'P':
        case 'DIV':
        case 'HEADER':
        case 'NAV':
        case 'ASIDE':
            traverseChildren2(node, state);
            break;

        case 'UL':
        case 'OL': {
            state.allowHeadings = false;
            [state.output, temp] = [temp, state.output];
            traverseChildren2(node, state);
            [state.output, temp] = [temp, state.output];
            let thisItem: ListMarker = {
                type: 'list',
                ordered: node.nodeName === 'OL',
                items: [[]],
            }
            let bucket = thisItem.items[0];
            for (let item of temp) {
                if (item.type === 'list-separator') {
                    if (bucket.length > 0) {
                        bucket = [];
                        thisItem.items.push(bucket);
                    }
                } else {
                    bucket.push(item);
                }
            }
            state.output.push(thisItem);
            break;
        }

        case 'LI':
            output.push({ type: 'list-separator' });
            traverseChildren2(node, state);
            break;

        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
        case 'H5':
        case 'H6':
        case 'H7':
        case 'H8':
        case 'H9':
            traverseChildren2(node, state);
            break;

        case 'A':
            traverseChildren2(node, state);
            break;

        default:
            console.error(`Unknown node type: ${node.nodeName}`);
            process.exit(1);
            break;
    }
}

function traverseChildren2(node: Node, state: State) {
    node.childNodes.forEach(node => traverseNode2(node, state));
}



async function main2() {
    let html = fs.readFileSync('drafts/test.html', 'utf8');
    const dom = new JSDOM(html);
    let state: State = {
        output: [],
        allowHeadings: true,
    };
    traverseChildren2(dom.window.document.querySelector("body") as Node, state);
    fs.writeFileSync('drafts/test2.json', JSON.stringify(state.output, null, 2));
}

main();
