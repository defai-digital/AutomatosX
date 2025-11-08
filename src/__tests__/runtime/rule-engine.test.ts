import { describe, expect, it } from 'vitest'
import * as RuleEngine from '../../../packages/rescript-core/src/rules/RuleEngine.bs.js'
import * as PolicyDSL from '../../../packages/rescript-core/src/rules/PolicyDSL.bs.js'
import { runtimeStates, runtimeEvents } from './runtimeTestUtils'

// Sprint 1 Day 4: Rule Engine Tests
// Rule Evaluation Pipeline with Policy Execution

describe('Rule Engine - Policy Condition Evaluation', () => {
  it('evaluates StateIs condition correctly', () => {
    const condition = PolicyDSL.stateIsCondition('IDLE')
    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  it('evaluates EventIs condition correctly', () => {
    const condition = PolicyDSL.eventIsCondition('DEPS_READY')
    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  it('evaluates MetadataHas condition when field exists', () => {
    const condition = PolicyDSL.metadataHasCondition('taskId')
    const metadata = Object.create(null)
    metadata['taskId'] = '123'

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      metadata,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })

  it('evaluates MetadataHas condition when field is missing', () => {
    const condition = PolicyDSL.metadataHasCondition('taskId')
    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateCondition(condition, context)
    expect(result).toBe(false)
  })

  it('evaluates DependencyAvailable condition (P0 MVP always true)', () => {
    const condition = PolicyDSL.dependencyAvailableCondition('test-dep')
    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateCondition(condition, context)
    expect(result).toBe(true)
  })
})

describe('Rule Engine - Rule Evaluation', () => {
  it('passes rule when conditions are met and action is Allow', () => {
    const rule = PolicyDSL.createPolicyRule(
      'allow-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateRule(rule, context)
    expect(RuleEngine.isPassed(result)).toBe(true)
    expect(RuleEngine.evaluationResultToString(result)).toBe('RulePass')
  })

  it('fails rule when conditions are met and action is Deny', () => {
    const rule = PolicyDSL.createPolicyRule(
      'deny-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.denyAction('state is idle, operation not allowed')
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateRule(rule, context)
    expect(RuleEngine.isFailed(result)).toBe(true)
    expect(RuleEngine.evaluationResultToString(result)).toContain('RuleFail')
    expect(RuleEngine.evaluationResultToString(result)).toContain('state is idle')
  })

  it('skips rule when conditions are not met', () => {
    const rule = PolicyDSL.createPolicyRule(
      'skip-rule',
      [PolicyDSL.stateIsCondition('EXECUTING')],
      PolicyDSL.denyAction('should not reach here')
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateRule(rule, context)
    expect(RuleEngine.isPassed(result)).toBe(true) // Skipped rules pass
  })

  it('evaluates Require action when metadata satisfies requirement', () => {
    const rule = PolicyDSL.createPolicyRule(
      'require-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.requireAction('authToken')
    )

    const metadata = Object.create(null)
    metadata['authToken'] = 'abc123'

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      metadata,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateRule(rule, context)
    expect(RuleEngine.isPassed(result)).toBe(true)
  })

  it('fails Require action when metadata does not satisfy requirement', () => {
    const rule = PolicyDSL.createPolicyRule(
      'require-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.requireAction('authToken')
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const result = RuleEngine.evaluateRule(rule, context)
    expect(RuleEngine.isFailed(result)).toBe(true)
    expect(RuleEngine.evaluationResultToString(result)).toContain('requires: authToken')
  })
})

describe('Rule Engine - Policy Execution', () => {
  it('executes policy with multiple passing rules', () => {
    const rule1 = PolicyDSL.createPolicyRule(
      'rule-1',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const rule2 = PolicyDSL.createPolicyRule(
      'rule-2',
      [PolicyDSL.eventIsCondition('DEPS_READY')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy(
      'test-policy',
      '1.0.0',
      'Test policy with multiple rules',
      [rule1, rule2]
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isPassed(outcome.result)).toBe(true)
    expect(outcome.rulesEvaluated).toBe(2)
    expect(outcome.policy).toBeDefined()
  })

  it('stops execution at first failing rule', () => {
    const rule1 = PolicyDSL.createPolicyRule(
      'rule-1',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const rule2 = PolicyDSL.createPolicyRule(
      'rule-2',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.denyAction('access denied')
    )

    const rule3 = PolicyDSL.createPolicyRule(
      'rule-3',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy(
      'test-policy',
      '1.0.0',
      'Test policy with failing rule',
      [rule1, rule2, rule3]
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isFailed(outcome.result)).toBe(true)
    expect(outcome.rulesEvaluated).toBe(2) // Should stop after rule2
    expect(outcome.reason).toBeDefined()
    expect(outcome.reason).toContain('access denied')
  })

  it('returns pass when no policy is provided', () => {
    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      undefined,
      undefined
    )

    const outcome = RuleEngine.execute(context)

    expect(RuleEngine.isPassed(outcome.result)).toBe(true)
    expect(outcome.rulesEvaluated).toBe(0)
    expect(outcome.policy).toBeUndefined()
  })

  it('converts evaluation outcome to string for logging', () => {
    const rule = PolicyDSL.createPolicyRule(
      'test-rule',
      [PolicyDSL.stateIsCondition('IDLE')],
      PolicyDSL.allowAction()
    )

    const policy = PolicyDSL.createPolicy(
      'test-policy',
      '1.0.0',
      'Test policy',
      [rule]
    )

    const context = RuleEngine.createExecutionContext(
      runtimeStates.idle,
      runtimeEvents.dependenciesReady,
      undefined,
      policy,
      undefined
    )

    const outcome = RuleEngine.execute(context)
    const outcomeStr = RuleEngine.outcomeToString(outcome)

    expect(outcomeStr).toContain('Outcome')
    expect(outcomeStr).toContain('test-policy@1.0.0')
    expect(outcomeStr).toContain('evaluated=1')
    expect(outcomeStr).toContain('result=RulePass')
  })
})
