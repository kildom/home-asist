

import { JSDOM } from 'jsdom';

const listSeparator = '\uFFFA';
const rowSeparator = '\uFFFB';
const cellSeparator = '\uFFFA';

class Converter {

    output: string[] = [];

    put(...args: string[]) {
        this.output.push(...args);
    }

    traverseChildren(node: Node): string {
        let tmp = this.output;
        this.output = [];
        node.childNodes.forEach(node => this.traverseNode(node));
        let result = this.output.join('');
        this.output = tmp;
        return result;
    }

    traverseNode(node: Node) {
        if (!node) return;

        switch (node.nodeName.toUpperCase()) {

            case '#COMMENT':
            case 'SCRIPT':
            case 'STYLE':
            case 'NOSCRIPT':
            case 'TEMPLATE':
            case 'SVG':
            case 'META':
            case 'INPUT':
            case 'LINK':
            case 'IFRAME':
                // Ignore those
                break;

            case 'BUTTON':
            case 'IMG':
            case 'PICTURE':
                // TODO: Can be implemented
                break;

            case '#TEXT':
                this.put((node.textContent ?? '').replace(/[\r\n\s]+/g, ' ')); // TODO: Escape
                break;

            default:
            case 'SUP':
            case 'EM':
            case 'B': // TODO: Bold
            case 'STRONG': // TODO: Bold
            case 'I': // TODO: Italics
            case 'SMALL':
            case 'SPAN':
            case 'LABEL':
            case 'FORM':
            case 'FIGURE':
            case 'FIGCAPTION':
            case 'THEAD':
            case 'TBODY':
            case 'ABBR':
                this.put(this.traverseChildren(node));
                break;

            case 'BR':
                this.put('<br/>'); // TODO: Maybe \ character can be used
                break;

            case 'TEXTAREA':
            case 'TABLE':
            case 'TR':
            case 'TD':
            case 'TH':
            case 'P':
            case 'CAPTION':
            case 'DIV':
            case 'HEADER':
            case 'NAV':
            case 'ASIDE':
            case 'SECTION':
            case 'SELECT':
            case 'OPTION':
            case 'MAIN':
            case 'ARTICLE':
            case 'FOOTER': {
                let inner = this.traverseChildren(node);
                inner = inner.trim();
                this.put('\n\n');
                if (inner) {
                    this.put(inner);
                    this.put('\n\n');
                }
                break;
            }

            case 'UL':
            case 'DL':
            case 'OL': {
                let [prefix, indent] = node.nodeName === 'UL' ? ['\n- ', '  '] : ['\n1. ', '   '];
                let inner = this.traverseChildren(node);
                let items = inner.split(listSeparator);
                for (let item of items) {
                    if (item.trim() === '') continue;
                    this.put(prefix);
                    this.put(item
                        .replace(/^(\s*\n)+/, '')
                        .replace(/\n/g, '\n' + indent)
                        .trimStart()
                    );
                }
                break;
            }

            case 'CITE': {
                let inner = this.traverseChildren(node);
                inner = inner.trim();
                if (inner.trim() !== '') {
                    this.put('\n\n');
                    this.put('> ');
                    this.put(inner
                        .replace(/^(\s*\n)+/, '')
                        .replace(/\n/g, '\n> ')
                        .trimStart()
                    );
                    this.put('\n\n');
                }
                break;
            }

            case 'DT':
            case 'DD': // TODO: Combine DT and DD into single item (multi-paragraph)
            case 'LI':
                this.put(listSeparator);
                this.put(this.traverseChildren(node));
                this.put(listSeparator);
                break;

            case 'H1':
            case 'H2':
            case 'H3':
            case 'H4':
            case 'H5':
            case 'H6':
            case 'H7':
            case 'H8':
            case 'H9': {
                let inner = this.traverseChildren(node);
                this.put('\n\n');
                this.put('#'.repeat(parseInt(node.nodeName[1])) + ' ' + inner.trimStart());
                this.put('\n\n');
                break;
            }

            case 'A': {
                let inner = this.traverseChildren(node);
                let url = (node as HTMLAnchorElement).href.replace('about:blank', '')
                if (!inner.trim().includes('\n')) {
                    this.put(`[${inner.trim()}](${url})`);
                } else {
                    this.put(`[${url}](${url})`);
                    this.put(inner);
                }
                break;
            }
        }
    }
}

export function html2md(html: string): string {

    const dom = new JSDOM(html);

    let conv = new Converter();
    let output = conv.traverseChildren(dom.window.document.querySelector("body") as Node);

    return output
        .replace(/[\x01-\x09\x0B- ]*\n/g, '\n')
        .replace(/\n\n\n+/g, '\n\n')
        .trim() + '\n'
        ;
}
