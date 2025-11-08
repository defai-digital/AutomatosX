import * as StateMachine from '../../../packages/rescript-core/src/runtime/StateMachine.bs.js';
const toGuardVerdict = (config) => {
    if (!config || config.kind === 'allow') {
        return StateMachine.allowGuards();
    }
    return StateMachine.blockGuards(config.reason ?? 'blocked-by-test');
};
export const buildGuardContext = (overrides = {}) => {
    const { dependenciesReady, telemetryPending, cancellationRequested, } = overrides;
    const guardVerdict = overrides.guardVerdict != null ? toGuardVerdict(overrides.guardVerdict) : undefined;
    return StateMachine.makeContext(dependenciesReady, guardVerdict, telemetryPending, cancellationRequested, undefined);
};
//# sourceMappingURL=guardFixtureFactory.js.map