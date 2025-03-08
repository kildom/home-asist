import { z } from "zod"
import { functionTool, ToolArgsInfer, Toolkit, ToolPrototype, ToolResult } from "../toolkit";


const sendMessageProto = {

    name: 'send_message',

    description: 'Funkcja wysyła wiadomość lub URL do telefonu użytkownika. Funckja wymaga nazwy użytkownika, ' +
        'więc zapytaj jeżeli jeszcze nie znasz. Liczby i numery wysyłaj w formie cyfrowej, nie używaj formy słownej.',

    args: z.object({
        message: z.string().describe('Wiadomość lub URL do wysłania.'),
        user_name: z.string().describe('Nazwa użytkownika. Właściciel telefonu.'),
    }),
};

export const userConfigSchema = z.object({
    number: z.string().describe('User phone number'),
    apiKey: z.string().describe('User CallMeBot API key'),
}).optional();

export class Phone extends Toolkit {

    public onRegister(): void | Promise<void> {
        this.chat.addTool(functionTool(sendMessageProto, this, this.sendMessage));
    }

    private sendMessage(args: ToolArgsInfer<typeof sendMessageProto>): ToolResult | Promise<ToolResult> {
        return 'OK';
    }
}
