/**
 * Training Materials Generator Tests
 * Sprint 6 Day 58: Training materials generation tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  TrainingMaterialsGenerator,
  createTrainingMaterialsGenerator,
  getGlobalTrainingMaterialsGenerator,
  resetGlobalTrainingMaterialsGenerator,
  type TrainingModule,
} from '../../documentation/TrainingMaterialsGenerator.js'

describe('TrainingMaterialsGenerator', () => {
  let generator: TrainingMaterialsGenerator

  beforeEach(() => {
    generator = createTrainingMaterialsGenerator()
  })

  describe('Default Modules', () => {
    it('should have getting started module', () => {
      const module = generator.getModule('getting-started')

      expect(module).toBeDefined()
      expect(module?.title).toBe('Getting Started with AutomatosX')
      expect(module?.difficulty).toBe('beginner')
    })

    it('should have advanced search module', () => {
      const module = generator.getModule('advanced-search')

      expect(module).toBeDefined()
      expect(module?.title).toBe('Advanced Search Techniques')
      expect(module?.difficulty).toBe('intermediate')
    })

    it('should have plugin development module', () => {
      const module = generator.getModule('plugin-development')

      expect(module).toBeDefined()
      expect(module?.title).toBe('Plugin Development Workshop')
      expect(module?.difficulty).toBe('advanced')
    })

    it('should have at least 3 default modules', () => {
      const allModules = generator.getAllModules()

      expect(allModules.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Module Registration', () => {
    it('should register custom module', () => {
      const listener = vi.fn()
      generator.on('module-registered', listener)

      const customModule: TrainingModule = {
        id: 'custom',
        title: 'Custom Module',
        description: 'Test module',
        difficulty: 'beginner',
        estimatedTime: 30,
        learningObjectives: ['Learn basics'],
        lessons: [
          {
            id: 'lesson1',
            title: 'Lesson 1',
            type: 'concept',
            content: 'Test content',
          },
        ],
      }

      generator.registerModule(customModule)

      const retrieved = generator.getModule('custom')

      expect(retrieved).toBeDefined()
      expect(retrieved?.title).toBe('Custom Module')
      expect(listener).toHaveBeenCalled()
    })

    it('should emit module-registered event', () => {
      const listener = vi.fn()
      generator.on('module-registered', listener)

      const module: TrainingModule = {
        id: 'test',
        title: 'Test',
        description: 'Test',
        difficulty: 'beginner',
        estimatedTime: 10,
        learningObjectives: [],
        lessons: [],
      }

      generator.registerModule(module)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: 'test',
          title: 'Test',
          difficulty: 'beginner',
        })
      )
    })
  })

  describe('Module Queries', () => {
    it('should get all modules', () => {
      const allModules = generator.getAllModules()

      expect(allModules.length).toBeGreaterThan(0)
      expect(allModules.some((m) => m.id === 'getting-started')).toBe(true)
    })

    it('should get modules by difficulty', () => {
      const beginnerModules = generator.getModulesByDifficulty('beginner')

      expect(beginnerModules.length).toBeGreaterThan(0)
      expect(beginnerModules.every((m) => m.difficulty === 'beginner')).toBe(true)
    })

    it('should filter intermediate modules', () => {
      const intermediateModules = generator.getModulesByDifficulty('intermediate')

      expect(intermediateModules.length).toBeGreaterThan(0)
      expect(intermediateModules.some((m) => m.id === 'advanced-search')).toBe(true)
    })

    it('should filter advanced modules', () => {
      const advancedModules = generator.getModulesByDifficulty('advanced')

      expect(advancedModules.length).toBeGreaterThan(0)
      expect(advancedModules.some((m) => m.id === 'plugin-development')).toBe(true)
    })
  })

  describe('Module Progress', () => {
    it('should start module and create progress', () => {
      const listener = vi.fn()
      generator.on('module-started', listener)

      const progress = generator.startModule('getting-started')

      expect(progress.moduleId).toBe('getting-started')
      expect(progress.currentLesson).toBe(0)
      expect(progress.completedLessons).toHaveLength(0)
      expect(progress.completed).toBe(false)
      expect(listener).toHaveBeenCalled()
    })

    it('should throw error for non-existent module', () => {
      expect(() => generator.startModule('non-existent')).toThrow('Module not found')
    })

    it('should get progress', () => {
      generator.startModule('getting-started')

      const progress = generator.getProgress('getting-started')

      expect(progress).toBeDefined()
      expect(progress?.moduleId).toBe('getting-started')
    })

    it('should return undefined for non-existent progress', () => {
      const progress = generator.getProgress('non-existent')

      expect(progress).toBeUndefined()
    })
  })

  describe('Lesson Completion', () => {
    beforeEach(() => {
      generator.startModule('getting-started')
    })

    it('should complete current lesson', () => {
      const listener = vi.fn()
      generator.on('lesson-completed', listener)

      const success = generator.completeLesson('getting-started')

      expect(success).toBe(true)

      const progress = generator.getProgress('getting-started')

      expect(progress?.currentLesson).toBe(1)
      expect(progress?.completedLessons.length).toBe(1)
      expect(listener).toHaveBeenCalled()
    })

    it('should emit module-completed when all lessons done', () => {
      const listener = vi.fn()
      generator.on('module-completed', listener)

      const module = generator.getModule('getting-started')
      const lessonCount = module?.lessons.length || 0

      for (let i = 0; i < lessonCount; i++) {
        generator.completeLesson('getting-started')
      }

      expect(listener).toHaveBeenCalled()

      const progress = generator.getProgress('getting-started')

      expect(progress?.completed).toBe(true)
    })

    it('should fail for non-existent module', () => {
      const success = generator.completeLesson('non-existent')

      expect(success).toBe(false)
    })
  })

  describe('Score Tracking', () => {
    beforeEach(() => {
      generator.startModule('getting-started')
    })

    it('should track lesson scores', () => {
      generator.completeLesson('getting-started', 90)

      const progress = generator.getProgress('getting-started')

      expect(progress?.score).toBe(90)
    })

    it('should calculate average score', () => {
      generator.completeLesson('getting-started', 80)
      generator.completeLesson('getting-started', 100)

      const progress = generator.getProgress('getting-started')

      expect(progress?.score).toBe(90) // (80 + 100) / 2
    })

    it('should handle zero score', () => {
      generator.completeLesson('getting-started', 0)

      const progress = generator.getProgress('getting-started')

      expect(progress?.score).toBe(0)
    })
  })

  describe('Current Lesson', () => {
    it('should get current lesson', () => {
      generator.startModule('getting-started')

      const currentLesson = generator.getCurrentLesson('getting-started')

      expect(currentLesson).toBeDefined()
      expect(currentLesson?.id).toBe('intro')
    })

    it('should return undefined for non-existent module', () => {
      const currentLesson = generator.getCurrentLesson('non-existent')

      expect(currentLesson).toBeUndefined()
    })

    it('should update current lesson after completion', () => {
      generator.startModule('getting-started')

      const firstLesson = generator.getCurrentLesson('getting-started')

      generator.completeLesson('getting-started')

      const secondLesson = generator.getCurrentLesson('getting-started')

      expect(secondLesson?.id).not.toBe(firstLesson?.id)
    })
  })

  describe('Module Content', () => {
    it('should have learning objectives', () => {
      const module = generator.getModule('getting-started')

      expect(module?.learningObjectives).toBeDefined()
      expect(module?.learningObjectives.length).toBeGreaterThan(0)
    })

    it('should have lessons', () => {
      const module = generator.getModule('getting-started')

      expect(module?.lessons).toBeDefined()
      expect(module?.lessons.length).toBeGreaterThan(0)
    })

    it('should have lesson types', () => {
      const module = generator.getModule('getting-started')

      const lessonTypes = module?.lessons.map((l) => l.type)

      expect(lessonTypes).toContain('concept')
      expect(lessonTypes).toContain('tutorial')
    })

    it('should have code examples in lessons', () => {
      const module = generator.getModule('getting-started')

      const hasCodeExamples = module?.lessons.some((l) => l.codeExamples && l.codeExamples.length > 0)

      expect(hasCodeExamples).toBe(true)
    })

    it('should have quiz questions in quiz lessons', () => {
      const module = generator.getModule('getting-started')

      const quizLesson = module?.lessons.find((l) => l.type === 'quiz')

      expect(quizLesson?.quiz).toBeDefined()
      expect(quizLesson?.quiz!.length).toBeGreaterThan(0)
    })
  })

  describe('Prerequisites', () => {
    it('should track module prerequisites', () => {
      const module = generator.getModule('advanced-search')

      expect(module?.prerequisites).toBeDefined()
      expect(module?.prerequisites).toContain('getting-started')
    })

    it('should have no prerequisites for beginner modules', () => {
      const module = generator.getModule('getting-started')

      expect(module?.prerequisites).toBeUndefined()
    })
  })

  describe('Progress Management', () => {
    it('should reset module progress', () => {
      const listener = vi.fn()
      generator.on('progress-reset', listener)

      generator.startModule('getting-started')

      generator.resetProgress('getting-started')

      const progress = generator.getProgress('getting-started')

      expect(progress).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })

    it('should clear all progress', () => {
      const listener = vi.fn()
      generator.on('all-progress-cleared', listener)

      generator.startModule('getting-started')
      generator.startModule('advanced-search')

      generator.clearAllProgress()

      expect(generator.getProgress('getting-started')).toBeUndefined()
      expect(generator.getProgress('advanced-search')).toBeUndefined()
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('Global Training Materials Generator', () => {
    beforeEach(() => {
      resetGlobalTrainingMaterialsGenerator()
    })

    it('should get global generator', () => {
      const global = getGlobalTrainingMaterialsGenerator()

      expect(global).toBeInstanceOf(TrainingMaterialsGenerator)
    })

    it('should return same instance', () => {
      const generator1 = getGlobalTrainingMaterialsGenerator()
      const generator2 = getGlobalTrainingMaterialsGenerator()

      expect(generator1).toBe(generator2)
    })

    it('should reset global generator', () => {
      const generator1 = getGlobalTrainingMaterialsGenerator()

      resetGlobalTrainingMaterialsGenerator()

      const generator2 = getGlobalTrainingMaterialsGenerator()

      expect(generator2).not.toBe(generator1)
    })
  })
})
