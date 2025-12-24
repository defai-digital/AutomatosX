/**
 * Secret Detection Patterns
 *
 * Regex patterns for detecting hardcoded secrets in code.
 * Used by the secrets_detection gate.
 *
 * Invariants:
 * - INV-GUARD-SEC-004: No False Negatives - must detect common patterns
 */

export interface SecretPattern {
  /** Pattern identifier */
  name: string;

  /** Human-readable description */
  description: string;

  /** Regex pattern to match */
  pattern: RegExp;

  /** Severity level */
  severity: 'critical' | 'high' | 'medium' | 'low';

  /** File extensions this pattern applies to (empty = all) */
  fileExtensions?: string[];
}

/**
 * Common secret patterns for detection
 * INV-GUARD-SEC-004: Must detect AWS keys, GitHub tokens, API keys, passwords, connection strings
 */
export const SECRET_PATTERNS: SecretPattern[] = [
  // ============================================================================
  // API Keys - Generic
  // ============================================================================
  {
    name: 'generic_api_key',
    description: 'Generic API key assignment',
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][a-zA-Z0-9_\-]{20,}['"]/gi,
    severity: 'high',
  },
  {
    name: 'generic_secret',
    description: 'Generic secret assignment',
    pattern: /(?:secret|private[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'high',
  },
  {
    name: 'generic_token',
    description: 'Generic token assignment',
    pattern: /(?:auth[_-]?token|access[_-]?token|bearer[_-]?token)\s*[:=]\s*['"][a-zA-Z0-9_\-.]{20,}['"]/gi,
    severity: 'high',
  },

  // ============================================================================
  // Cloud Provider Keys
  // ============================================================================
  {
    name: 'aws_access_key',
    description: 'AWS Access Key ID',
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
  },
  {
    name: 'aws_secret_key',
    description: 'AWS Secret Access Key',
    pattern: /(?:aws[_-]?secret[_-]?access[_-]?key|aws[_-]?secret)\s*[:=]\s*['"][a-zA-Z0-9/+=]{40}['"]/gi,
    severity: 'critical',
  },
  {
    name: 'gcp_api_key',
    description: 'Google Cloud API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    severity: 'critical',
  },
  {
    name: 'azure_connection_string',
    description: 'Azure Storage Connection String',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/gi,
    severity: 'critical',
  },

  // ============================================================================
  // Version Control & CI/CD
  // ============================================================================
  {
    name: 'github_token',
    description: 'GitHub Personal Access Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
  },
  {
    name: 'github_oauth',
    description: 'GitHub OAuth Token',
    pattern: /gho_[A-Za-z0-9_]{36,}/g,
    severity: 'critical',
  },
  {
    name: 'gitlab_token',
    description: 'GitLab Personal Access Token',
    pattern: /glpat-[A-Za-z0-9_-]{20,}/g,
    severity: 'critical',
  },
  {
    name: 'npm_token',
    description: 'NPM Access Token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    severity: 'high',
  },

  // ============================================================================
  // Passwords
  // ============================================================================
  {
    name: 'password_assignment',
    description: 'Password assignment in code',
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: 'high',
  },
  {
    name: 'password_url',
    description: 'Password in URL',
    pattern: /:\/\/[^:]+:[^@]+@/g,
    severity: 'high',
  },

  // ============================================================================
  // Database Connection Strings
  // ============================================================================
  {
    name: 'mongodb_connection',
    description: 'MongoDB Connection String with credentials',
    pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: 'critical',
  },
  {
    name: 'postgres_connection',
    description: 'PostgreSQL Connection String with credentials',
    pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: 'critical',
  },
  {
    name: 'mysql_connection',
    description: 'MySQL Connection String with credentials',
    pattern: /mysql:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: 'critical',
  },
  {
    name: 'redis_connection',
    description: 'Redis Connection String with credentials',
    pattern: /redis:\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: 'high',
  },

  // ============================================================================
  // API Services
  // ============================================================================
  {
    name: 'stripe_key',
    description: 'Stripe API Key',
    pattern: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
  },
  {
    name: 'stripe_restricted',
    description: 'Stripe Restricted API Key',
    pattern: /rk_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'critical',
  },
  {
    name: 'slack_token',
    description: 'Slack Token',
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g,
    severity: 'high',
  },
  {
    name: 'slack_webhook',
    description: 'Slack Webhook URL',
    pattern: /hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[a-zA-Z0-9]+/g,
    severity: 'medium',
  },
  {
    name: 'sendgrid_key',
    description: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/g,
    severity: 'high',
  },
  {
    name: 'twilio_key',
    description: 'Twilio API Key',
    pattern: /SK[a-f0-9]{32}/g,
    severity: 'high',
  },

  // ============================================================================
  // Cryptographic Keys
  // ============================================================================
  {
    name: 'private_key_header',
    description: 'Private Key Header',
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
  },
  {
    name: 'jwt_secret',
    description: 'JWT Secret assignment',
    pattern: /(?:jwt[_-]?secret|jwt[_-]?key)\s*[:=]\s*['"][^'"]{16,}['"]/gi,
    severity: 'high',
  },

  // ============================================================================
  // AI/ML Services
  // ============================================================================
  {
    name: 'openai_key',
    description: 'OpenAI API Key',
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    severity: 'critical',
  },
  {
    name: 'anthropic_key',
    description: 'Anthropic API Key',
    pattern: /sk-ant-[a-zA-Z0-9_-]{95}/g,
    severity: 'critical',
  },
];

/**
 * File extensions to exclude from scanning
 */
export const EXCLUDED_EXTENSIONS = [
  '.min.js',
  '.min.css',
  '.map',
  '.lock',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
];

/**
 * Files/directories to always exclude
 */
export const EXCLUDED_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  'vendor',
];

/**
 * Checks if a file should be scanned
 */
export function shouldScanFile(filePath: string): boolean {
  // Check excluded extensions
  for (const ext of EXCLUDED_EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return false;
    }
  }

  // Check excluded paths
  for (const excludedPath of EXCLUDED_PATHS) {
    if (filePath.includes(`/${excludedPath}/`) || filePath.startsWith(`${excludedPath}/`)) {
      return false;
    }
  }

  return true;
}

/**
 * Gets patterns applicable to a file based on extension
 */
export function getPatternsForFile(filePath: string): SecretPattern[] {
  const ext = filePath.substring(filePath.lastIndexOf('.'));

  return SECRET_PATTERNS.filter((pattern) => {
    // If no file extension filter, apply to all
    if (pattern.fileExtensions === undefined || pattern.fileExtensions.length === 0) {
      return true;
    }
    return pattern.fileExtensions.includes(ext);
  });
}
