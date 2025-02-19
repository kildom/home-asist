import { Chat } from "../chat";
import { Instance } from "../instance";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import { TextSoundItem } from "../text-to-speech";
import OpenAI from "openai";

const sensors = `
Wskazania czujników temperatury i wilgotności:
- Kuchnia: 22°C, 45%
- Salon: 23°C, 50%
- Sypialnia rodziców: 21°C, 40%
- Pokój Tereski (Teresy): 21°C, 40%
- Pokój Uli (Urszuli): 21°C, 40%
- Pokój Basi (Barbary): 21°C, 40%
- Pokój Pawła: 21°C, 40%
- Gabinet: 21°C, 40%
- Łazienka na dole: 24°C, 55%
- Łazienka na górze: 23°C, 50%
- Garaż: 15°C, 60%
- Piwnica: 18°C, 70%
- Pole: 5°C, 76%
- Piec: 71°C
- Ogrzewanie podłogowe (podłogówka) na dole: 31°C
- Ogrzewanie podłogowe (podłogówka) na górze: 35°C
- C.W.U (ciepła woda użytkowa, woda w kranie): 56°C
`;

let lights: { [key: string]: number } = {
    'Pole przed domem': 0,
    'Pole w ogrodzie': 0,
    'Pole przed garażem': 0,
    'Pole za garażem': 0,
    'Pole - taras': 0,
    'Wiatrołap': 1,
    'Kuchnia': 0,
    'Bar': 1,
    'Jadalnia': 1,
    'Korytarz na dole': 0,
    'Korytarz na górze': 0,
    'Salon - światło jasne': 1,
    'Salon - światło normalne': 0,
    'Salon - światło słabe': 1,
    'Łazienka na dole': 0,
    'Łazienka na górze': 0,
    'Schody': 1,
    'Sypialnia rodziców - światło jasne': 1,
    'Sypialnia rodziców - światło słabe': 1,
    'Pokój Tereski (Teresy)': 1,
    'Pokój Uli (Urszuli)': 1,
    'Pokój Basi (Barbary)': 1,
    'Pokój Pawła': 1,
};

interface HomeStorage {
    expandTools?: boolean;
}

export class Home extends AssistantModule {

    constructor(chat: Chat) {
        super(chat, 'Home');
    }

    public onQuery(): undefined | AssistantModuleQueryItems | Promise<undefined | AssistantModuleQueryItems> {
        let storage = this.chat.getModuleStorage<HomeStorage>(this);
        let items: AssistantModuleQueryItems = {
            tools: [],
        }
        if (storage.expandTools) {
            this.chat.removeTaggedMessages('home.lights');
            this.chat.messages.push({
                role: 'taggedMessage',
                tag: 'home.lights',
                message: {
                    role: 'developer',
                    content: 'Aktualny stan oświetlenia:\n' + Object.entries(lights)
                        .map(([name, value]) => `- ${name}: ${value ? 'on' : 'off'}`).join('\n'),
                },
            });
            items.tools!.push({
                type: 'function',
                function: {
                    name: 'toggle_light',
                    description: 'Funkcja zapala i gasi światło w określonych pomieszczeniach w domu. Zawsze wykonuj tą funkcję, jeżeli rozmówca poprosi o przełączenie światła.',
                    parameters: {
                        type: 'object',
                        required: [
                            'rooms',
                            'turn_on'
                        ],
                        properties: {
                            rooms: {
                                type: 'array',
                                items: {
                                    type: 'string',
                                    description: 'Nazwa pomieszczenia'
                                },
                                description: 'Lista pomieszczeń, w których ma być zapalone lub zgaszone światło'
                            },
                            turn_on: {
                                type: 'boolean',
                                description: 'Parametr mówiący, czy światło ma się zapalić (true) lub zgasić (false)'
                            }
                        },
                        additionalProperties: false
                    },
                    strict: true
                }
            });
            items.initialMessages = [
                { priority: 25, message: sensors},
                { priority: 26, message: 'Jeżeli użytkownik nie powiedział o które światło mu chodzi, użyj wszystkie światła w pomieszczeniu, gdzie się on znajduje.' },
            ];
        } else {
            items.tools!.push({
                type: 'function',
                function: {
                    name: 'list_lights_and_sensors',
                    description: 'Funkcja wypisuje nazwy i aktualne stany wszystkich świateł i czujników temperatury i wilgotności w domu oraz jego otoczeniu. Wywołaj ją przed przełączeniem światła.',
                    strict: false,
                }
            });
        }
        return items;
    }

    public onToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall): AssistantToolCallResult | Promise<AssistantToolCallResult> {
        let errors = '';
        let storage = this.chat.getModuleStorage<HomeStorage>(this);
        if (toolCall.type === 'function' && toolCall.function.name === 'toggle_light') {
            storage.expandTools = true;
            let args: {
                rooms?: string[],
                turn_on?: boolean,
            };
            try {
                args = JSON.parse(toolCall.function.arguments);
                if (!args.rooms?.length) {
                    errors += 'Nie podano pokoi, ';
                    throw new Error('</lang>Nie podano pokoi<lang xml:lang="en-US">');
                }
                if (!('rooms' in args)) {
                    errors += 'Nie podano czy zaświecić czy zgasić, ';
                    throw new Error('</lang>Nie podano co zrobić<lang xml:lang="en-US">');
                }
                console.log(args.turn_on, args.rooms.join(', '));
                let info = args.turn_on ? 'zapalono światła w: ' : 'zgaszono światła w:';
                for (let room of args.rooms) {
                    room = room.toLowerCase().trim().replace(/[^a-z]/g, '');
                    let any = false;
                    for (let [key, value] of Object.entries(lights)) {
                        if (key.toLowerCase().replace(/[^a-z]/g, '').includes(room)) {
                            lights[key] = args.turn_on ? 1 : 0;
                            info += ` ${key},`;
                        }
                        any = true;
                    }
                    if (!any) {
                        errors += `nieznany pokój: ${room}, `;
                    }
                }
                this.chat.instance.player.say(info);
            } catch (err) {
                this.instance.player.say(
                    `<speak>Asystent IA podał nieprawidłowe dane do przełączenia światła:
                    <lang xml:lang="en-US">${err?.message}</lang></speak>`);
            }
            console.log(JSON.stringify(lights, null, 2));
        }
        else if (toolCall.type === 'function' && toolCall.function.name === 'list_lights_and_sensors') {
            storage.expandTools = true;
            this.instance.player.say('Sprawdzanie świateł i czujników.');
            return 'Aktualny stan oświetlenia:\n' + Object.entries(lights)
                .map(([name, value]) => `- ${name}: ${value ? 'on' : 'off'}`).join('\n') + '\n' + sensors;
        }
        return errors ? 'Błąd: ' + errors : 'OK';
    }
}
