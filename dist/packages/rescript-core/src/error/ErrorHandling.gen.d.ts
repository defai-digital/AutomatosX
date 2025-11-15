import type { Promise_error as Js_Promise_error } from './Js.gen';
export type result<ok, err> = {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
};
export type daoError = {
    TAG: "NotFound";
    _0: string;
} | {
    TAG: "DatabaseError";
    _0: string;
} | {
    TAG: "ValidationError";
    _0: string;
} | {
    TAG: "ConnectionError";
    _0: string;
} | {
    TAG: "TimeoutError";
    _0: number;
} | {
    TAG: "ConstraintViolation";
    _0: string;
};
export type networkError = "Unauthorized" | "Forbidden" | {
    TAG: "RequestFailed";
    _0: number;
    _1: string;
} | {
    TAG: "NetworkTimeout";
    _0: number;
} | {
    TAG: "InvalidResponse";
    _0: string;
} | {
    TAG: "RateLimited";
    _0: number;
};
export type validationError = {
    TAG: "MissingField";
    _0: string;
} | {
    TAG: "InvalidFormat";
    _0: string;
    _1: string;
} | {
    TAG: "OutOfRange";
    _0: string;
    _1: number;
    _2: number;
} | {
    TAG: "TooLong";
    _0: string;
    _1: number;
    _2: number;
} | {
    TAG: "TooShort";
    _0: string;
    _1: number;
    _2: number;
};
export type appError = {
    TAG: "DaoError";
    _0: daoError;
} | {
    TAG: "NetworkError";
    _0: networkError;
} | {
    TAG: "ValidationError";
    _0: validationError;
} | {
    TAG: "BusinessLogicError";
    _0: string;
} | {
    TAG: "ConfigurationError";
    _0: string;
} | {
    TAG: "UnknownError";
    _0: string;
};
export type recoveryStrategy<ok, err> = "FailFast" | {
    TAG: "Retry";
    _0: number;
} | {
    TAG: "Fallback";
    _0: ok;
} | {
    TAG: "FallbackFn";
    _0: () => {
        TAG: "Ok";
        _0: ok;
    } | {
        TAG: "Error";
        _0: err;
    };
} | {
    TAG: "Ignore";
    _0: ok;
};
export declare const isOk: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}) => boolean;
export declare const isError: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}) => boolean;
export declare const getOr: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, defaultValue: ok) => ok;
export declare const getOrElse: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, fn: (() => ok)) => ok;
export declare const getErrorOr: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, defaultValue: err) => err;
export declare const map: <b, err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, fn: ((_1: ok) => b)) => {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
};
export declare const mapError: <e, err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, fn: ((_1: err) => e)) => {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: e;
};
export declare const flatMap: <b, err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, fn: ((_1: ok) => {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
})) => {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
};
export declare const chain: <T1, T2, T3>(_1: {
    TAG: "Ok";
    _0: T1;
} | {
    TAG: "Error";
    _0: T2;
}, _2: ((_1: T1) => {
    TAG: "Ok";
    _0: T3;
} | {
    TAG: "Error";
    _0: T2;
})) => {
    TAG: "Ok";
    _0: T3;
} | {
    TAG: "Error";
    _0: T2;
};
export declare const apply: <b, err, ok>(resultFn: {
    TAG: "Ok";
    _0: ((_1: ok) => b);
} | {
    TAG: "Error";
    _0: err;
}, resultValue: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}) => {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
};
export declare const fromOption: <err, ok>(opt: (undefined | ok), error: err) => {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
};
export declare const toOption: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}) => (undefined | ok);
export declare const recover: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}, strategy: recoveryStrategy<ok, err>) => {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
};
export declare const fromPromise: <err, ok>(promise: Promise<ok>, onError: ((_1: Js_Promise_error) => err)) => Promise<{
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}>;
export declare const toPromise: <err, ok>(result: {
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}) => Promise<ok>;
export declare const combine2: <a, b, err>(r1: {
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: err;
}, r2: {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
}) => {
    TAG: "Ok";
    _0: a;
    _1: b;
} | {
    TAG: "Error";
    _0: err;
};
export declare const combine3: <a, b, c, err>(r1: {
    TAG: "Ok";
    _0: a;
} | {
    TAG: "Error";
    _0: err;
}, r2: {
    TAG: "Ok";
    _0: b;
} | {
    TAG: "Error";
    _0: err;
}, r3: {
    TAG: "Ok";
    _0: c;
} | {
    TAG: "Error";
    _0: err;
}) => {
    TAG: "Ok";
    _0: a;
    _1: b;
    _2: c;
} | {
    TAG: "Error";
    _0: err;
};
export declare const combineArray: <err, ok>(results: Array<{
    TAG: "Ok";
    _0: ok;
} | {
    TAG: "Error";
    _0: err;
}>) => {
    TAG: "Ok";
    _0: ok[];
} | {
    TAG: "Error";
    _0: err;
};
export declare const daoErrorToAppError: (err: daoError) => appError;
export declare const networkErrorToAppError: (err: networkError) => appError;
export declare const validationErrorToAppError: (err: validationError) => appError;
export declare const daoErrorToString: (err: daoError) => string;
export declare const networkErrorToString: (err: networkError) => string;
export declare const validationErrorToString: (err: validationError) => string;
export declare const appErrorToString: (err: appError) => string;
//# sourceMappingURL=ErrorHandling.gen.d.ts.map