/**
 * Training Materials Generator
 * Sprint 6 Day 58: Generate training materials and tutorials
 */

import { EventEmitter } from 'events'

/**
 * Training module
 */
export interface TrainingModule {
  id: string
  title: string
  description: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  estimatedTime: number // minutes
  prerequisites?: string[]
  learningObjectives: string[]
  lessons: Lesson[]
}

/**
 * Lesson
 */
export interface Lesson {
  id: string
  title: string
  content: string
  type: 'concept' | 'tutorial' | 'exercise' | 'quiz'
  codeExamples?: CodeExample[]
  exercises?: Exercise[]
  quiz?: QuizQuestion[]
}

/**
 * Code example
 */
export interface CodeExample {
  title: string
  language: string
  code: string
  explanation: string
  output?: string
}

/**
 * Exercise
 */
export interface Exercise {
  id: string
  title: string
  description: string
  startingCode?: string
  solution?: string
  hints?: string[]
  testCases?: TestCase[]
}

/**
 * Test case
 */
export interface TestCase {
  input: unknown
  expectedOutput: unknown
  description: string
}

/**
 * Quiz question
 */
export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

/**
 * Training progress
 */
export interface TrainingProgress {
  moduleId: string
  currentLesson: number
  completedLessons: string[]
  score: number // 0-100
  startTime: number
  lastUpdated: number
  completed: boolean
}

/**
 * Training Materials Generator
 */
export class TrainingMaterialsGenerator extends EventEmitter {
  private modules = new Map<string, TrainingModule>()
  private progress = new Map<string, TrainingProgress>()
  private moduleCounter = 0

  constructor() {
    super()
    this.registerDefaultModules()
  }

  /**
   * Register default training modules
   */
  private registerDefaultModules(): void {
    // Beginner Module: Getting Started
    this.registerModule({
      id: 'getting-started',
      title: 'Getting Started with AutomatosX',
      description: 'Learn the basics of code intelligence and search',
      difficulty: 'beginner',
      estimatedTime: 30,
      learningObjectives: [
        'Understand code intelligence concepts',
        'Index your first codebase',
        'Perform basic searches',
        'Use filters effectively',
      ],
      lessons: [
        {
          id: 'intro',
          title: 'Introduction to Code Intelligence',
          type: 'concept',
          content: `Code intelligence enables fast, accurate code navigation and search.

AutomatosX indexes your codebase to provide:
- **Symbol search**: Find function, class, and variable definitions
- **Full-text search**: Search code content with natural language
- **Call graphs**: Understand code flow and dependencies
- **Multi-language support**: TypeScript, JavaScript, Python, Go, Rust, and more`,
        },
        {
          id: 'installation',
          title: 'Installation and Setup',
          type: 'tutorial',
          content: 'Install AutomatosX and prepare your environment',
          codeExamples: [
            {
              title: 'Install CLI',
              language: 'bash',
              code: 'npm install -g @defai.digital/automatosx',
              explanation: 'Installs AutomatosX CLI globally',
            },
            {
              title: 'Verify Installation',
              language: 'bash',
              code: 'ax --version',
              explanation: 'Check that AutomatosX is installed correctly',
              output: 'AutomatosX v2.0.0',
            },
          ],
        },
        {
          id: 'first-index',
          title: 'Your First Index',
          type: 'tutorial',
          content: 'Index a codebase and view statistics',
          codeExamples: [
            {
              title: 'Index Directory',
              language: 'bash',
              code: 'cd /path/to/project\nax index ./src',
              explanation: 'Recursively index all files in src directory',
            },
            {
              title: 'Check Status',
              language: 'bash',
              code: 'ax status --verbose',
              explanation: 'View indexing statistics and cache metrics',
            },
          ],
        },
        {
          id: 'quiz',
          title: 'Knowledge Check',
          type: 'quiz',
          content: 'Test your understanding',
          quiz: [
            {
              question: 'What command indexes a directory?',
              options: ['ax find', 'ax index', 'ax search', 'ax status'],
              correctAnswer: 1,
              explanation: 'The "ax index" command indexes files and directories',
            },
            {
              question: 'Which search type finds function definitions?',
              options: ['Full-text search', 'Symbol search', 'File search', 'Content search'],
              correctAnswer: 1,
              explanation: 'Symbol search specifically finds function, class, and variable definitions',
            },
          ],
        },
      ],
    })

    // Intermediate Module: Advanced Search
    this.registerModule({
      id: 'advanced-search',
      title: 'Advanced Search Techniques',
      description: 'Master multi-modal search and filtering',
      difficulty: 'intermediate',
      estimatedTime: 45,
      prerequisites: ['getting-started'],
      learningObjectives: [
        'Use symbol search effectively',
        'Write natural language queries',
        'Apply advanced filters',
        'Combine multiple search modes',
      ],
      lessons: [
        {
          id: 'symbol-search',
          title: 'Symbol Search Mastery',
          type: 'tutorial',
          content: 'Learn to find exact symbol definitions',
          codeExamples: [
            {
              title: 'Find Function',
              language: 'bash',
              code: 'ax find "getUserById" --kind function',
              explanation: 'Search for function named getUserById',
            },
            {
              title: 'Find Class',
              language: 'bash',
              code: 'ax find "UserService" --kind class --lang typescript',
              explanation: 'Search for TypeScript class named UserService',
            },
          ],
        },
        {
          id: 'exercises',
          title: 'Practice Exercises',
          type: 'exercise',
          content: 'Apply what you learned',
          exercises: [
            {
              id: 'ex1',
              title: 'Find API Endpoints',
              description: 'Write a search query to find all API route handlers',
              hints: [
                'Think about what functions handle routes',
                'Use natural language search',
                'Try: "API route handler"',
              ],
              solution: 'ax find "API route handler" --lang typescript',
              testCases: [
                {
                  input: 'Search for route handlers',
                  expectedOutput: 'Multiple handler functions found',
                  description: 'Should find API route handlers',
                },
              ],
            },
          ],
        },
      ],
    })

    // Advanced Module: Plugin Development
    this.registerModule({
      id: 'plugin-development',
      title: 'Plugin Development Workshop',
      description: 'Create and publish AutomatosX plugins',
      difficulty: 'advanced',
      estimatedTime: 90,
      prerequisites: ['getting-started', 'advanced-search'],
      learningObjectives: [
        'Understand plugin architecture',
        'Create a plugin from template',
        'Implement plugin logic',
        'Test and publish plugins',
      ],
      lessons: [
        {
          id: 'architecture',
          title: 'Plugin Architecture',
          type: 'concept',
          content: `Plugins extend AutomatosX functionality:

**Plugin Types**:
- **Linters**: Code quality checks
- **Formatters**: Code formatting
- **Analyzers**: Static analysis
- **Integrations**: External tool integration`,
        },
        {
          id: 'create-plugin',
          title: 'Create Your First Plugin',
          type: 'tutorial',
          content: 'Generate a plugin scaffold',
          codeExamples: [
            {
              title: 'Generate Template',
              language: 'bash',
              code: 'ax plugin template create --category linter --name my-linter',
              explanation: 'Creates a linter plugin template',
            },
          ],
        },
      ],
    })
  }

  /**
   * Register training module
   */
  registerModule(module: TrainingModule): void {
    const moduleId = module.id || `module-${++this.moduleCounter}`

    this.modules.set(moduleId, { ...module, id: moduleId })

    this.emit('module-registered', {
      moduleId,
      title: module.title,
      difficulty: module.difficulty,
    })
  }

  /**
   * Start training module
   */
  startModule(moduleId: string): TrainingProgress {
    const module = this.modules.get(moduleId)

    if (!module) {
      throw new Error(`Module not found: ${moduleId}`)
    }

    const progress: TrainingProgress = {
      moduleId,
      currentLesson: 0,
      completedLessons: [],
      score: 0,
      startTime: Date.now(),
      lastUpdated: Date.now(),
      completed: false,
    }

    this.progress.set(moduleId, progress)

    this.emit('module-started', {
      moduleId,
      title: module.title,
      lessonsCount: module.lessons.length,
    })

    return progress
  }

  /**
   * Complete current lesson
   */
  completeLesson(moduleId: string, score?: number): boolean {
    const progress = this.progress.get(moduleId)
    const module = this.modules.get(moduleId)

    if (!progress || !module) {
      return false
    }

    const currentLesson = module.lessons[progress.currentLesson]
    progress.completedLessons.push(currentLesson.id)

    if (score !== undefined) {
      // Update average score
      const totalLessons = progress.completedLessons.length
      progress.score = ((progress.score * (totalLessons - 1)) + score) / totalLessons
    }

    progress.currentLesson++
    progress.lastUpdated = Date.now()

    // Check if module is complete
    if (progress.currentLesson >= module.lessons.length) {
      progress.completed = true
      this.emit('module-completed', {
        moduleId,
        score: progress.score,
        duration: Date.now() - progress.startTime,
      })
    } else {
      this.emit('lesson-completed', {
        moduleId,
        lessonId: currentLesson.id,
        nextLesson: module.lessons[progress.currentLesson].id,
      })
    }

    return true
  }

  /**
   * Get module
   */
  getModule(moduleId: string): TrainingModule | undefined {
    return this.modules.get(moduleId)
  }

  /**
   * Get all modules
   */
  getAllModules(): TrainingModule[] {
    return Array.from(this.modules.values())
  }

  /**
   * Get modules by difficulty
   */
  getModulesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): TrainingModule[] {
    return Array.from(this.modules.values()).filter((m) => m.difficulty === difficulty)
  }

  /**
   * Get progress
   */
  getProgress(moduleId: string): TrainingProgress | undefined {
    return this.progress.get(moduleId)
  }

  /**
   * Get current lesson
   */
  getCurrentLesson(moduleId: string): Lesson | undefined {
    const progress = this.progress.get(moduleId)
    const module = this.modules.get(moduleId)

    if (!progress || !module) {
      return undefined
    }

    return module.lessons[progress.currentLesson]
  }

  /**
   * Reset module progress
   */
  resetProgress(moduleId: string): void {
    this.progress.delete(moduleId)
    this.emit('progress-reset', { moduleId })
  }

  /**
   * Clear all progress
   */
  clearAllProgress(): void {
    this.progress.clear()
    this.emit('all-progress-cleared')
  }
}

/**
 * Create training materials generator
 */
export function createTrainingMaterialsGenerator(): TrainingMaterialsGenerator {
  return new TrainingMaterialsGenerator()
}

/**
 * Global training materials generator
 */
let globalGenerator: TrainingMaterialsGenerator | null = null

/**
 * Get global training materials generator
 */
export function getGlobalTrainingMaterialsGenerator(): TrainingMaterialsGenerator {
  if (!globalGenerator) {
    globalGenerator = createTrainingMaterialsGenerator()
  }
  return globalGenerator
}

/**
 * Reset global training materials generator
 */
export function resetGlobalTrainingMaterialsGenerator(): void {
  globalGenerator = null
}
