import { z } from "zod"
import { functionTool, ToolArgsInfer, Toolkit, ToolPrototype, ToolResult } from "../toolkit";
import { Chat } from "../chat";
import { chatTime } from "../common";

const currentDateTimePrompt = 'Aktualna data i czas: ';

const endChatProto = {
    name: 'end_chat',
    description: 'Funkcja kończy rozmowę. Wywołaj ją, gdy użytkownik zakończył rozmowę lub pożegnał się.',
};

const setIntelligenceProto = {
    name: 'set_intelligence',
    description: 'Funkcja zmienia model AI wykożystany w tej rozmowie. Jeżeli użytkownik poprosi, abyś była bardziej inteligentna, wywołaj tą funkcję.',
    args: z.object({
        intelligent: z.boolean().describe('true - użyj bardziej inteligentnego modelu, false - użyj standardowego modelu'),
    }),
};

const markChatProto = {
    name: 'debug_mark_chat',
    description: 'Funkcja dodaje znacznik dla developera. Wywołaj tą funckcję, jeżeli użytkownik poprosi o oznaczenie tej rozmowy w celu analizy (debugowania).',
    args: z.object({
        note: z.string().describe('Notatka, opis lub komentarz dla developera.'),
    }),
};

export class ChatManager extends Toolkit {

    public constructor(chat: Chat) {
        super(chat, 'chat-manager');
    }

    public onRegister(): null {
        this.chat.addTool(endChatProto, this, this.endChat);
        this.chat.addTool(setIntelligenceProto, this, this.setIntelligence);
        this.chat.addTool(markChatProto, this, this.markChat);
        return null;
    }

    public onQuery(): void | Promise<void> {
        this.chat.setToolkitMessage(currentDateTimePrompt + chatTime(new Date()), {
            toolkit: this,
            tag: 'current-date-time',
        });
    }

    private endChat(): ToolResult {
        this.chat.stop();
        return { revertType: 'query'};
    }

    private setIntelligence(args: ToolArgsInfer<typeof setIntelligenceProto>):ToolResult {
        console.log('Model:', args.intelligent ? 'smarter' : 'standard');
        if (args.intelligent !== this.chat.smarter) {
            this.chat.smarter = args.intelligent;
            return { revertType: 'response', stopProcessing: true };
        } else {
            return 'OK';
        }
    }

    private markChat(args: ToolArgsInfer<typeof markChatProto>): ToolResult {
        console.log('!!! Marked chat:', args.note);
        return 'OK';
    }
}
