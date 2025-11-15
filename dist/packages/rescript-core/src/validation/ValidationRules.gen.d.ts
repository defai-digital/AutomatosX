import type { result as ErrorHandling_result } from '../../src/error/ErrorHandling.gen';
export declare abstract class validated {
    protected opaque: any;
}
export declare abstract class unvalidated {
    protected opaque: any;
}
export type nonEmptyString<state> = string;
export type positiveInt<state> = number;
export type nonNegativeInt<state> = number;
export type validEmail<state> = string;
export type validUrl<state> = string;
export type validatedEmbedding<state> = {
    readonly dimensions: number;
    readonly vector: number[];
    readonly model: string;
};
export type nonEmptyArray<a, state> = a[];
export type boundedArray<a, state> = {
    readonly items: a[];
    readonly minSize: number;
    readonly maxSize: number;
};
export type rangedValue<state> = {
    readonly value: number;
    readonly min: number;
    readonly max: number;
};
export type percentage<state> = number;
export type validationRule<a> = (_1: a) => ErrorHandling_result<void, string>;
export type validatedUser = {
    readonly id: nonEmptyString<validated>;
    readonly email: validEmail<validated>;
    readonly age: positiveInt<validated>;
};
export type validatedMessage = {
    readonly id: nonEmptyString<validated>;
    readonly content: nonEmptyString<validated>;
    readonly embedding: (undefined | validatedEmbedding<validated>);
    readonly tokens: nonNegativeInt<validated>;
};
export declare const nonEmptyString: (s: string) => ErrorHandling_result<nonEmptyString<validated>, string>;
export declare const positiveInt: (n: number) => ErrorHandling_result<positiveInt<validated>, string>;
export declare const nonNegativeInt: (n: number) => ErrorHandling_result<nonNegativeInt<validated>, string>;
export declare const validEmail: (email: string) => ErrorHandling_result<validEmail<validated>, string>;
export declare const validUrl: (url: string) => ErrorHandling_result<validUrl<validated>, string>;
export declare const createUnvalidatedEmbedding: (dimensions: number, vector: number[], model: string) => validatedEmbedding<unvalidated>;
export declare const validateEmbedding: (embedding: validatedEmbedding<unvalidated>, expectedDimensions: number) => ErrorHandling_result<validatedEmbedding<validated>, string>;
export declare const getEmbeddingDimensions: (embedding: validatedEmbedding<validated>) => number;
export declare const getEmbeddingVector: (embedding: validatedEmbedding<validated>) => number[];
export declare const storeEmbedding: (embedding: validatedEmbedding<validated>) => Promise<ErrorHandling_result<void, string>>;
export declare const nonEmptyArray: <a>(arr: a[]) => ErrorHandling_result<nonEmptyArray<a, validated>, string>;
export declare const boundedArray: <a>(arr: a[], minSize: number, maxSize: number) => ErrorHandling_result<boundedArray<a, validated>, string>;
export declare const rangedValue: (value: number, min: number, max: number) => ErrorHandling_result<rangedValue<validated>, string>;
export declare const getRangedValue: (ranged: rangedValue<validated>) => number;
export declare const percentage: (value: number) => ErrorHandling_result<percentage<validated>, string>;
export declare const applyRule: <a>(value: a, rule: validationRule<a>) => ErrorHandling_result<a, string>;
export declare const combineRules: <a>(value: a, rules: validationRule<a>[]) => ErrorHandling_result<a, string[]>;
export declare const validateUser: (id: string, email: string, age: number) => ErrorHandling_result<validatedUser, string[]>;
export declare const validateMessage: (id: string, content: string, embedding: (undefined | validatedEmbedding<validated>), tokens: number) => ErrorHandling_result<validatedMessage, string[]>;
export declare const unwrapString: (s: nonEmptyString<validated>) => string;
export declare const unwrapInt: (n: positiveInt<validated>) => number;
export declare const unwrapEmail: (email: validEmail<validated>) => string;
//# sourceMappingURL=ValidationRules.gen.d.ts.map