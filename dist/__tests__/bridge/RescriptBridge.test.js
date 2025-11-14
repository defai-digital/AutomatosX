import { describe, it, expect, vi } from 'vitest';
import * as Bridge from '../../bridge/RescriptBridge';
describe('RescriptBridge - Type Guards', () => {
    it('should identify Ok result', () => {
        const result = { TAG: 'Ok', _0: 42 };
        expect(Bridge.isOk(result)).toBe(true);
        expect(Bridge.isError(result)).toBe(false);
    });
    it('should identify Error result', () => {
        const result = { TAG: 'Error', _0: 'failed' };
        expect(Bridge.isOk(result)).toBe(false);
        expect(Bridge.isError(result)).toBe(true);
    });
    it('should identify Some option', () => {
        const option = 42;
        expect(Bridge.isSome(option)).toBe(true);
        expect(Bridge.isNone(option)).toBe(false);
    });
    it('should identify None option', () => {
        const option = undefined;
        expect(Bridge.isSome(option)).toBe(false);
        expect(Bridge.isNone(option)).toBe(true);
    });
});
describe('RescriptBridge - Result Unwrapping', () => {
    it('should unwrap Ok result', () => {
        const result = Bridge.ok(42);
        expect(Bridge.unwrap(result)).toBe(42);
    });
    it('should throw when unwrapping Error result', () => {
        const result = Bridge.error('failed');
        expect(() => Bridge.unwrap(result)).toThrow('Unwrap failed');
    });
    it('should unwrap with default for Error', () => {
        const result = Bridge.error('failed');
        expect(Bridge.unwrapOr(result, 100)).toBe(100);
    });
    it('should unwrap Ok value without default', () => {
        const result = Bridge.ok(42);
        expect(Bridge.unwrapOr(result, 100)).toBe(42);
    });
    it('should get Ok value', () => {
        const result = Bridge.ok(42);
        expect(Bridge.getOk(result)).toBe(42);
    });
    it('should return undefined when getting Ok from Error', () => {
        const result = Bridge.error('failed');
        expect(Bridge.getOk(result)).toBeUndefined();
    });
    it('should get Error value', () => {
        const result = Bridge.error('failed');
        expect(Bridge.getError(result)).toBe('failed');
    });
    it('should return undefined when getting Error from Ok', () => {
        const result = Bridge.ok(42);
        expect(Bridge.getError(result)).toBeUndefined();
    });
});
describe('RescriptBridge - Result Mapping', () => {
    it('should map Ok value', () => {
        const result = Bridge.ok(42);
        const mapped = Bridge.mapResult(result, (x) => x * 2);
        expect(Bridge.unwrap(mapped)).toBe(84);
    });
    it('should not map Error value', () => {
        const result = Bridge.error('failed');
        const mapped = Bridge.mapResult(result, (x) => x * 2);
        expect(Bridge.getError(mapped)).toBe('failed');
    });
    it('should map Error', () => {
        const result = Bridge.error('failed');
        const mapped = Bridge.mapError(result, (e) => e.toUpperCase());
        expect(Bridge.getError(mapped)).toBe('FAILED');
    });
    it('should not map Ok when mapping error', () => {
        const result = Bridge.ok(42);
        const mapped = Bridge.mapError(result, (e) => e.toUpperCase());
        expect(Bridge.unwrap(mapped)).toBe(42);
    });
});
describe('RescriptBridge - Result Chaining', () => {
    it('should chain Ok results', () => {
        const result = Bridge.ok(42);
        const chained = Bridge.andThen(result, (x) => Bridge.ok(x * 2));
        expect(Bridge.unwrap(chained)).toBe(84);
    });
    it('should not chain Error results', () => {
        const result = Bridge.error('failed');
        const chained = Bridge.andThen(result, (x) => Bridge.ok(x * 2));
        expect(Bridge.getError(chained)).toBe('failed');
    });
    it('should use alternative for Error', () => {
        const result = Bridge.error('failed');
        const alternative = Bridge.orElse(result, () => Bridge.ok(100));
        expect(Bridge.unwrap(alternative)).toBe(100);
    });
    it('should not use alternative for Ok', () => {
        const result = Bridge.ok(42);
        const alternative = Bridge.orElse(result, () => Bridge.ok(100));
        expect(Bridge.unwrap(alternative)).toBe(42);
    });
});
describe('RescriptBridge - Result Matching', () => {
    it('should match Ok result', () => {
        const result = Bridge.ok(42);
        const matched = Bridge.match(result, {
            ok: (x) => `success: ${x}`,
            error: (e) => `error: ${e}`,
        });
        expect(matched).toBe('success: 42');
    });
    it('should match Error result', () => {
        const result = Bridge.error('failed');
        const matched = Bridge.match(result, {
            ok: (x) => `success: ${x}`,
            error: (e) => `error: ${e}`,
        });
        expect(matched).toBe('error: failed');
    });
});
describe('RescriptBridge - Result Promise Conversion', () => {
    it('should convert Ok result to Promise', async () => {
        const result = Bridge.ok(42);
        const promise = Bridge.toPromise(result);
        await expect(promise).resolves.toBe(42);
    });
    it('should convert Error result to rejected Promise', async () => {
        const result = Bridge.error('failed');
        const promise = Bridge.toPromise(result);
        await expect(promise).rejects.toBe('failed');
    });
    it('should convert resolved Promise to Ok result', async () => {
        const promise = Promise.resolve(42);
        const result = await Bridge.fromPromise(promise);
        expect(Bridge.unwrap(result)).toBe(42);
    });
    it('should convert rejected Promise to Error result', async () => {
        const promise = Promise.reject(new Error('failed'));
        const result = await Bridge.fromPromise(promise);
        expect(Bridge.getError(result)?.message).toBe('failed');
    });
});
describe('RescriptBridge - Option Unwrapping', () => {
    it('should unwrap Some option', () => {
        const option = Bridge.some(42);
        expect(Bridge.unwrapOption(option)).toBe(42);
    });
    it('should throw when unwrapping None', () => {
        const option = Bridge.none();
        expect(() => Bridge.unwrapOption(option)).toThrow('Option is None');
    });
    it('should unwrap with default for None', () => {
        const option = Bridge.none();
        expect(Bridge.unwrapOptionOr(option, 100)).toBe(100);
    });
    it('should unwrap Some without default', () => {
        const option = Bridge.some(42);
        expect(Bridge.unwrapOptionOr(option, 100)).toBe(42);
    });
});
describe('RescriptBridge - Option Mapping', () => {
    it('should map Some value', () => {
        const option = Bridge.some(42);
        const mapped = Bridge.mapOption(option, (x) => x * 2);
        expect(mapped).toBe(84);
    });
    it('should not map None value', () => {
        const option = Bridge.none();
        const mapped = Bridge.mapOption(option, (x) => x * 2);
        expect(mapped).toBeUndefined();
    });
});
describe('RescriptBridge - Option Chaining', () => {
    it('should chain Some options', () => {
        const option = Bridge.some(42);
        const chained = Bridge.andThenOption(option, (x) => Bridge.some(x * 2));
        expect(chained).toBe(84);
    });
    it('should not chain None options', () => {
        const option = Bridge.none();
        const chained = Bridge.andThenOption(option, (x) => Bridge.some(x * 2));
        expect(chained).toBeUndefined();
    });
    it('should use alternative for None', () => {
        const option = Bridge.none();
        const alternative = Bridge.orElseOption(option, () => Bridge.some(100));
        expect(alternative).toBe(100);
    });
    it('should not use alternative for Some', () => {
        const option = Bridge.some(42);
        const alternative = Bridge.orElseOption(option, () => Bridge.some(100));
        expect(alternative).toBe(42);
    });
});
describe('RescriptBridge - Option Matching', () => {
    it('should match Some option', () => {
        const option = Bridge.some(42);
        const matched = Bridge.matchOption(option, {
            some: (x) => `value: ${x}`,
            none: () => 'no value',
        });
        expect(matched).toBe('value: 42');
    });
    it('should match None option', () => {
        const option = Bridge.none();
        const matched = Bridge.matchOption(option, {
            some: (x) => `value: ${x}`,
            none: () => 'no value',
        });
        expect(matched).toBe('no value');
    });
});
describe('RescriptBridge - Conversions', () => {
    it('should convert Some to Ok result', () => {
        const option = Bridge.some(42);
        const result = Bridge.optionToResult(option, 'error');
        expect(Bridge.unwrap(result)).toBe(42);
    });
    it('should convert None to Error result', () => {
        const option = Bridge.none();
        const result = Bridge.optionToResult(option, 'no value');
        expect(Bridge.getError(result)).toBe('no value');
    });
    it('should convert Ok result to Some', () => {
        const result = Bridge.ok(42);
        const option = Bridge.resultToOption(result);
        expect(option).toBe(42);
    });
    it('should convert Error result to None', () => {
        const result = Bridge.error('failed');
        const option = Bridge.resultToOption(result);
        expect(option).toBeUndefined();
    });
});
describe('RescriptBridge - Array Utilities', () => {
    it('should collect Ok values', () => {
        const results = [
            Bridge.ok(1),
            Bridge.error('e1'),
            Bridge.ok(2),
            Bridge.error('e2'),
            Bridge.ok(3),
        ];
        const oks = Bridge.collectOk(results);
        expect(oks).toEqual([1, 2, 3]);
    });
    it('should collect Error values', () => {
        const results = [
            Bridge.ok(1),
            Bridge.error('e1'),
            Bridge.ok(2),
            Bridge.error('e2'),
        ];
        const errors = Bridge.collectErrors(results);
        expect(errors).toEqual(['e1', 'e2']);
    });
    it('should sequence all Ok results', () => {
        const results = [Bridge.ok(1), Bridge.ok(2), Bridge.ok(3)];
        const sequenced = Bridge.sequenceResults(results);
        expect(Bridge.unwrap(sequenced)).toEqual([1, 2, 3]);
    });
    it('should fail sequence if any Error', () => {
        const results = [Bridge.ok(1), Bridge.error('failed'), Bridge.ok(3)];
        const sequenced = Bridge.sequenceResults(results);
        expect(Bridge.getError(sequenced)).toBe('failed');
    });
    it('should collect Some values', () => {
        const options = [Bridge.some(1), Bridge.none(), Bridge.some(2), Bridge.some(3)];
        const somes = Bridge.collectSome(options);
        expect(somes).toEqual([1, 2, 3]);
    });
    it('should find first Ok result', () => {
        const results = [
            Bridge.error('e1'),
            Bridge.ok(42),
            Bridge.ok(100),
        ];
        const found = Bridge.findOk(results);
        expect(found).toBe(42);
    });
    it('should return None if no Ok result found', () => {
        const results = [
            Bridge.error('e1'),
            Bridge.error('e2'),
        ];
        const found = Bridge.findOk(results);
        expect(found).toBeUndefined();
    });
    it('should find first Some option', () => {
        const options = [Bridge.none(), Bridge.some(42), Bridge.some(100)];
        const found = Bridge.findSome(options);
        expect(found).toBe(42);
    });
});
describe('RescriptBridge - Validation', () => {
    it('should validate successful predicate', () => {
        const result = Bridge.validate(42, (x) => x > 0, 'must be positive');
        expect(Bridge.unwrap(result)).toBe(42);
    });
    it('should validate failed predicate', () => {
        const result = Bridge.validate(-1, (x) => x > 0, 'must be positive');
        expect(Bridge.getError(result)).toBe('must be positive');
    });
    it('should validate all successful predicates', () => {
        const validators = [
            { predicate: (x) => x > 0, error: 'must be positive' },
            { predicate: (x) => x < 100, error: 'must be less than 100' },
        ];
        const result = Bridge.validateAll(42, validators);
        expect(Bridge.unwrap(result)).toBe(42);
    });
    it('should collect all validation errors', () => {
        const validators = [
            { predicate: (x) => x > 0, error: 'must be positive' },
            { predicate: (x) => x < 100, error: 'must be less than 100' },
        ];
        const result = Bridge.validateAll(200, validators);
        expect(Bridge.getError(result)).toEqual(['must be less than 100']);
    });
});
describe('RescriptBridge - Async Utilities', () => {
    it('should map async Result Ok value', async () => {
        const resultPromise = Promise.resolve(Bridge.ok(42));
        const mapped = await Bridge.mapResultAsync(resultPromise, (x) => x * 2);
        expect(Bridge.unwrap(mapped)).toBe(84);
    });
    it('should not map async Result Error value', async () => {
        const resultPromise = Promise.resolve(Bridge.error('failed'));
        const mapped = await Bridge.mapResultAsync(resultPromise, (x) => x * 2);
        expect(Bridge.getError(mapped)).toBe('failed');
    });
    it('should chain async Results', async () => {
        const resultPromise = Promise.resolve(Bridge.ok(42));
        const chained = await Bridge.andThenAsync(resultPromise, async (x) => Bridge.ok(x * 2));
        expect(Bridge.unwrap(chained)).toBe(84);
    });
    it('should collect all async Ok results', async () => {
        const promises = [
            Promise.resolve(Bridge.ok(1)),
            Promise.resolve(Bridge.ok(2)),
            Promise.resolve(Bridge.ok(3)),
        ];
        const result = await Bridge.allResults(promises);
        expect(Bridge.unwrap(result)).toEqual([1, 2, 3]);
    });
    it('should fail if any async result is Error', async () => {
        const promises = [
            Promise.resolve(Bridge.ok(1)),
            Promise.resolve(Bridge.error('failed')),
            Promise.resolve(Bridge.ok(3)),
        ];
        const result = await Bridge.allResults(promises);
        expect(Bridge.getError(result)).toBe('failed');
    });
});
describe('RescriptBridge - Retry', () => {
    it('should succeed on first attempt', async () => {
        const fn = vi.fn(async () => Bridge.ok(42));
        const result = await Bridge.retry(fn, { maxAttempts: 3 });
        expect(Bridge.unwrap(result)).toBe(42);
        expect(fn).toHaveBeenCalledTimes(1);
    });
    it('should retry on failure and succeed', async () => {
        let attempts = 0;
        const fn = vi.fn(async () => {
            attempts++;
            return attempts === 3 ? Bridge.ok(42) : Bridge.error('failed');
        });
        const result = await Bridge.retry(fn, { maxAttempts: 5 });
        expect(Bridge.unwrap(result)).toBe(42);
        expect(fn).toHaveBeenCalledTimes(3);
    });
    it('should return last error after max attempts', async () => {
        const fn = vi.fn(async () => Bridge.error('failed'));
        const result = await Bridge.retry(fn, { maxAttempts: 3 });
        expect(Bridge.getError(result)).toBe('failed');
        expect(fn).toHaveBeenCalledTimes(3);
    });
    it('should call onRetry callback', async () => {
        const onRetry = vi.fn();
        const fn = async () => Bridge.error('failed');
        await Bridge.retry(fn, { maxAttempts: 3, onRetry });
        expect(onRetry).toHaveBeenCalledTimes(2); // Called between attempts, not after last
    });
    it('should delay between retries', async () => {
        const start = Date.now();
        const fn = async () => Bridge.error('failed');
        await Bridge.retry(fn, { maxAttempts: 3, delayMs: 50 });
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThanOrEqual(100); // 2 delays of 50ms
    });
});
//# sourceMappingURL=RescriptBridge.test.js.map