import { z } from "zod"
import { RevertFlags, Tool, Toolkit, ToolResult, ToolState } from "../toolkit";
import { Chat } from "../chat";

export const home_access = z.null().describe('function home_access');

export const switch_light = z.object({
    rooms: z.string().array(),
    turn_on: z.boolean(),
}).describe('function switch_light');

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

export class Home extends Toolkit {

    private homeAccessTool!: Tool;
    private switchLightTool!: Tool;
    private active = false;

    public constructor(chat: Chat) {
        super(chat, 'home');
    }

    public onRegister(): null {
        this.homeAccessTool = this.addTool(home_access, this.homeAccess, ToolState.Dynamic);
        this.switchLightTool = this.addTool(switch_light, this.switchLight, ToolState.DynamicHidden);
        return null;
    }

    public onQuery(): void | Promise<void> {
        console.log('--- home on query ---', this.active);
        if (this.active) {
            this.updateMessage();
        }
    }

    private updateMessage(): void {
        let stateMessage = sensors.trim();
        stateMessage += '\n\nStan świateł:';
        for (let [room, state] of Object.entries(lights)) {
            stateMessage += `\n- ${room}: ${state}`;
        }
        console.log(stateMessage);
        this.chat.setToolkitMessage(stateMessage, {
            toolkit: this,
            tag: 'home',
        });
    }

    private homeAccess(): ToolResult | Promise<ToolResult> {
        this.active = true;
        this.homeAccessTool.hidden = true;
        this.switchLightTool.hidden = false;
        this.updateMessage();
        this.player.system('Włączam dostęp do domu.');
        console.log('---Włączam dostęp do domu.');
        return RevertFlags.Response;
    }

    private switchLight({ rooms, turn_on }: z.infer<typeof switch_light>): ToolResult | Promise<ToolResult> {
        let errors: string[] = [];
        let valid = new Set<string>();
        for (let room of rooms) {
            let names = this.getRoomNames(room);
            if (names.length === 0) {
                errors.push(room);
            } else {
                for (let name of names) {
                    valid.add(name);
                }
            }
        }
        if (errors.length > 0) {
            this.player.system('Asystent podał nieznane pokoje:');
            this.player.system(errors.join(', '), false);
            console.log('Nieznane pokoje:', errors.join(', '));
            return 'Unknown locations: ' + errors.join(', ');
        }
        if (turn_on) {
            this.player.system('Włączam światło w ');
        } else {
            this.player.system('Wyłączam światło w ');
        }
        this.player.system([...valid].join(', '));
        console.log('Światło', turn_on ? 'włączone w' : 'wyłączone w', [...valid].join(', '));
        for (let name of valid) {
            lights[name] = turn_on ? 1 : 0;
        }
        this.updateMessage();
        return 'OK';
    }

    private getRoomNames(room: string):string[] {
        let names:string[] = [];
        room = room.toLowerCase().replace(/[^a-z]/g, '')
        for (let realName in lights) {
            if (realName.toLowerCase().replace(/[^a-z]/g, '').includes(room)) {
                names.push(realName);
            }
        }
        return names;
    }
}
