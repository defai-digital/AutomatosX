import { createProviderBridge } from './provider-bridge.js';
import { createDiscussionCoordinator } from './runtime-discussion-coordinator.js';

export interface RuntimeDependencyResolversConfig {
  basePath: string;
  maxConcurrentDiscussions: number;
  maxProvidersPerDiscussion: number;
  maxDiscussionRounds: number;
}

export function createRuntimeDependencyResolvers(
  config: RuntimeDependencyResolversConfig,
) {
  const providerBridge = createProviderBridge({ basePath: config.basePath });
  const discussionCoordinator = createDiscussionCoordinator({
    maxConcurrentDiscussions: config.maxConcurrentDiscussions,
    maxProvidersPerDiscussion: config.maxProvidersPerDiscussion,
    maxDiscussionRounds: config.maxDiscussionRounds,
    providerBridge,
  });

  const providerBridgeCache = new Map<string, ReturnType<typeof createProviderBridge>>();
  providerBridgeCache.set(config.basePath, providerBridge);
  const discussionCoordinatorCache = new Map<string, ReturnType<typeof createDiscussionCoordinator>>();
  discussionCoordinatorCache.set(config.basePath, discussionCoordinator);

  const resolveProviderBridge = (requestBasePath?: string) => {
    const resolvedBasePath = requestBasePath ?? config.basePath;
    const cached = providerBridgeCache.get(resolvedBasePath);
    if (cached !== undefined) {
      return cached;
    }
    const created = createProviderBridge({ basePath: resolvedBasePath });
    providerBridgeCache.set(resolvedBasePath, created);
    return created;
  };

  const resolveDiscussionCoordinator = (requestBasePath?: string) => {
    const resolvedBasePath = requestBasePath ?? config.basePath;
    const cached = discussionCoordinatorCache.get(resolvedBasePath);
    if (cached !== undefined) {
      return cached;
    }
    const created = createDiscussionCoordinator({
      maxConcurrentDiscussions: config.maxConcurrentDiscussions,
      maxProvidersPerDiscussion: config.maxProvidersPerDiscussion,
      maxDiscussionRounds: config.maxDiscussionRounds,
      providerBridge: resolveProviderBridge(resolvedBasePath),
    });
    discussionCoordinatorCache.set(resolvedBasePath, created);
    return created;
  };

  return {
    providerBridge,
    discussionCoordinator,
    resolveProviderBridge,
    resolveDiscussionCoordinator,
  };
}
