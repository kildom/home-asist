
import * as fs from 'node:fs';


export function ignoreErrors(func: (...args: any) => any) {
    try {
        func();
    } catch (e) { }
}

interface WaitMultipleResultInfoWithError<T> {
    key: keyof T;
    promise: Promise<any>;
    promises: T;
    error?: any;
}

type WaitMultipleResultWithError<T extends { [key: string]: Promise<any> }> = WaitMultipleResultInfoWithError<T> & {
    [K in keyof T]?: T[K] extends Promise<infer U> ? U : never;
};

interface WaitMultipleResultInfo<T> {
    key: keyof T;
    promise: Promise<any>;
    promises: T;
}

type WaitMultipleResult<T extends { [key: string]: Promise<any> }> = WaitMultipleResultInfo<T> & {
    [K in keyof T]?: T[K] extends Promise<infer U> ? U : never;
};

export function waitMultiple<T extends { [key: string]: Promise<any> }>(promises: T, catchError: true): Promise<WaitMultipleResultWithError<T>>;
export function waitMultiple<T extends { [key: string]: Promise<any> }>(promises: T, catchError?: false): Promise<WaitMultipleResult<T>>;
export function waitMultiple<T extends { [key: string]: Promise<any> }>(promises: T, catchError?: boolean): any {
        return new Promise<WaitMultipleResult<T>>((resolve, reject) => {

        interface WrapperType {
            key: keyof T;
            error: boolean;
            result: any;
            promise: Promise<any>;
        }

        let racePromises: Promise<any>[] = [];
        for (let [key, promise] of Object.entries(promises)) {
            racePromises.push(
                promise
                    .then((result: any) => {
                        return { key, result, promise, error: false };
                    })
                    .catch((err: any) => {
                        return { key, result: err, promise, error: true };
                    })
            );
        }

        Promise.race(racePromises)
            .then((wrapperResult: WrapperType) => {
                if (wrapperResult.error && !catchError) {
                    reject(wrapperResult.result);
                    return;
                }
                let result: any = {
                    key: wrapperResult.key,
                    promises: promises,
                    promise: wrapperResult.promise,
                };
                if (wrapperResult.error) {
                    result.error = wrapperResult.result ?? new Error();
                    resolve(result);
                } else {
                    result[wrapperResult.key] = wrapperResult.result;
                    resolve(result);
                }
            });

    });
}


interface DelayPromise extends Promise<void> {
    cancelDelay(): void;
    resetDelay(ms: number): void;
};

export function delay(ms: number): DelayPromise {
    let timeout: any;
    let promise = new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, ms);
    });
    (promise as any).cancelDelay = () => {
        clearTimeout(timeout);
    }
    return promise as any;
}

const daysOfWeek = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

export function chatTime(date: Date) {
    let year = date.getFullYear();
    let month = (date.getMonth() + 1).toString().padStart(2, '0');
    let day = date.getDate().toString().padStart(2, '0');
    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');
    let seconds = date.getSeconds().toString().padStart(2, '0');
    let dayOfWeek = daysOfWeek[date.getDay()];
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}, ${dayOfWeek}`;
}

export function createDebugID(withDate: boolean): string {
    let result = '';
    if (withDate) {
        let date = new Date();
        let year = date.getFullYear();
        let month = (date.getMonth() + 1).toString().padStart(2, '0');
        let day = date.getDay().toString().padStart(2, '0');
        let hours = date.getHours().toString().padStart(2, '0');
        let minutes = date.getMinutes().toString().padStart(2, '0');
        let seconds = date.getSeconds().toString().padStart(2, '0');
        result = `${year}${month}${day}T${hours}${minutes}${seconds}-`;
    }
    return result + Math.random().toString(36).toUpperCase().substring(2, 8) + Math.random().toString(36).toUpperCase().substring(2, 8);
}

export function dumpData(data: any, ...ids: string[]) {
    let file = '_debug/' + ids.join('-') + '.json';
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}
