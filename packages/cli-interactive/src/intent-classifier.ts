/**
 * Intent Classifier
 *
 * Maps natural language input to slash commands
 * Phase 1 P0: Enable users to talk naturally instead of memorizing commands
 */

export interface IntentMatch {
  command: string;
  args: string[];
  confidence: number;
  reason?: string;
}

export interface IntentPattern {
  patterns: RegExp[];
  command: string;
  extractArgs?: (match: RegExpMatchArray) => string[];
  examples?: string[];
}

/**
 * Intent patterns for natural language → command mapping
 * Covers top 20 most common commands with variations
 */
const INTENT_PATTERNS: IntentPattern[] = [
  // Testing commands
  {
    patterns: [
      /^(?:run|execute|start)\s+(?:the\s+)?tests?$/i,
      /^test(?:\s+(?:this|it|everything))?$/i,
      /^(?:can you|please)\s+(?:run|execute)\s+(?:the\s+)?tests?$/i
    ],
    command: 'test',
    examples: ['run tests', 'run the tests', 'test this', 'execute tests']
  },
  {
    patterns: [
      /^(?:run|show|get|check)\s+(?:test\s+)?coverage$/i,
      /^coverage$/i
    ],
    command: 'coverage',
    examples: ['run coverage', 'show coverage', 'check coverage']
  },

  // Build commands
  {
    patterns: [
      /^(?:run|start|do)\s+(?:a\s+)?build$/i,
      /^build(?:\s+(?:this|it|project))?$/i,
      /^(?:compile|bundle)(?:\s+(?:this|it|project))?$/i
    ],
    command: 'build',
    examples: ['run build', 'build this', 'compile project']
  },
  {
    patterns: [
      /^(?:start|run)\s+(?:the\s+)?dev(?:\s+server)?$/i,
      /^dev(?:\s+mode)?$/i,
      /^(?:start|run)\s+development(?:\s+server)?$/i
    ],
    command: 'dev',
    examples: ['start dev server', 'run dev', 'dev mode']
  },

  // File operations
  {
    patterns: [
      /^(?:read|show|display|cat|view)\s+(.+)$/i,
      /^(?:what's|whats)\s+in\s+(.+)$/i,
      /^(?:open|show me)\s+(.+)$/i
    ],
    command: 'read',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['read src/app.ts', 'show package.json', 'whats in README.md']
  },
  {
    patterns: [
      /^(?:write|create|make)\s+(?:a\s+)?(?:new\s+)?file\s+(.+)$/i,
      /^(?:write|save|put)\s+(.+)$/i
    ],
    command: 'write',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['write src/new.ts', 'create file app.ts', 'save config.json']
  },
  {
    patterns: [
      /^(?:edit|modify|change|update)\s+(.+)$/i,
      /^(?:replace|substitute)\s+(?:in\s+)?(.+)$/i
    ],
    command: 'edit',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['edit src/app.ts', 'modify package.json', 'change config']
  },

  // Search & navigation
  {
    patterns: [
      /^(?:find|locate|search for|look for)\s+files?\s+(?:named\s+)?(.+)$/i,
      /^(?:find|locate)\s+(.+)$/i
    ],
    command: 'find',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['find files named *.ts', 'locate package.json', 'find src']
  },
  {
    patterns: [
      /^(?:search|grep|look for)\s+(.+?)(?:\s+in\s+(.+))?$/i,
      /^(?:find|search for)\s+"(.+)"$/i
    ],
    command: 'search',
    extractArgs: (match) => match[2] ? [match[1] ?? '', match[2]] : [match[1] ?? ''],
    examples: ['search TODO', 'grep error in src/', 'find "function"']
  },
  {
    patterns: [
      /^(?:show|display|list)\s+(?:the\s+)?(?:file\s+)?tree$/i,
      /^tree(?:\s+of\s+(.+))?$/i,
      /^(?:show|display)\s+(?:directory\s+)?structure$/i
    ],
    command: 'tree',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    examples: ['show tree', 'tree of src/', 'display structure']
  },

  // Git operations
  {
    patterns: [
      /^(?:git\s+)?status$/i,
      /^(?:show|check|what's)\s+(?:git\s+)?status$/i,
      /^(?:what|which)\s+files?\s+(?:are\s+)?changed$/i
    ],
    command: 'status',
    examples: ['git status', 'show status', 'what files changed']
  },
  {
    patterns: [
      /^git\s+(.+)$/i,
      /^(?:run\s+)?git\s+command\s+(.+)$/i
    ],
    command: 'git',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['git commit -m "message"', 'git push', 'git diff']
  },

  // Code quality
  {
    patterns: [
      /^(?:run\s+)?lint(?:\s+(.+))?$/i,
      /^(?:check|fix)\s+linting?(?:\s+(?:in|for)\s+(.+))?$/i
    ],
    command: 'lint',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    examples: ['lint', 'run lint src/', 'check linting']
  },
  {
    patterns: [
      /^format(?:\s+(.+))?$/i,
      /^(?:run\s+)?(?:prettier|beautify)(?:\s+(.+))?$/i,
      /^(?:fix|apply)\s+formatting?(?:\s+(?:to|for)\s+(.+))?$/i
    ],
    command: 'format',
    extractArgs: (match) => match[1] ? [match[1]] : [],
    examples: ['format', 'run prettier src/', 'fix formatting']
  },

  // Package management
  {
    patterns: [
      /^(?:install|add)\s+(?:package\s+)?(.+)$/i,
      /^npm\s+install\s+(.+)$/i,
      /^yarn\s+add\s+(.+)$/i
    ],
    command: 'install',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['install lodash', 'add package axios', 'npm install react']
  },
  {
    patterns: [
      /^(?:update|upgrade)\s+(?:packages?)?$/i,
      /^npm\s+update$/i
    ],
    command: 'update',
    examples: ['update packages', 'upgrade', 'npm update']
  },
  {
    patterns: [
      /^(?:check|show|list)\s+outdated(?:\s+packages?)?$/i,
      /^outdated$/i
    ],
    command: 'outdated',
    examples: ['check outdated', 'show outdated packages', 'outdated']
  },

  // Process management
  {
    patterns: [
      /^(?:run|execute|start)\s+(.+)$/i,
      /^npm\s+run\s+(.+)$/i,
      /^yarn\s+(.+)$/i
    ],
    command: 'run',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['run dev', 'execute build', 'npm run test']
  },
  {
    patterns: [
      /^(?:exec|execute)\s+(.+)$/i,
      /^(?:run\s+)?(?:command|shell)\s+(.+)$/i
    ],
    command: 'exec',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['exec ls -la', 'run command pwd', 'execute echo hello']
  },
  {
    patterns: [
      /^(?:list|show)\s+(?:background\s+)?processes$/i,
      /^processes$/i,
      /^(?:what's|whats)\s+running$/i
    ],
    command: 'processes',
    examples: ['list processes', 'show background processes', 'whats running']
  },

  // Memory & agents
  {
    patterns: [
      /^(?:search|find|query)\s+memory(?:\s+for)?\s+(.+)$/i,
      /^memory\s+search\s+(.+)$/i,
      /^(?:remember|recall)\s+(.+)$/i
    ],
    command: 'memory',
    extractArgs: (match) => ['search', match[1] ?? ''],
    examples: ['search memory for auth', 'memory search API', 'recall user']
  },
  {
    patterns: [
      /^(?:list|show)\s+agents?$/i,
      /^agents?$/i,
      /^(?:what|which)\s+agents?\s+(?:are\s+)?available$/i
    ],
    command: 'agents',
    examples: ['list agents', 'show agents', 'what agents are available']
  },

  // Help & navigation
  {
    patterns: [
      /^(?:help|what can you do|\?)$/i,
      /^(?:show|list)\s+commands?$/i,
      /^(?:what|which)\s+commands?\s+(?:are\s+)?available$/i
    ],
    command: 'help',
    examples: ['help', 'what can you do', 'list commands']
  },
  {
    patterns: [
      /^(?:clear|cls)(?:\s+screen)?$/i,
      /^(?:clean|wipe)\s+(?:the\s+)?screen$/i
    ],
    command: 'clear',
    examples: ['clear screen', 'cls', 'clean screen']
  },

  // Conversation management
  {
    patterns: [
      /^(?:show|display|list)\s+history$/i,
      /^history$/i,
      /^(?:what did we|what have we)\s+(?:talk about|discuss)$/i
    ],
    command: 'history',
    examples: ['show history', 'history', 'what did we talk about']
  },
  {
    patterns: [
      /^save(?:\s+(?:this|conversation|session))?\s+(?:as\s+)?(.+)$/i,
      /^(?:save|store)\s+(.+)$/i
    ],
    command: 'save',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['save this as my-session', 'save conversation', 'store work']
  },
  {
    patterns: [
      /^(?:load|open|resume)\s+(?:conversation\s+)?(.+)$/i,
      /^(?:continue|restore)\s+(.+)$/i
    ],
    command: 'load',
    extractArgs: (match) => [match[1] ?? ''],
    examples: ['load my-session', 'open conversation work', 'resume session']
  }
];

/**
 * Confirmation heuristics - detect user approval responses
 */
const CONFIRMATION_PATTERNS = {
  yes: [
    /^(?:yes|yep|yeah|yup|sure|ok|okay|fine|sounds good|looks good)$/i,
    /^(?:go ahead|proceed|continue|apply it|do it)$/i,
    /^(?:approve|accept|confirm)$/i,
    /^y$/i
  ],
  no: [
    /^(?:no|nope|nah|cancel|stop|abort)$/i,
    /^(?:don't|dont|do not)$/i,
    /^n$/i
  ]
};

/**
 * Classify user input to determine intent
 */
export function classifyIntent(input: string): IntentMatch | null {
  const trimmed = input.trim();

  // Empty input
  if (!trimmed) {
    return null;
  }

  // Slash commands pass through unchanged
  if (trimmed.startsWith('/')) {
    return null; // Let existing slash command handler deal with it
  }

  // Try to match intent patterns
  for (const pattern of INTENT_PATTERNS) {
    for (const regex of pattern.patterns) {
      const match = trimmed.match(regex);
      if (match) {
        const args = pattern.extractArgs ? pattern.extractArgs(match) : [];

        return {
          command: pattern.command,
          args,
          confidence: 0.9, // High confidence for exact pattern matches
          reason: `Detected "${pattern.command}" intent from natural language`
        };
      }
    }
  }

  return null; // No intent detected, treat as free-form conversation
}

/**
 * Detect if input is a confirmation/approval response
 */
export function detectConfirmation(input: string): 'yes' | 'no' | null {
  const trimmed = input.trim();

  // Check yes patterns
  for (const pattern of CONFIRMATION_PATTERNS.yes) {
    if (pattern.test(trimmed)) {
      return 'yes';
    }
  }

  // Check no patterns
  for (const pattern of CONFIRMATION_PATTERNS.no) {
    if (pattern.test(trimmed)) {
      return 'no';
    }
  }

  return null;
}

/**
 * Get examples for a specific command
 */
export function getIntentExamples(command: string): string[] {
  const pattern = INTENT_PATTERNS.find(p => p.command === command);
  return pattern?.examples || [];
}

/**
 * Get all available intent patterns (for help/documentation)
 */
export function getAllIntentPatterns(): IntentPattern[] {
  return INTENT_PATTERNS;
}
