/**
 * Tutorial Runner
 * Sprint 5 Day 48: Interactive tutorial system for onboarding
 */

import { EventEmitter } from 'events'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Tutorial step
 */
export interface TutorialStep {
  id: string
  title: string
  description: string
  instructions: string
  expectedAction?: string
  validation?: () => Promise<boolean>
  code?: string
}

/**
 * Tutorial metadata
 */
export interface Tutorial {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number // minutes
  tags: string[]
  steps: TutorialStep[]
}

/**
 * Tutorial progress
 */
export interface TutorialProgress {
  tutorialId: string
  currentStep: number
  completedSteps: string[]
  startTime: number
  lastActivityTime: number
  completed: boolean
}

/**
 * Tutorial completion result
 */
export interface TutorialResult {
  tutorialId: string
  completed: boolean
  duration: number
  stepsCompleted: number
  totalSteps: number
  startTime: number
  endTime: number
}

/**
 * Tutorial runner
 */
export class TutorialRunner extends EventEmitter {
  private tutorials = new Map<string, Tutorial>()
  private progress = new Map<string, TutorialProgress>()
  private activeTutorial: string | null = null

  /**
   * Register a tutorial
   */
  register(tutorial: Tutorial): void {
    this.tutorials.set(tutorial.id, tutorial)
    this.emit('tutorial-registered', { tutorialId: tutorial.id })
  }

  /**
   * Unregister a tutorial
   */
  unregister(tutorialId: string): boolean {
    const removed = this.tutorials.delete(tutorialId)
    if (removed) {
      this.emit('tutorial-unregistered', { tutorialId })
    }
    return removed
  }

  /**
   * List all tutorials
   */
  listTutorials(): Tutorial[] {
    return Array.from(this.tutorials.values())
  }

  /**
   * Get tutorial by ID
   */
  getTutorial(tutorialId: string): Tutorial | undefined {
    return this.tutorials.get(tutorialId)
  }

  /**
   * Start a tutorial
   */
  async startTutorial(tutorialId: string): Promise<TutorialProgress> {
    const tutorial = this.tutorials.get(tutorialId)
    if (!tutorial) {
      throw new Error(`Tutorial "${tutorialId}" not found`)
    }

    if (this.activeTutorial) {
      throw new Error(
        `Already running tutorial "${this.activeTutorial}". Please complete or stop it first.`
      )
    }

    const progress: TutorialProgress = {
      tutorialId,
      currentStep: 0,
      completedSteps: [],
      startTime: Date.now(),
      lastActivityTime: Date.now(),
      completed: false,
    }

    this.progress.set(tutorialId, progress)
    this.activeTutorial = tutorialId

    this.emit('tutorial-started', { tutorialId, tutorial })

    return progress
  }

  /**
   * Get current step
   */
  getCurrentStep(tutorialId: string): TutorialStep | null {
    const tutorial = this.tutorials.get(tutorialId)
    const progress = this.progress.get(tutorialId)

    if (!tutorial || !progress) return null

    return tutorial.steps[progress.currentStep] || null
  }

  /**
   * Complete current step
   */
  async completeStep(tutorialId: string): Promise<boolean> {
    const tutorial = this.tutorials.get(tutorialId)
    const progress = this.progress.get(tutorialId)

    if (!tutorial || !progress) {
      throw new Error(`Tutorial "${tutorialId}" not found or not started`)
    }

    const currentStep = tutorial.steps[progress.currentStep]
    if (!currentStep) {
      throw new Error('No current step')
    }

    // Run validation if specified
    if (currentStep.validation) {
      try {
        const valid = await currentStep.validation()
        if (!valid) {
          this.emit('step-validation-failed', {
            tutorialId,
            stepId: currentStep.id,
          })
          return false
        }
      } catch (error) {
        this.emit('step-validation-error', {
          tutorialId,
          stepId: currentStep.id,
          error,
        })
        return false
      }
    }

    // Mark step as completed
    progress.completedSteps.push(currentStep.id)
    progress.lastActivityTime = Date.now()

    this.emit('step-completed', {
      tutorialId,
      stepId: currentStep.id,
      stepNumber: progress.currentStep + 1,
      totalSteps: tutorial.steps.length,
    })

    // Move to next step
    progress.currentStep++

    // Check if tutorial is completed
    if (progress.currentStep >= tutorial.steps.length) {
      progress.completed = true
      this.activeTutorial = null

      const result: TutorialResult = {
        tutorialId,
        completed: true,
        duration: Date.now() - progress.startTime,
        stepsCompleted: progress.completedSteps.length,
        totalSteps: tutorial.steps.length,
        startTime: progress.startTime,
        endTime: Date.now(),
      }

      this.emit('tutorial-completed', result)
    }

    return true
  }

  /**
   * Skip current step
   */
  skipStep(tutorialId: string): void {
    const tutorial = this.tutorials.get(tutorialId)
    const progress = this.progress.get(tutorialId)

    if (!tutorial || !progress) {
      throw new Error(`Tutorial "${tutorialId}" not found or not started`)
    }

    const currentStep = tutorial.steps[progress.currentStep]
    if (!currentStep) {
      throw new Error('No current step')
    }

    progress.currentStep++
    progress.lastActivityTime = Date.now()

    this.emit('step-skipped', {
      tutorialId,
      stepId: currentStep.id,
    })

    // Check if tutorial is completed
    if (progress.currentStep >= tutorial.steps.length) {
      progress.completed = true
      this.activeTutorial = null

      const result: TutorialResult = {
        tutorialId,
        completed: false, // Not fully completed if steps skipped
        duration: Date.now() - progress.startTime,
        stepsCompleted: progress.completedSteps.length,
        totalSteps: tutorial.steps.length,
        startTime: progress.startTime,
        endTime: Date.now(),
      }

      this.emit('tutorial-completed', result)
    }
  }

  /**
   * Stop current tutorial
   */
  stopTutorial(tutorialId: string): TutorialResult {
    const tutorial = this.tutorials.get(tutorialId)
    const progress = this.progress.get(tutorialId)

    if (!tutorial || !progress) {
      throw new Error(`Tutorial "${tutorialId}" not found or not started`)
    }

    this.activeTutorial = null

    const result: TutorialResult = {
      tutorialId,
      completed: false,
      duration: Date.now() - progress.startTime,
      stepsCompleted: progress.completedSteps.length,
      totalSteps: tutorial.steps.length,
      startTime: progress.startTime,
      endTime: Date.now(),
    }

    this.emit('tutorial-stopped', result)

    return result
  }

  /**
   * Get progress for tutorial
   */
  getProgress(tutorialId: string): TutorialProgress | undefined {
    return this.progress.get(tutorialId)
  }

  /**
   * Get all progress records
   */
  getAllProgress(): TutorialProgress[] {
    return Array.from(this.progress.values())
  }

  /**
   * Reset progress for tutorial
   */
  resetProgress(tutorialId: string): void {
    this.progress.delete(tutorialId)
    if (this.activeTutorial === tutorialId) {
      this.activeTutorial = null
    }
    this.emit('progress-reset', { tutorialId })
  }

  /**
   * Get active tutorial
   */
  getActiveTutorial(): Tutorial | null {
    if (!this.activeTutorial) return null
    return this.tutorials.get(this.activeTutorial) || null
  }

  /**
   * Check if a tutorial is running
   */
  isRunning(tutorialId?: string): boolean {
    if (tutorialId) {
      return this.activeTutorial === tutorialId
    }
    return this.activeTutorial !== null
  }

  /**
   * Load tutorials from directory
   */
  loadFromDirectory(directoryPath: string): number {
    // Implementation would scan directory for tutorial JSON files
    // For MVP, we'll just emit an event
    this.emit('tutorials-loaded', { directoryPath })
    return this.tutorials.size
  }

  /**
   * Get tutorial statistics
   */
  getStatistics(): {
    totalTutorials: number
    completedTutorials: number
    inProgressTutorials: number
    averageCompletionTime: number
  } {
    const progressRecords = this.getAllProgress()
    const completed = progressRecords.filter((p) => p.completed)
    const inProgress = progressRecords.filter((p) => !p.completed)

    const totalTime = completed.reduce((sum, p) => {
      return sum + (Date.now() - p.startTime)
    }, 0)

    return {
      totalTutorials: this.tutorials.size,
      completedTutorials: completed.length,
      inProgressTutorials: inProgress.length,
      averageCompletionTime:
        completed.length > 0 ? totalTime / completed.length : 0,
    }
  }
}

/**
 * Create tutorial runner
 */
export function createTutorialRunner(): TutorialRunner {
  return new TutorialRunner()
}

/**
 * Global tutorial runner
 */
let globalRunner: TutorialRunner | null = null

/**
 * Get global tutorial runner
 */
export function getGlobalRunner(): TutorialRunner {
  if (!globalRunner) {
    globalRunner = createTutorialRunner()
  }
  return globalRunner
}

/**
 * Reset global tutorial runner
 */
export function resetGlobalRunner(): void {
  globalRunner = null
}
