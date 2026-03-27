import { describe, expect, it } from 'vitest';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import { buildDoctorCommandData } from '../src/commands/doctor.js';

describe('doctor command data builder', () => {
  it('returns the canonical governance payload without a legacy alias', () => {
    const data = buildDoctorCommandData({
      basePath: '/tmp/doctor-data-default',
      status: 'warning',
      checks: [],
      summary: { ok: 0, warn: 1, fail: 0 },
      governance: RuntimeGovernanceAggregateSchema.parse({
        blockedCount: 1,
        latest: {
          traceId: 'doctor-builder-001',
          summary: 'Runtime governance blocked step "run-skill".',
          failedGates: [],
          failedGateMessages: [],
          blockedByRuntimeGovernance: true,
        },
        deniedImportedSkills: {
          deniedCount: 0,
        },
      }),
      deniedInstalledBridges: {
        deniedCount: 0,
      },
    });

    expect(data.governance).toMatchObject({
      blockedCount: 1,
      latest: {
        traceId: 'doctor-builder-001',
      },
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(data.deniedInstalledBridges).toMatchObject({
      deniedCount: 0,
    });
    expect('governance' in data).toBe(true);
  });
});
