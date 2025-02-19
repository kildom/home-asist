import { ChatCompletionMessageToolCall } from "openai/resources/index.mjs";
import { Chat } from "../chat";
import { Instance } from "../instance";
import { AssistantModule, AssistantModuleQueryItems, AssistantToolCallResult } from "../module";
import { chatTime } from "../common";
import * as config from "../config";
import { TextSoundItem } from "../text-to-speech";

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

function sw(state: number, name: string) {
    return { state, name };
}

let lights: { [key: string]: number } = {
    'Pole przed domem': 0,
    'Pole w ogrodzie': 0,
    'Pole przed garażem': 0,
    'Pole za garażem': 0,
    'Wiatrołap': 1,
    'Kuchnia': 0,
    'Bar': 1,
    'Jadalnia': 1,
    'Korytarz na dole': 0,
    'Korytarz na górze': 0,
    'Salon - światła jasne': 1,
    'Salon - światła normalne': 0,
    'Salon - światła ciepłe': 1,
    'Łazienka na dole': 0,
    'Łazienka na górze': 0,
    'Schody na dole': 1,
    'Sypialnia rodziców - światła jasne': 1,
    'Sypialnia rodziców - światła ciemne': 1,
    'Pokój Tereski (Teresy)': 1,
    'Pokój Uli (Urszuli)': 1,
    'Pokój Basi (Barbary)': 1,
    'Pokój Pawła': 1,
};

interface HomeStorage {
    showLightsStatus?: boolean;
}

export class Home implements AssistantModule {

    public name = 'Home';

    constructor(
        public instance: Instance
    ) { }

    onRegister(chat: Chat): void {
    }

    onQuery(chat: Chat): AssistantModuleQueryItems {
        let storage = chat.getModuleStorage<HomeStorage>(this);
        let items: AssistantModuleQueryItems = {
            tools: [{
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
            }],
            initialMessages: [
                { priority: 25, message: sensors },
            ]
        }
        //if (storage.showLightsStatus) {
            chat.removeTaggedMessages('home.lights');
            chat.messages.push({
                role: 'taggedMessage',
                tag: 'home.lights',
                message: {
                    role: 'developer',
                    content: 'Aktualny stan oświetlenia:\n' + Object.entries(lights)
                        .map(([name, value]) => `- ${name}: ${value ? 'on' : 'off'}`).join('\n'),
                },
            });
        //}
        return items;
    }

    onToolCall(chat: Chat, toolCall: ChatCompletionMessageToolCall): AssistantToolCallResult {
        let errors = '';
        let storage = chat.getModuleStorage<HomeStorage>(this);
        if (toolCall.type === 'function' && toolCall.function.name === 'toggle_light') {
            storage.showLightsStatus = true;
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
                let info = args.turn_on ? 'zapalono światła w: ' : 'zgaszono światła w:';
                for (let room of args.rooms) {
                    room = room.toLowerCase().trim().replace(/[a-z]/g, '');
                    let any = false;
                    for (let [key, value] of Object.entries(lights)) {
                        if (key.toLowerCase().replace(/[a-z]/g, '').includes(room)) {
                            lights[key] = args.turn_on ? 1 : 0;
                            info += ` ${key},`;
                        }
                        any = true;
                    }
                    if (!any) {
                        errors += `nieznany pokój: ${room}, `;
                    }
                }
                chat.instance.player.play(new TextSoundItem(info, false, true));
            } catch (err) {
                this.instance.player.play(new TextSoundItem(
                    `<speak>Asystent IA podał nieprawidłowe dane do przełączenia światła:
                    <lang xml:lang="en-US">${err?.message}</lang></speak>`,
                    true, true));
            }
            console.log(JSON.stringify(lights, null, 2));
        }
        return errors ? 'Błąd: ' + errors : 'OK';
    }

    onSerialize(chat: Chat): void {
    }

    onDeserialize(chat: Chat): void {
    }

}
