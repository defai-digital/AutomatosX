/**
 * Performance Benchmark CLI Command
 * Sprint 5 Day 41: ax perf command for benchmarking
 */

import { Command } from 'commander'
import { promises as fs } from 'fs'
import { join } from 'path'
import {
  createBenchmarkHarness,
  BenchmarkHarness,
  type BenchmarkWorkload,
} from '../../performance/BenchmarkHarness.js'
import { getProfiler } from '../../performance/CLIProfiler.js'

/**
 * Create perf command
 */
export function createPerfCommand(): Command {
  const command = new Command('perf')

  command
    .description('Performance benchmarking and profiling tools')
    .addCommand(createRunCommand())
    .addCommand(createInspectCommand())
    .addCommand(createCompareCommand())

  return command
}

/**
 * Create run subcommand
 */
function createRunCommand(): Command {
  const command = new Command('run')

  command
    .description('Run performance benchmarks')
    .option('-w, --workload <file>', 'Workload specification file')
    .option('-i, --iterations <number>', 'Number of iterations', '100')
    .option('-o, --output <file>', 'Output file for results')
    .option('--json', 'Output results as JSON')
    .option('--profile', 'Enable profiling')
    .action(async (options) => {
      try {
        const profiler = getProfiler()
        if (options.profile) {
          profiler.enable()
          profiler.startCommand('ax perf run')
        }

        profiler.startPhase('benchmark-setup')

        // Create harness
        const harness = createBenchmarkHarness()

        // Define workloads
        const workloads: BenchmarkWorkload[] = []

        if (options.workload) {
          // Load workloads from file
          const workloadFile = await fs.readFile(options.workload, 'utf-8')
          const workloadSpec = JSON.parse(workloadFile)

          // Convert spec to workloads (simplified)
          for (const spec of workloadSpec.workloads) {
            // Fixed: Validate iterations to prevent NaN
            const iterations = spec.iterations || parseInt(options.iterations, 10);
            const validIterations = Number.isNaN(iterations) || iterations <= 0 ? 10 : iterations;

            workloads.push({
              name: spec.name,
              description: spec.description,
              iterations: validIterations,
              fn: async () => {
                // Execute benchmark function
                // This would be dynamically loaded in real implementation
                await new Promise((resolve) => setTimeout(resolve, 1))
              },
            })
          }
        } else {
          // Default workloads
          // Fixed: Validate iterations to prevent NaN
          const iterations = parseInt(options.iterations, 10);
          const validIterations = Number.isNaN(iterations) || iterations <= 0 ? 10 : iterations;

          workloads.push(
            {
              name: 'code-intelligence-search',
              description: 'Full-text code search',
              iterations: validIterations,
              fn: async () => {
                // Simulate search operation
                await new Promise((resolve) => setTimeout(resolve, 10))
              },
            },
            {
              name: 'symbol-lookup',
              description: 'Symbol definition lookup',
              iterations: validIterations,  // Fixed: Reuse validated iterations
              fn: async () => {
                await new Promise((resolve) => setTimeout(resolve, 5))
              },
            },
            {
              name: 'dependency-resolution',
              description: 'Plugin dependency resolution',
              iterations: validIterations,  // Fixed: Reuse validated iterations
              fn: async () => {
                await new Promise((resolve) => setTimeout(resolve, 15))
              },
            }
          )
        }

        profiler.endPhase('benchmark-setup')
        profiler.startPhase('benchmark-execution')

        // Run benchmarks
        const suiteResult = await harness.runSuite('AutomatosX Performance Suite', workloads)

        profiler.endPhase('benchmark-execution')

        // Output results
        if (options.json) {
          const json = BenchmarkHarness.exportJSON(suiteResult)
          if (options.output) {
            await fs.writeFile(options.output, json, 'utf-8')
            console.log(`Results saved to ${options.output}`)
          } else {
            console.log(json)
          }
        } else {
          const formatted = BenchmarkHarness.formatSuiteResult(suiteResult)
          if (options.output) {
            await fs.writeFile(options.output, formatted, 'utf-8')
            console.log(`Results saved to ${options.output}`)
          } else {
            console.log(formatted)
          }
        }

        // Show profiling results if enabled
        if (options.profile) {
          const profilingResult = profiler.endCommand()
          if (profilingResult) {
            console.log('\n=== Profiling Results ===')
            console.log(profiler.constructor.formatResult(profilingResult))
          }
        }
      } catch (error) {
        console.error('Error running benchmarks:', error)
        process.exit(1)
      }
    })

  return command
}

/**
 * Create inspect subcommand
 */
function createInspectCommand(): Command {
  const command = new Command('inspect')

  command
    .description('Inspect runtime performance')
    .option('-c, --command <command>', 'Command to profile')
    .option('-o, --output <file>', 'Output file for profiling data')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        const profiler = getProfiler()
        profiler.enable()
        profiler.startCommand(options.command || 'inspect')

        // Simulate command execution with phases
        profiler.startPhase('initialization')
        await new Promise((resolve) => setTimeout(resolve, 50))
        profiler.endPhase('initialization')

        profiler.startPhase('execution')
        await new Promise((resolve) => setTimeout(resolve, 100))
        profiler.endPhase('execution')

        profiler.startPhase('cleanup')
        await new Promise((resolve) => setTimeout(resolve, 20))
        profiler.endPhase('cleanup')

        const result = profiler.endCommand()

        if (result) {
          if (options.json) {
            const json = CLIProfiler.exportJSON(result)
            if (options.output) {
              await fs.writeFile(options.output, json, 'utf-8')
              console.log(`Profiling data saved to ${options.output}`)
            } else {
              console.log(json)
            }
          } else {
            const formatted = CLIProfiler.formatResult(result)
            if (options.output) {
              await fs.writeFile(options.output, formatted, 'utf-8')
              console.log(`Profiling data saved to ${options.output}`)
            } else {
              console.log(formatted)
            }

            // Show analysis
            const analysis = CLIProfiler.analyzeStartup(result)
            if (!analysis.isOptimal) {
              console.log('\n=== Performance Issues ===')
              analysis.issues.forEach((issue) => console.log(`⚠️  ${issue}`))
              console.log('\n=== Recommendations ===')
              analysis.recommendations.forEach((rec) => console.log(`💡 ${rec}`))
            } else {
              console.log('\n✅ Performance is optimal!')
            }
          }
        }

        profiler.disable()
      } catch (error) {
        console.error('Error inspecting performance:', error)
        process.exit(1)
      }
    })

  // Fix: Import CLIProfiler in the action handler
  const CLIProfiler = require('../../performance/CLIProfiler.js').CLIProfiler

  return command
}

/**
 * Create compare subcommand
 */
function createCompareCommand(): Command {
  const command = new Command('compare')

  command
    .description('Compare benchmark results')
    .argument('<baseline>', 'Baseline results file')
    .argument('<current>', 'Current results file')
    .option('--json', 'Output as JSON')
    .action(async (baseline, current, options) => {
      try {
        const baselineData = JSON.parse(await fs.readFile(baseline, 'utf-8'))
        const currentData = JSON.parse(await fs.readFile(current, 'utf-8'))

        console.log('=== Benchmark Comparison ===\n')

        if (baselineData.results && currentData.results) {
          // Compare suite results
          for (let i = 0; i < Math.min(baselineData.results.length, currentData.results.length); i++) {
            const baseResult = baselineData.results[i]
            const currResult = currentData.results[i]

            const comparison = BenchmarkHarness.compare(baseResult, currResult)

            console.log(`Benchmark: ${comparison.name}`)
            console.log(
              `  Mean: ${comparison.meanImprovement > 0 ? '✅' : '⚠️'} ${comparison.meanImprovement.toFixed(2)}% ${comparison.meanImprovement > 0 ? 'faster' : 'slower'}`
            )
            console.log(
              `  P95: ${comparison.p95Improvement > 0 ? '✅' : '⚠️'} ${comparison.p95Improvement.toFixed(2)}% ${comparison.p95Improvement > 0 ? 'faster' : 'slower'}`
            )
            console.log(
              `  Throughput: ${comparison.throughputImprovement > 0 ? '✅' : '⚠️'} ${comparison.throughputImprovement.toFixed(2)}% ${comparison.throughputImprovement > 0 ? 'higher' : 'lower'}`
            )

            if (comparison.regression) {
              console.log('  ❌ REGRESSION DETECTED')
            }

            console.log('')
          }
        } else {
          console.log('Invalid benchmark result files')
        }
      } catch (error) {
        console.error('Error comparing benchmarks:', error)
        process.exit(1)
      }
    })

  return command
}

export default createPerfCommand
