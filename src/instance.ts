import { Chat } from "./chat";
import { SoundPlayer } from "./player";

export class Instance {

    public chat: Chat;
    public player: SoundPlayer

    constructor() {
        this.chat = new Chat(this);
        this.player = new SoundPlayer();
    }

}

