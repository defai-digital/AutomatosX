import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { FeatureFlagManager } from '@/core/feature-flags/flag-manager.js';

const TMP_ROOT = resolve('tmp');

describe('FeatureFlagManager', () => {
  let workspace: string;
  let manager: FeatureFlagManager;

  beforeEach(async () => {
    await mkdir(TMP_ROOT, { recursive: true });
    workspace = await mkdtemp(join(TMP_ROOT, 'flag-manager-'));
    manager = new FeatureFlagManager(workspace);
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('persists and evaluates flags with overrides and kill switch', async () => {
    manager.defineFlag({
      name: 'beta_ui',
      description: 'beta flag',
      enabled: true
    });

    const storagePath = join(workspace, '.automatosx', 'feature-flags.json');
    expect(existsSync(storagePath)).toBe(true);
    expect(manager.isEnabled('beta_ui')).toBe(true);

    // Environment override forces disable
    process.env.FEATURE_BETA_UI = 'false';
    expect(manager.isEnabled('beta_ui')).toBe(false);
    delete process.env.FEATURE_BETA_UI;

    // Kill switch persists and disables
    await manager.killSwitch('beta_ui', 'incident');
    expect(manager.isEnabled('beta_ui')).toBe(false);
    expect(manager.getFlag('beta_ui')?.killSwitch?.enabled).toBe(true);
  });

  it('enforces gradual rollout rules and minimum duration', async () => {
    const now = Date.now();
    manager.defineFlag({
      name: 'slow_rollout',
      description: 'gradual rollout',
      enabled: true,
      rolloutPercentage: 10,
      lastUpdated: now
    });

    await expect(manager.increaseRollout('slow_rollout', 90)).rejects.toThrow('Rollout increase too aggressive');

    // Ensure time-based guard triggers when last change is too recent
    manager.defineFlag({
      name: 'timed_guard',
      description: 'enforce minimum duration',
      enabled: true,
      rolloutPercentage: 20,
      lastUpdated: Date.now()
    });

    await expect(manager.increaseRollout('timed_guard', 30, { minimumDuration: 60_000 })).rejects.toThrow('Must wait');
  });
});
