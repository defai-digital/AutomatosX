export declare abstract class milliseconds {
    protected opaque: any;
}
export declare abstract class seconds {
    protected opaque: any;
}
export type t<unit> = number;
export declare const fromMilliseconds: (ms: number) => t<milliseconds>;
export declare const fromSeconds: (sec: number) => t<seconds>;
export declare const nowMilliseconds: () => t<milliseconds>;
export declare const nowSeconds: () => t<seconds>;
export declare const millisecondsToSeconds: (ms: t<milliseconds>) => t<seconds>;
export declare const secondsToMilliseconds: (sec: t<seconds>) => t<milliseconds>;
export declare const compareSeconds: (a: t<seconds>, b: t<seconds>) => number;
export declare const compareMilliseconds: (a: t<milliseconds>, b: t<milliseconds>) => number;
export declare const Seconds_add: (a: t<seconds>, b: t<seconds>) => t<seconds>;
export declare const Seconds_subtract: (a: t<seconds>, b: t<seconds>) => t<seconds>;
export declare const Seconds_toInt: (ts: t<seconds>) => number;
export declare const Seconds_fromInt: (i: number) => t<seconds>;
export declare const Milliseconds_add: (a: t<milliseconds>, b: t<milliseconds>) => t<milliseconds>;
export declare const Milliseconds_subtract: (a: t<milliseconds>, b: t<milliseconds>) => t<milliseconds>;
export declare const Milliseconds_toInt: (ts: t<milliseconds>) => number;
export declare const Milliseconds_fromInt: (i: number) => t<milliseconds>;
export declare const toDbInt: (ts: t<seconds>) => number;
export declare const fromDbInt: (i: number) => t<seconds>;
export declare const toJsDate: (ts: t<seconds>) => Date;
export declare const fromJsDate: (date: Date) => t<seconds>;
export declare const isValidSeconds: (ts: t<seconds>) => boolean;
export declare const isValidMilliseconds: (ts: t<milliseconds>) => boolean;
export declare const toIsoString: (ts: t<seconds>) => string;
export declare const Milliseconds: {
    subtract: (a: t<milliseconds>, b: t<milliseconds>) => t<milliseconds>;
    toInt: (ts: t<milliseconds>) => number;
    add: (a: t<milliseconds>, b: t<milliseconds>) => t<milliseconds>;
    fromInt: (i: number) => t<milliseconds>;
};
export declare const Seconds: {
    subtract: (a: t<seconds>, b: t<seconds>) => t<seconds>;
    toInt: (ts: t<seconds>) => number;
    add: (a: t<seconds>, b: t<seconds>) => t<seconds>;
    fromInt: (i: number) => t<seconds>;
};
//# sourceMappingURL=Timestamp.gen.d.ts.map