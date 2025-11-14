/**
 * Example Plugin Manager
 * Sprint 5 Day 48: Manage example plugins for tutorials and documentation
 */

import { EventEmitter } from 'events'

/**
 * Example plugin metadata
 */
export interface ExamplePlugin {
  id: string
  name: string
  description: string
  category: 'beginner' | 'intermediate' | 'advanced'
  features: string[]
  sourceUrl: string
  documentationUrl: string
  demoCommand?: string
  tags: string[]
}

/**
 * Plugin installation result
 */
export interface InstallResult {
  pluginId: string
  success: boolean
  installPath?: string
  duration: number
  error?: string
}

/**
 * Example plugin manager
 */
export class ExamplePluginManager extends EventEmitter {
  private plugins = new Map<string, ExamplePlugin>()
  private installed = new Set<string>()

  /**
   * Register an example plugin
   */
  register(plugin: ExamplePlugin): void {
    this.plugins.set(plugin.id, plugin)
    this.emit('plugin-registered', { pluginId: plugin.id })
  }

  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): boolean {
    const removed = this.plugins.delete(pluginId)
    if (removed) {
      this.installed.delete(pluginId)
      this.emit('plugin-unregistered', { pluginId })
    }
    return removed
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): ExamplePlugin | undefined {
    return this.plugins.get(pluginId)
  }

  /**
   * List all plugins
   */
  listPlugins(category?: 'beginner' | 'intermediate' | 'advanced'): ExamplePlugin[] {
    const plugins = Array.from(this.plugins.values())

    if (category) {
      return plugins.filter((p) => p.category === category)
    }

    return plugins
  }

  /**
   * Search plugins by tag
   */
  searchByTag(tag: string): ExamplePlugin[] {
    return Array.from(this.plugins.values()).filter((p) =>
      p.tags.includes(tag)
    )
  }

  /**
   * Search plugins by feature
   */
  searchByFeature(feature: string): ExamplePlugin[] {
    return Array.from(this.plugins.values()).filter((p) =>
      p.features.includes(feature)
    )
  }

  /**
   * Install example plugin
   */
  async install(pluginId: string): Promise<InstallResult> {
    const startTime = Date.now()
    const plugin = this.plugins.get(pluginId)

    if (!plugin) {
      return {
        pluginId,
        success: false,
        duration: Date.now() - startTime,
        error: `Plugin "${pluginId}" not found`,
      }
    }

    if (this.installed.has(pluginId)) {
      return {
        pluginId,
        success: true,
        duration: Date.now() - startTime,
        installPath: `/plugins/${pluginId}`,
      }
    }

    this.emit('install-started', { pluginId })

    try {
      // Simulate installation
      await new Promise((resolve) => setTimeout(resolve, 100))

      this.installed.add(pluginId)

      const result: InstallResult = {
        pluginId,
        success: true,
        installPath: `/plugins/${pluginId}`,
        duration: Date.now() - startTime,
      }

      this.emit('install-completed', result)

      return result
    } catch (error) {
      const result: InstallResult = {
        pluginId,
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      }

      this.emit('install-failed', result)

      return result
    }
  }

  /**
   * Uninstall example plugin
   */
  async uninstall(pluginId: string): Promise<boolean> {
    if (!this.installed.has(pluginId)) {
      return false
    }

    this.emit('uninstall-started', { pluginId })

    // Simulate uninstall
    await new Promise((resolve) => setTimeout(resolve, 50))

    this.installed.delete(pluginId)

    this.emit('uninstall-completed', { pluginId })

    return true
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(pluginId: string): boolean {
    return this.installed.has(pluginId)
  }

  /**
   * Get installed plugins
   */
  getInstalledPlugins(): ExamplePlugin[] {
    return Array.from(this.installed)
      .map((id) => this.plugins.get(id))
      .filter((p) => p !== undefined) as ExamplePlugin[]
  }

  /**
   * Get plugin statistics
   */
  getStatistics(): {
    totalPlugins: number
    installedPlugins: number
    byCategory: Record<string, number>
    popularTags: Array<{ tag: string; count: number }>
  } {
    const plugins = this.listPlugins()

    const byCategory = plugins.reduce(
      (acc, p) => {
        acc[p.category] = (acc[p.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Count tags
    const tagCounts = new Map<string, number>()
    for (const plugin of plugins) {
      for (const tag of plugin.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      }
    }

    const popularTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      totalPlugins: plugins.length,
      installedPlugins: this.installed.size,
      byCategory,
      popularTags,
    }
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear()
    this.installed.clear()
    this.emit('plugins-cleared')
  }
}

/**
 * Create example plugin manager
 */
export function createExamplePluginManager(): ExamplePluginManager {
  return new ExamplePluginManager()
}

/**
 * Global plugin manager
 */
let globalManager: ExamplePluginManager | null = null

/**
 * Get global plugin manager
 */
export function getGlobalManager(): ExamplePluginManager {
  if (!globalManager) {
    globalManager = createExamplePluginManager()
  }
  return globalManager
}

/**
 * Reset global plugin manager
 */
export function resetGlobalManager(): void {
  globalManager = null
}

/**
 * Register built-in example plugins
 */
export function registerBuiltInExamples(manager: ExamplePluginManager): void {
  // Beginner: Hello World Plugin
  manager.register({
    id: 'hello-world',
    name: 'Hello World',
    description: 'A simple plugin that greets users',
    category: 'beginner',
    features: ['basic-setup', 'cli-integration'],
    sourceUrl: '/examples/hello-world',
    documentationUrl: '/docs/examples/hello-world',
    demoCommand: 'ax hello',
    tags: ['beginner', 'tutorial', 'cli'],
  })

  // Beginner: Code Counter
  manager.register({
    id: 'code-counter',
    name: 'Code Counter',
    description: 'Count lines of code in your project',
    category: 'beginner',
    features: ['file-scanning', 'statistics'],
    sourceUrl: '/examples/code-counter',
    documentationUrl: '/docs/examples/code-counter',
    demoCommand: 'ax count ./src',
    tags: ['beginner', 'metrics', 'files'],
  })

  // Intermediate: Hot Reload Demo
  manager.register({
    id: 'hot-reload-demo',
    name: 'Hot Reload Demo',
    description: 'Demonstrates hot reload capabilities',
    category: 'intermediate',
    features: ['hot-reload', 'state-preservation', 'file-watching'],
    sourceUrl: '/examples/hot-reload-demo',
    documentationUrl: '/docs/examples/hot-reload-demo',
    demoCommand: 'ax demo:hot-reload',
    tags: ['intermediate', 'hot-reload', 'development'],
  })

  // Intermediate: Debugger Integration
  manager.register({
    id: 'debugger-demo',
    name: 'Debugger Demo',
    description: 'Shows how to integrate with the plugin debugger',
    category: 'intermediate',
    features: ['debugging', 'breakpoints', 'variable-inspection'],
    sourceUrl: '/examples/debugger-demo',
    documentationUrl: '/docs/examples/debugger-demo',
    demoCommand: 'ax demo:debugger',
    tags: ['intermediate', 'debugging', 'development'],
  })

  // Advanced: Performance Profiler
  manager.register({
    id: 'profiler-demo',
    name: 'Performance Profiler',
    description: 'Advanced plugin with performance profiling integration',
    category: 'advanced',
    features: ['profiling', 'benchmarking', 'telemetry', 'optimization'],
    sourceUrl: '/examples/profiler-demo',
    documentationUrl: '/docs/examples/profiler-demo',
    demoCommand: 'ax demo:profiler',
    tags: ['advanced', 'performance', 'profiling', 'telemetry'],
  })

  // Advanced: Custom Language Parser
  manager.register({
    id: 'custom-parser',
    name: 'Custom Language Parser',
    description: 'Implements a custom language parser with Tree-sitter',
    category: 'advanced',
    features: ['parsing', 'ast', 'tree-sitter', 'code-intelligence'],
    sourceUrl: '/examples/custom-parser',
    documentationUrl: '/docs/examples/custom-parser',
    demoCommand: 'ax demo:parser',
    tags: ['advanced', 'parsing', 'tree-sitter', 'ast'],
  })
}
