
import { z } from 'zod';
import * as fs from 'node:fs';

import * as manager from '../src/tools/chat-manager';
import * as phone from '../src/tools/phone';
import * as home from '../src/tools/home';
import * as web from '../src/tools/web';

const MULTILEVEL = false;

const list = [
    manager,
    phone,
    home,
    web,
];

function main() {
    let output: string[] = [];
    let allArgs = {};
    for (const args of list) {
        allArgs = { ...allArgs, ...args };
    }
    for (let [key, value] of Object.entries(allArgs)) {
        if ((value instanceof z.ZodObject) || (value instanceof z.ZodNull) && value.description?.match(/^function\s+([a-z0-9_]+)$/i)) {
            let m = value.description?.match(/^function\s+([a-z0-9_]+)$/i)!;
            if (key !== m[1]) {
                console.error(`Function name mismatch: ${key} !== ${m[1]}`);
                process.exit(1);
            };
            output.push(`    ${key}: {\n`);
            if ((value instanceof z.ZodObject) && Object.keys(value.shape).length > 0) {
                listProperties(output, '        ', value);
            } else {
                output.push(`        desc: string;\n`);
            }
            output.push(`    },\n`);
        }
    }
    let sourceCode = fs.readFileSync('src/config.ts', 'utf8');
    let text = `interface FunctionsConfig {\n${output.join('')}}`;
    sourceCode = sourceCode.replace(/^interface FunctionsConfig.*?^}/ms, text);
    console.log(text);
    fs.writeFileSync('src/config.ts', sourceCode);
}

function listProperties(output: string[], indent: string, value: any, ) {
    const shape = value.shape;
    output.push(`${indent}desc: string;\n`);
    for (const [key, schema] of Object.entries(shape)) {
        if (MULTILEVEL && schema instanceof z.ZodObject) {
            output.push(`${indent}${key}: string | {\n`);
            listProperties(output, `${indent}    `, schema);
            output.push(`${indent}};\n`);
        } else if (MULTILEVEL && schema instanceof z.ZodArray && schema.element instanceof z.ZodObject) {
            output.push(`${indent}${key}: string | {\n`);
            listProperties(output, `${indent}    `, schema.element);
            output.push(`${indent}};\n`);
        } else {
            output.push(`${indent}${key}: string;\n`);
        }
    }
}


main();
