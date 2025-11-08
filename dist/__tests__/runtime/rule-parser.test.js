// Sprint 1 Day 13: Rule Parser Tests
// Tests for rule parsing with condition → action format
import { describe, expect, it } from 'vitest';
import * as RuleParser from '../../../packages/rescript-core/src/rules/RuleParser.bs.js';
describe('RuleParser - Tokenization', () => {
    it('tokenizes simple literals and keywords', () => {
        const input = 'when ALWAYS then NoAction';
        const result = RuleParser.parseRuleString(input);
        // Should successfully parse (Success variant has TAG: 'Success')
        expect(result.TAG).toBe('Success');
        // Validate parsed rule structure
        const rule = result._0;
        expect(rule.metadata.name).toBe('parsed-rule');
        expect(rule.metadata.enabled).toBe(true);
        // Priority is a simple string variant "Medium", not an object with TAG
        expect(rule.priority).toBe('Medium');
    });
    it('tokenizes string literals with double quotes', () => {
        const input = 'when $state == "Preparing" then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('Comparison');
        expect(rule.condition._0.TAG).toBe('ContextRef');
        expect(rule.condition._0._0).toBe('state');
        // compareOp is a simple string variant "Equal", not an object
        expect(rule.condition._1).toBe('Equal');
        expect(rule.condition._2.TAG).toBe('StringValue');
        expect(rule.condition._2._0).toBe('Preparing');
    });
    it('tokenizes integer and float literals', () => {
        const input = 'when $retryCount == 3 then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition._2.TAG).toBe('IntValue');
        expect(rule.condition._2._0).toBe(3);
    });
    it('tokenizes context references starting with $', () => {
        const input = 'when $dependenciesReady == true then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition._0.TAG).toBe('ContextRef');
        expect(rule.condition._0._0).toBe('dependenciesReady');
    });
});
describe('RuleParser - Condition Parsing', () => {
    it('parses simple comparison conditions', () => {
        const input = 'when $state == "Executing" then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('Comparison');
        // compareOp is a simple string variant "Equal"
        expect(rule.condition._1).toBe('Equal');
    });
    it('parses NOT conditions', () => {
        const input = 'when NOT ALWAYS then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('Not');
        // Inner condition should be Always (simple string variant)
        expect(rule.condition._0).toBe('Always');
    });
    it('parses AND logical operators', () => {
        const input = 'when $state == "Preparing" AND $dependenciesReady == true then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('LogicalOp');
        // logicOp is a simple string variant "And"
        expect(rule.condition._0).toBe('And');
    });
    it('parses OR logical operators', () => {
        const input = 'when $state == "Failed" OR $state == "Canceled" then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('LogicalOp');
        // logicOp is a simple string variant "Or"
        expect(rule.condition._0).toBe('Or');
    });
    it('parses parenthesized conditions', () => {
        const input = 'when ($state == "Idle") then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        expect(rule.condition.TAG).toBe('Comparison');
    });
    it('parses ALWAYS and NEVER conditions', () => {
        const alwaysInput = 'when ALWAYS then NoAction';
        const alwaysResult = RuleParser.parseRuleString(alwaysInput);
        expect(alwaysResult.TAG).toBe('Success');
        const alwaysRule = alwaysResult._0;
        // Always is a simple string variant
        expect(alwaysRule.condition).toBe('Always');
        const neverInput = 'when NEVER then NoAction';
        const neverResult = RuleParser.parseRuleString(neverInput);
        expect(neverResult.TAG).toBe('Success');
        const neverRule = neverResult._0;
        // Never is a simple string variant
        expect(neverRule.condition).toBe('Never');
    });
});
describe('RuleParser - Complete Rule Parsing', () => {
    it('parses complete when...then rule', () => {
        const input = 'when $retryCount == 3 then ScheduleRetry';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        // Verify rule structure
        expect(rule.metadata).toBeDefined();
        expect(rule.priority).toBeDefined();
        expect(rule.condition).toBeDefined();
        expect(rule.actions).toBeDefined();
        expect(Array.isArray(rule.actions)).toBe(true);
        expect(rule.actions.length).toBeGreaterThan(0);
    });
    it('parses rule with metadata defaults', () => {
        const input = 'when ALWAYS then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Success');
        const rule = result._0;
        // Check metadata defaults
        expect(rule.metadata.name).toBe('parsed-rule');
        expect(rule.metadata.enabled).toBe(true);
        expect(rule.metadata.tags).toBeDefined();
        expect(Array.isArray(rule.metadata.tags)).toBe(true);
    });
});
describe('RuleParser - Error Handling', () => {
    it('returns error for invalid syntax', () => {
        const input = 'invalid rule syntax';
        const result = RuleParser.parseRuleString(input);
        // Should be a Failure result with TAG
        expect(result.TAG).toBe('Failure');
    });
    it('returns error for missing when keyword', () => {
        const input = '$state == "Idle" then NoAction';
        const result = RuleParser.parseRuleString(input);
        expect(result.TAG).toBe('Failure');
    });
});
//# sourceMappingURL=rule-parser.test.js.map