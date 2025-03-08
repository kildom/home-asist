
import fs from 'node:fs';
import { z } from 'zod';

const userConfigSchema = z.object({
    name: z.string()
        .describe('Nazwa użytkownika'),
    aliases: z.array(z.string())
        .describe('Alternatywne nazwy użytkownika')
        .optional(),
    phone: z.string()
        .describe('Numer telefonu')
        .optional(),
    callMeBotApiKey: z.string()
        .describe('Klucz API CallMeBot; Send Whatsapp Message "I allow callmebot to send me messages" to +34 684 72 39 62.')
        .optional(),
});

type UserConfig = z.infer<typeof userConfigSchema>;


class User {

    public name: string;
    public aliases: string[];
    public phone: string;
    public callMeBotApiKey: string;

    constructor() {
        this.name = 'Dominik';
        this.aliases = ['tata'];
        this.phone = Object.keys(JSON.parse(fs.readFileSync('drafts/callmebot-api-key.json', 'utf8')))[0];
        this.callMeBotApiKey = Object.values(JSON.parse(fs.readFileSync('drafts/callmebot-api-key.json', 'utf8')))[0] as any;
    }

}
