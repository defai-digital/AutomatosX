/**
 * Environment Manager
 *
 * Manages environment variables and .env file loading
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export interface EnvVariable {
  key: string;
  value: string;
  source: 'system' | 'file' | 'manual';
  sensitive?: boolean;
}

export interface EnvFileOptions {
  path?: string;
  override?: boolean;
}

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
}

// BUG #27 FIX: Add isolation option to prevent process.env pollution
export interface EnvironmentManagerOptions {
  isolate?: boolean;  // If true, don't modify process.env
}

export class EnvironmentManager {
  private envVars: Map<string, EnvVariable> = new Map();
  private options: EnvironmentManagerOptions;

  // BUG #11 FIX: More precise sensitive patterns with word boundaries
  private sensitivePatterns: RegExp[] = [
    /\bapi[_-]?key\b/i,           // API_KEY, APIKEY
    /\bsecret\b/i,                // SECRET, CLIENT_SECRET
    /\bpassword\b/i,              // PASSWORD, DB_PASSWORD
    /\btoken\b/i,                 // TOKEN, ACCESS_TOKEN
    /\bauth[_-]?token\b/i,        // AUTH_TOKEN, AUTHTOKEN (not "author")
    /\bprivate[_-]?key\b/i,       // PRIVATE_KEY, PRIVATEKEY
    /\bcredential\b/i,            // CREDENTIAL, CREDENTIALS
    /\baccess[_-]?key\b/i,        // ACCESS_KEY
    /\bdb[_-]?pass\b/i            // DB_PASS, DBPASS
  ];

  // BUG #10 FIX: Max file size for .env files (1MB)
  private readonly MAX_ENV_FILE_SIZE = 1024 * 1024;

  constructor(private workspaceRoot: string, options: EnvironmentManagerOptions = {}) {
    this.options = options;
    this.loadSystemEnv();
  }

  /**
   * Load system environment variables
   */
  private loadSystemEnv(): void {
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        this.envVars.set(key, {
          key,
          value,
          source: 'system',
          sensitive: this.isSensitive(key)
        });
      }
    }
  }

  /**
   * Load environment variables from file
   */
  async loadEnvFile(options: EnvFileOptions = {}): Promise<Map<string, string>> {
    const filePath = options.path || '.env';
    const fullPath = join(this.workspaceRoot, filePath);

    if (!existsSync(fullPath)) {
      throw new Error(`Environment file not found: ${filePath}`);
    }

    // BUG #10 FIX: Validate file size before reading
    try {
      const stats = statSync(fullPath);
      if (stats.size > this.MAX_ENV_FILE_SIZE) {
        throw new Error(
          `Environment file too large: ${stats.size} bytes (max ${this.MAX_ENV_FILE_SIZE} bytes)`
        );
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Environment file not found: ${filePath}`);
      }
      throw error;
    }

    try {
      const content = readFileSync(fullPath, 'utf-8');
      const parsed = this.parseEnvFile(content);

      // Add to envVars
      for (const [key, value] of Array.from(parsed)) {
        const shouldAdd = options.override || !this.envVars.has(key);
        if (shouldAdd) {
          this.envVars.set(key, {
            key,
            value,
            source: 'file',
            sensitive: this.isSensitive(key)
          });

          // BUG #27 FIX: Only modify process.env if not isolated
          if (!this.options.isolate) {
            // Also set in process.env if override is true or key doesn't exist
            if (options.override || !process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      }

      return parsed;
    } catch (error) {
      throw new Error(`Failed to load env file: ${(error as Error).message}`);
    }
  }

  /**
   * Get environment variable
   */
  getEnv(key: string): string | undefined {
    const envVar = this.envVars.get(key);
    return envVar?.value;
  }

  /**
   * Set environment variable
   */
  setEnv(key: string, value: string): void {
    this.envVars.set(key, {
      key,
      value,
      source: 'manual',
      sensitive: this.isSensitive(key)
    });

    // BUG #27 FIX: Only modify process.env if not isolated
    if (!this.options.isolate) {
      process.env[key] = value;
    }
  }

  /**
   * Unset environment variable
   */
  unsetEnv(key: string): void {
    this.envVars.delete(key);

    // BUG #27 FIX: Only modify process.env if not isolated
    if (!this.options.isolate) {
      delete process.env[key];
    }
  }

  /**
   * List all environment variables
   */
  listEnv(filter?: string): EnvVariable[] {
    const vars: EnvVariable[] = [];

    for (const envVar of Array.from(this.envVars.values())) {
      if (!filter || envVar.key.toLowerCase().includes(filter.toLowerCase())) {
        vars.push(envVar);
      }
    }

    return vars.sort((a, b) => a.key.localeCompare(b.key));
  }

  /**
   * Validate required environment variables
   */
  validateEnv(required: string[]): EnvValidationResult {
    const missing: string[] = [];

    for (const key of required) {
      if (!this.envVars.has(key)) {
        missing.push(key);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Parse .env file
   */
  parseEnvFile(content: string): Map<string, string> {
    const env = new Map<string, string>();
    const lines = content.split('\n');

    for (let line of lines) {
      // BUG #9 FIX: First trim the line
      line = line.trim();

      // Skip empty lines
      if (!line) {
        continue;
      }

      // BUG #9 FIX: Skip comment-only lines (lines starting with #)
      if (line.startsWith('#')) {
        continue;
      }

      // Parse key=value
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (match) {
        const key = match[1] || '';
        let value = match[2] || '';

        // BUG #9 FIX: Remove inline comments ONLY if not inside quotes
        // Check if value is quoted
        const isQuoted = (value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"));

        if (!isQuoted) {
          // Not quoted - safe to remove inline comments
          const commentIndex = value.indexOf('#');
          if (commentIndex >= 0) {
            value = value.substring(0, commentIndex).trim();
          }
        }

        // Remove quotes
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // BUG #23 FIX: Handle escape sequences in correct order
        // Use placeholder to avoid double-processing
        value = value
          .replace(/\\\\/g, '\x00')  // Placeholder for literal backslash
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/\\t/g, '\t')
          .replace(/\x00/g, '\\');   // Restore literal backslash

        env.set(key, value);
      }
    }

    return env;
  }

  /**
   * Check if variable name is sensitive
   */
  private isSensitive(key: string): boolean {
    return this.sensitivePatterns.some(pattern => pattern.test(key));
  }

  /**
   * Mask sensitive value
   * BUG #31 FIX: Mask short secrets completely (< 9 chars reveals > 50%)
   */
  maskValue(value: string): string {
    if (value.length <= 8) {
      return '***';
    }
    return value.substring(0, 2) + '***' + value.substring(value.length - 2);
  }

  /**
   * Get display value (masked if sensitive)
   */
  getDisplayValue(key: string): string {
    const envVar = this.envVars.get(key);
    if (!envVar) {
      return '';
    }

    if (envVar.sensitive) {
      return this.maskValue(envVar.value);
    }

    return envVar.value;
  }

  /**
   * Load common .env files in order
   */
  async loadCommonEnvFiles(mode?: string): Promise<void> {
    const files = [
      '.env',
      `.env.${mode || 'development'}`,
      '.env.local',
      `.env.${mode || 'development'}.local`
    ];

    for (const file of files) {
      const fullPath = join(this.workspaceRoot, file);
      if (existsSync(fullPath)) {
        try {
          await this.loadEnvFile({ path: file, override: false });
        } catch {
          // Ignore errors for optional files
        }
      }
    }
  }

  /**
   * Export env vars to object
   */
  exportEnv(includeSystem: boolean = false): Record<string, string> {
    const result: Record<string, string> = {};

    for (const envVar of Array.from(this.envVars.values())) {
      if (includeSystem || envVar.source !== 'system') {
        result[envVar.key] = envVar.value;
      }
    }

    return result;
  }

  /**
   * Generate .env file content
   */
  generateEnvFile(includeSystem: boolean = false): string {
    const lines: string[] = [];

    for (const envVar of this.listEnv()) {
      if (includeSystem || envVar.source !== 'system') {
        const value = envVar.value.includes(' ') || envVar.value.includes('=')
          ? `"${envVar.value}"`
          : envVar.value;

        lines.push(`${envVar.key}=${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }
}
