import { z } from "zod"
import { RevertFlags, Toolkit, ToolResult, ToolState } from "../toolkit";
import { Chat } from "../chat";
import { chatTime } from "../common";

const currentDateTimePrompt = 'Aktualna data i czas: ';

export const end_chat = z.null().describe('function end_chat');
export const fallback_function = z.null().describe('function fallback_function');

export const set_intelligence = z.object({
    intelligent: z.boolean(),
}).describe('function set_intelligence');

export const debug_mark_chat = z.object({
    note: z.string(),
}).describe('function debug_mark_chat');


export class ChatManager extends Toolkit {

    public constructor(chat: Chat) {
        super(chat, 'chat-manager');
    }

    public onRegister(): null {
        this.addTool(end_chat, this.endChat);
        this.addTool(set_intelligence, this.setIntelligence);
        this.addTool(debug_mark_chat, this.markChat);
        this.addTool(fallback_function, this.fallbackFunction, ToolState.Hidden, 100);
        return null;
    }

    public onQuery(): void | Promise<void> {
        this.chat.setToolkitMessage(currentDateTimePrompt + chatTime(new Date()), {
            toolkit: this,
            tag: 'current-date-time',
        });
    }

    private endChat(): ToolResult {
        this.player.system('Asystent zakończył rozmowę.');
        this.chat.stop();
        return RevertFlags.Query;
    }

    private setIntelligence({ intelligent }: z.infer<typeof set_intelligence>): ToolResult {
        console.log('Model:', intelligent ? 'smarter' : 'standard');
        if (intelligent !== this.chat.smarter) {
            this.player.system(intelligent ? 'Model inteligentny.' : 'Model standardowy.');
            this.chat.smarter = intelligent;
            return RevertFlags.Response;
        } else {
            return 'OK';
        }
    }

    private markChat({ note }: z.infer<typeof debug_mark_chat>): ToolResult {
        this.player.system('{{en}} Debug marker');
        this.player.system(note);
        return 'OK';
    }

    private fallbackFunction(): ToolResult {
        this.player.system('Asystent wywołał nieznaną funkcję.');
        return {
            status: 'error',
            message: 'Unknown function called',
        };
    }
}
