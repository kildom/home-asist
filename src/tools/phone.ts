import { z } from "zod"
import { Toolkit, ToolResult } from "../toolkit";
import { Chat } from "../chat";


export const send_message = z.object({
    message: z.string(),
    user_name: z.string(),
}).describe('function send_message');


export const userConfigSchema = z.object({
    number: z.string().describe('User phone number'),
    apiKey: z.string().describe('User CallMeBot API key'),
}).optional();

export class Phone extends Toolkit {

    public constructor(chat: Chat) {
        super(chat, 'phone');
    }

    public onRegister(): null {
        this.addTool(send_message, this.sendMessage);
        return null;
    }

    private sendMessage({ message, user_name }: z.infer<typeof send_message>): ToolResult | Promise<ToolResult> {
        this.player.system('Wysłano wiadomość do użytkownika: ');
        this.player.system(user_name, false);
        console.log('Sending message to user:', user_name, '=>', message);
        return 'OK';
    }
}
