import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachineV2.bs.js'

type GuardVerdictConfig =
  | { kind: 'allow' }
  | { kind: 'block'; reason?: string }

export type GuardContextOverrides = {
  dependenciesReady?: boolean
  telemetryPending?: boolean
  cancellationRequested?: boolean
  guardVerdict?: GuardVerdictConfig
}

const toGuardVerdict = (config?: GuardVerdictConfig) => {
  if (!config || config.kind === 'allow') {
    return StateMachine.allowGuards()
  }

  return StateMachine.blockGuards(config.reason ?? 'blocked-by-test')
}

export const buildGuardContext = (overrides: GuardContextOverrides = {}) => {
  const {
    dependenciesReady,
    telemetryPending,
    cancellationRequested,
  } = overrides

  const guardVerdict =
    overrides.guardVerdict != null ? toGuardVerdict(overrides.guardVerdict) : undefined

  return StateMachine.makeContext(
    dependenciesReady,
    guardVerdict,
    telemetryPending,
    cancellationRequested,
    undefined,
  )
}
