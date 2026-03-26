import { describe, expect, it } from 'vitest';
import { createRuntimeDependencyResolvers } from '../src/runtime-dependency-resolvers.js';

describe('runtime dependency resolvers', () => {
  it('reuses cached provider bridges and discussion coordinators per base path', () => {
    const resolvers = createRuntimeDependencyResolvers({
      basePath: '/tmp/runtime-a',
      maxConcurrentDiscussions: 1,
      maxProvidersPerDiscussion: 2,
      maxDiscussionRounds: 2,
    });

    expect(resolvers.resolveProviderBridge()).toBe(resolvers.providerBridge);
    expect(resolvers.resolveDiscussionCoordinator()).toBe(resolvers.discussionCoordinator);
    expect(resolvers.resolveProviderBridge('/tmp/runtime-a')).toBe(resolvers.providerBridge);
    expect(resolvers.resolveDiscussionCoordinator('/tmp/runtime-a')).toBe(resolvers.discussionCoordinator);
  });

  it('creates isolated provider bridges and coordinators for distinct base paths', () => {
    const resolvers = createRuntimeDependencyResolvers({
      basePath: '/tmp/runtime-a',
      maxConcurrentDiscussions: 1,
      maxProvidersPerDiscussion: 2,
      maxDiscussionRounds: 2,
    });

    const secondaryProviderBridge = resolvers.resolveProviderBridge('/tmp/runtime-b');
    const secondaryCoordinator = resolvers.resolveDiscussionCoordinator('/tmp/runtime-b');

    expect(secondaryProviderBridge).not.toBe(resolvers.providerBridge);
    expect(secondaryCoordinator).not.toBe(resolvers.discussionCoordinator);
    expect(resolvers.resolveProviderBridge('/tmp/runtime-b')).toBe(secondaryProviderBridge);
    expect(resolvers.resolveDiscussionCoordinator('/tmp/runtime-b')).toBe(secondaryCoordinator);
  });
});
