/**
 * Regeneration Detector
 *
 * Detects when a spec has changed since DAG was generated and prompts for regeneration.
 * Uses SHA-256 hash comparison for change detection.
 *
 * @module core/spec/RegenerationDetector
 */

import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import * as readline from 'readline';
import type { DagJson } from '@/types/dag.js';
import { logger } from '@/utils/logger.js';

/**
 * Result of regeneration check
 */
export interface RegenerationCheckResult {
  /** Whether regeneration is needed */
  needsRegen: boolean;

  /** Reason for regeneration (if needed) */
  reason?: string;
}

/**
 * Regeneration detector for spec change detection
 */
export class RegenerationDetector {
  /**
   * Check if spec has changed since DAG was generated
   *
   * @param specPath - Path to spec file
   * @param dagPath - Path to DAG JSON file
   * @returns Regeneration check result
   */
  async needsRegeneration(
    specPath: string,
    dagPath: string
  ): Promise<RegenerationCheckResult> {
    try {
      // Validate paths
      if (!specPath || typeof specPath !== 'string') {
        throw new Error('specPath must be a non-empty string');
      }
      if (!dagPath || typeof dagPath !== 'string') {
        throw new Error('dagPath must be a non-empty string');
      }

      // Read spec file
      let specContent: string;
      try {
        specContent = await readFile(specPath, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new Error(`Spec file not found: ${specPath}`);
        }
        throw new Error(`Failed to read spec file: ${(error as Error).message}`);
      }

      // Calculate current spec hash
      const currentHash = this.calculateHash(specContent);

      // Read DAG file
      let dagContent: string;
      try {
        dagContent = await readFile(dagPath, 'utf-8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // DAG doesn't exist - regeneration needed
          logger.warn('DAG file not found, regeneration needed', { dagPath });
          return {
            needsRegen: true,
            reason: 'DAG file does not exist'
          };
        }
        throw new Error(`Failed to read DAG file: ${(error as Error).message}`);
      }

      // Parse DAG JSON
      let dag: DagJson;
      try {
        dag = JSON.parse(dagContent) as DagJson;
      } catch (error) {
        throw new Error(`Failed to parse DAG JSON: ${(error as Error).message}`);
      }

      // Validate DAG has specHash field
      if (!dag.specHash || typeof dag.specHash !== 'string') {
        logger.warn('DAG missing specHash field, regeneration needed', { dagPath });
        return {
          needsRegen: true,
          reason: 'DAG missing specHash field'
        };
      }

      // Compare hashes
      if (currentHash !== dag.specHash) {
        logger.info('Spec hash mismatch detected', {
          specPath,
          dagPath,
          currentHash: currentHash.substring(0, 8),
          dagHash: dag.specHash.substring(0, 8)
        });

        return {
          needsRegen: true,
          reason: 'Spec has changed since DAG was generated'
        };
      }

      // Hashes match - no regeneration needed
      logger.debug('Spec hash matches DAG, no regeneration needed', {
        specPath,
        dagPath,
        hash: currentHash.substring(0, 8)
      });

      return {
        needsRegen: false
      };
    } catch (error) {
      logger.error('Regeneration check failed', {
        specPath,
        dagPath,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Prompt user for regeneration confirmation
   *
   * @param specPath - Path to spec file (for display)
   * @returns True if user confirms, false otherwise
   */
  async promptRegeneration(specPath: string): Promise<boolean> {
    try {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question(
          `\n⚠️  Spec has changed: ${specPath}\nRegenerate DAG? (Y/n): `,
          (ans) => {
            rl.close();
            resolve(ans.trim());
          }
        );
      });

      // Accept Y/y/yes/YES or empty (default yes)
      const confirmed =
        answer === '' ||
        answer.toLowerCase() === 'y' ||
        answer.toLowerCase() === 'yes';

      logger.debug('Regeneration prompt result', {
        specPath,
        answer,
        confirmed
      });

      return confirmed;
    } catch (error) {
      logger.error('Regeneration prompt failed', {
        specPath,
        error: (error as Error).message
      });
      // On error, default to false (don't regenerate)
      return false;
    }
  }

  /**
   * Calculate SHA-256 hash of content
   *
   * Uses same algorithm as DagGenerator for consistency.
   *
   * @param content - Content to hash
   * @returns SHA-256 hash (hex string)
   */
  calculateHash(content: string): string {
    if (typeof content !== 'string') {
      throw new Error(`content must be a string, got ${typeof content}`);
    }

    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Create singleton instance
   */
  private static instance?: RegenerationDetector;

  /**
   * Get singleton instance
   */
  static getInstance(): RegenerationDetector {
    if (!RegenerationDetector.instance) {
      RegenerationDetector.instance = new RegenerationDetector();
    }
    return RegenerationDetector.instance;
  }
}

// Export singleton instance as default
export default RegenerationDetector.getInstance();
