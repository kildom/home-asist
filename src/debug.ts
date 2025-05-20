import * as fs from 'fs';
import { root } from './config';
import { file } from 'googleapis/build/src/apis/file';


export class DumpObject {

    private dir: string;
    private counter = 0;
    private start: Date;
    private startDate: string;

    constructor(tag: string) {
        let date = new Date();
        this.start = date;
        let year = date.getFullYear();
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let day = date.getDay().toString().padStart(2, '0');
        let hours = date.getHours().toString().padStart(2, '0');
        let minutes = date.getMinutes().toString().padStart(2, '0');
        let seconds = date.getSeconds().toString().padStart(2, '0');
        let hundreds = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0');
        let random = Math.random().toString(36).toUpperCase().substring(2, 6);
        this.dir = `${root}/_debug/${year}-${month}-${day}/${hours}-${minutes}-${seconds}-${hundreds}-${random}-${tag}`;
        this.startDate = `${year}-${month}-${day}`;
        if (!fs.existsSync(this.dir)) {
            fs.mkdirSync(this.dir, { recursive: true });
        }
    }

    public dump(obj: any, tag: string, idOrPath?: number | string): { id: number, path: string } {
        let counter: number;
        let filePath: string;
        if (!idOrPath) {
            this.counter++;
            idOrPath = this.counter;
        }
        if (typeof idOrPath === 'number') {
            counter = idOrPath;
            let date = new Date();
            let year = date.getFullYear();
            let month = (date.getMonth() + 1).toString().padStart(2, '0');
            let day = date.getDay().toString().padStart(2, '0');
            let hours = date.getHours().toString().padStart(2, '0');
            let minutes = date.getMinutes().toString().padStart(2, '0');
            let seconds = date.getSeconds().toString().padStart(2, '0');
            let hundreds = Math.floor(date.getMilliseconds() / 10).toString().padStart(2, '0');
            let currentDate = `${year}-${month}-${day}`;
            let prefix = counter.toString().padStart(4, '0');
            if (currentDate === this.startDate) {
                filePath = `${this.dir}/${prefix}-${hours}-${minutes}-${seconds}-${hundreds}-${tag}.json`;
            } else {
                filePath = `${this.dir}/${prefix}-${year}-${month}-${day}-${hours}-${minutes}-${seconds}-${hundreds}-${tag}.json`;
            }
        } else {
            counter = parseInt(idOrPath.substring(0, 4));
            filePath = idOrPath;
        }
        fs.writeFileSync(filePath, JSON.stringify(obj, null, 2));
        return { id: counter, path: filePath };
    }

    public progressive(tag: string): ProgressiveDump {
        return new ProgressiveDump(this, tag);
    }

}

export class ProgressiveDump {

    private start: number = Date.now();
    private path?: string;
    private data: { [key: string]: any } = {};

    constructor(
        private dumpObject: DumpObject,
        private tag: string
    ) {
        this.path = this.dumpObject.dump(this.data, this.tag).path;
    }

    public dump(obj: any) {
        let t = Date.now() - this.start + 0.001;
        while (t.toString() in this.data) t += 0.001;
        this.data[t] = obj;
        this.dumpObject.dump(this.data, this.tag, this.path).path;
    }
}
