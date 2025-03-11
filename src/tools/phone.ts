import { z } from "zod"
import { functionTool, ToolArgsInfer, Toolkit, ToolPrototype, ToolResult } from "../toolkit";
import { Chat } from "../chat";


const sendMessageProto = {

    name: 'send_message',

    description: 'Funkcja wysyła wiadomość lub URL do telefonu użytkownika. Funckja wymaga nazwy użytkownika, ' +
        'więc zapytaj jeżeli jeszcze nie znasz.',

    args: z.object({
        message: z.string().describe('Wiadomość lub URL do wysłania. Liczby i numery zapisuj cyfrowo, nie używaj formy słownej.'),
        user_name: z.string().describe('Nazwa użytkownika. Właściciel telefonu.'),
    }),
};

export const userConfigSchema = z.object({
    number: z.string().describe('User phone number'),
    apiKey: z.string().describe('User CallMeBot API key'),
}).optional();

export class Phone extends Toolkit {

    public constructor(chat: Chat) {
        super(chat, 'phone');
    }

    public onRegister(): null {
        this.chat.addTool(sendMessageProto, this, this.sendMessage);
        return null;
    }

    private sendMessage(args: ToolArgsInfer<typeof sendMessageProto>): ToolResult | Promise<ToolResult> {
        console.log('Sending message to user:', args.user_name, '=>', args.message);
        return 'OK';
    }
}
