// Sprint 2 Day 13: List Agents Command Handler
// Handler for `ax list agents` CLI command

import { ListAgentsSchema, type ListAgents } from '../schemas/ListAgentsSchema.js'
import { errorHandler } from '../../utils/ErrorEnvelope.js'
import { StreamingLogger } from '../../utils/StreamingLogger.js'

/**
 * List agents handler
 *
 * @param rawArgs - Raw command arguments
 * @returns Promise<void>
 */
export async function listAgentsCommand(rawArgs: unknown): Promise<void> {
  const logger = new StreamingLogger({ minLevel: 'info' })

  try {
    // 1. Validate inputs
    logger.debug('Validating command arguments...')
    const args = ListAgentsSchema.parse(rawArgs)

    if (args.verbose) {
      logger.setMinLevel('debug')
    }

    // 2. Load agent catalog
    logger.debug('Loading agent catalog...')
    // const catalog = new AgentCatalog()
    // let agents = await catalog.loadAll()

    // Mock agents for now
    let agents = await mockLoadAgents(logger)

    // 3. Apply filters
    if (args.category !== 'all') {
      logger.debug(`Filtering by category: ${args.category}`)
      agents = agents.filter(a => a.category === args.category)
    }

    if (args.enabled !== undefined) {
      logger.debug(`Filtering by enabled status: ${args.enabled}`)
      agents = agents.filter(a => a.enabled === args.enabled)
    }

    // 4. Sort agents
    logger.debug(`Sorting by: ${args.sortBy}`)
    agents.sort((a, b) => {
      switch (args.sortBy) {
        case 'name': return a.name.localeCompare(b.name)
        case 'category': return a.category.localeCompare(b.category)
        case 'priority': return b.priority - a.priority
        default: return 0
      }
    })

    // 5. Display results
    logger.info(`Found ${agents.length} agents`)

    if (args.format === 'json' || args.json) {
      console.log(JSON.stringify(agents, null, 2))
    } else if (args.format === 'table') {
      printTableAgents(agents, args.showCapabilities)
    } else {
      printTextAgents(agents, args.verbose, args.showCapabilities)
    }

  } catch (error) {
    await errorHandler(error, {
      debug: (rawArgs as any)?.debug,
      json: (rawArgs as any)?.json,
    })
  }
}

/**
 * Mock agent loading
 */
async function mockLoadAgents(logger: StreamingLogger): Promise<any[]> {
  logger.debug('Reading .automatosx/agents/ directory...')
  await new Promise(resolve => setTimeout(resolve, 50))

  return [
    {
      name: 'backend',
      category: 'development',
      enabled: true,
      priority: 10,
      description: 'Backend development specialist',
      capabilities: ['Go', 'Rust', 'API design', 'Database design'],
    },
    {
      name: 'frontend',
      category: 'development',
      enabled: true,
      priority: 9,
      description: 'Frontend development specialist',
      capabilities: ['React', 'TypeScript', 'Next.js', 'UI/UX'],
    },
    {
      name: 'product',
      category: 'leadership',
      enabled: true,
      priority: 8,
      description: 'Product management and planning',
      capabilities: ['PRD writing', 'Feature planning', 'Roadmap design'],
    },
    {
      name: 'quality',
      category: 'development',
      enabled: true,
      priority: 7,
      description: 'QA and testing specialist',
      capabilities: ['Test automation', 'Quality assurance', 'Bug tracking'],
    },
  ]
}

/**
 * Print agents in table format
 */
function printTableAgents(agents: any[], showCapabilities: boolean): void {
  console.log('\n┌──────────────────────────────────────────────────────────────────────┐')
  console.log('│ Name          │ Category      │ Enabled │ Priority │')
  console.log('├──────────────────────────────────────────────────────────────────────┤')

  agents.forEach(agent => {
    const enabled = agent.enabled ? '✓' : '✗'
    console.log(`│ ${agent.name.padEnd(13)} │ ${agent.category.padEnd(13)} │ ${enabled}       │ ${agent.priority}        │`)

    if (showCapabilities) {
      console.log(`│   Capabilities: ${agent.capabilities.join(', ')}`)
    }
  })

  console.log('└──────────────────────────────────────────────────────────────────────┘\n')
}

/**
 * Print agents in text format
 */
function printTextAgents(agents: any[], verbose: boolean, showCapabilities: boolean): void {
  agents.forEach((agent, i) => {
    const status = agent.enabled ? '✓' : '✗'
    console.log(`\n${i + 1}. ${agent.name} [${status}] (${agent.category})`)
    console.log(`   ${agent.description}`)

    if (verbose) {
      console.log(`   Priority: ${agent.priority}`)
    }

    if (showCapabilities) {
      console.log(`   Capabilities: ${agent.capabilities.join(', ')}`)
    }
  })

  console.log('')
}
