import EventEmitter from "node:events";
import { Recorder } from "./recorder";
import { create as createRecorder } from "./recorder-node";
import * as config from "./config";
import { SoundPlayer } from "./player";

export class Instance extends EventEmitter<{
    audio: [data: Int16Array];
}> {
    
    private recorder: Recorder;
    private recorderRetryCounter: number = 0;
    public player = new SoundPlayer(this);

    public constructor() {
        super();
        this.recorder = createRecorder();
        this.recorder.onData = (data) => {
            if (data.length > 0) {
                this.recorderRetryCounter = 0;
                this.emit('audio', data);
            }
        }
        this.recorder.onError = (err) => {
            console.error('Recorder error', err);
        };
        this.recorder.onStopped = () => {
            if (this.recorderRetryCounter < config.recorder.maxReconnectCount) {
                this.recorderRetryCounter++;
                this.recorder.stop();
                this.recorder = createRecorder();
                this.recorder.start();
            } else {
                console.error('Recorder stopped'); // TODO: handle this
            }
        };
    }

    public start() {
        this.recorder.start();
    }
}
