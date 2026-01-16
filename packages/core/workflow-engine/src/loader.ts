/**
 * Workflow Loader
 *
 * Loads workflow definitions from YAML/JSON files.
 * Similar to AgentLoader but for workflow files.
 *
 * Invariants:
 * - INV-WF-LDR-001: All loaded workflows must pass schema validation
 * - INV-WF-LDR-002: File extensions must match configured extensions
 * - INV-WF-LDR-003: Workflow IDs must be unique across all loaded files
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowSchema, type Workflow } from '@defai.digital/contracts';

// ============================================================================
// Types
// ============================================================================

/**
 * Workflow loader configuration
 */
export interface WorkflowLoaderConfig {
  /**
   * Directory containing workflow files
   */
  workflowsDir: string;

  /**
   * File extensions to load (default: ['.yaml', '.yml', '.json'])
   */
  extensions?: string[];

  /**
   * Watch for file changes (default: false)
   */
  watch?: boolean;
}

/**
 * Workflow loader interface
 */
export interface WorkflowLoader {
  /**
   * Load a workflow by ID
   */
  load(workflowId: string): Promise<Workflow | undefined>;

  /**
   * Load all workflows from the directory
   */
  loadAll(): Promise<Workflow[]>;

  /**
   * Check if a workflow exists
   */
  exists(workflowId: string): Promise<boolean>;

  /**
   * Reload all workflows
   */
  reload(): Promise<void>;

  /**
   * Get workflow count
   */
  count(): number;
}

/**
 * Workflow info for listing (lightweight representation)
 */
export interface WorkflowInfo {
  id: string;
  name: string;
  version: string;
  description: string | undefined;
  stepCount: number;
  status: 'active' | 'inactive' | 'draft';
  filePath: string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_EXTENSIONS = ['.yaml', '.yml', '.json'];

// ============================================================================
// File System Workflow Loader
// ============================================================================

/**
 * Loads workflow definitions from the file system
 */
export class FileSystemWorkflowLoader implements WorkflowLoader {
  private readonly config: Required<WorkflowLoaderConfig>;
  private cache = new Map<string, Workflow>();
  private filePathMap = new Map<string, string>();
  private loaded = false;

  constructor(config: WorkflowLoaderConfig) {
    this.config = {
      workflowsDir: config.workflowsDir,
      extensions: config.extensions ?? DEFAULT_EXTENSIONS,
      watch: config.watch ?? false,
    };
  }

  /**
   * Load a workflow by ID
   */
  async load(workflowId: string): Promise<Workflow | undefined> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.get(workflowId);
  }

  /**
   * Load all workflows from the directory
   */
  async loadAll(): Promise<Workflow[]> {
    this.cache.clear();
    this.filePathMap.clear();

    const dirPath = this.config.workflowsDir;

    // Check if directory exists
    if (!fs.existsSync(dirPath)) {
      this.loaded = true;
      return [];
    }

    const files = fs.readdirSync(dirPath);
    const workflows: Workflow[] = [];

    // Filter valid files first (sync operations)
    const validFiles = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        if (!this.config.extensions.includes(ext)) return false;

        const filePath = path.join(dirPath, file);
        const stat = fs.statSync(filePath);
        return !stat.isDirectory();
      })
      .map((file) => ({ file, filePath: path.join(dirPath, file) }));

    // Load all files in parallel for better performance
    const loadResults = await Promise.all(
      validFiles.map(async ({ file, filePath }) => {
        const workflow = await this.loadFile(filePath);
        return { file, filePath, workflow };
      })
    );

    // Process results sequentially to handle duplicates consistently
    for (const { file, filePath, workflow } of loadResults) {
      if (workflow) {
        // INV-WF-LDR-003: Check for duplicate workflow IDs
        if (this.cache.has(workflow.workflowId)) {
          console.warn(
            `Duplicate workflow ID "${workflow.workflowId}" found in ${file}, skipping`
          );
          continue;
        }

        this.cache.set(workflow.workflowId, workflow);
        this.filePathMap.set(workflow.workflowId, filePath);
        workflows.push(workflow);
      }
    }

    this.loaded = true;
    return workflows;
  }

  /**
   * Check if a workflow exists
   */
  async exists(workflowId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.has(workflowId);
  }

  /**
   * Reload all workflows
   */
  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  /**
   * Get workflow count
   */
  count(): number {
    return this.cache.size;
  }

  /**
   * Get all workflow infos (lightweight listing)
   */
  async listAll(): Promise<WorkflowInfo[]> {
    if (!this.loaded) {
      await this.loadAll();
    }

    const infos: WorkflowInfo[] = [];

    for (const [workflowId, workflow] of this.cache) {
      infos.push({
        id: workflowId,
        name: workflow.name ?? workflowId,
        version: workflow.version,
        description: workflow.description,
        stepCount: workflow.steps.length,
        status: this.inferStatus(workflow),
        filePath: this.filePathMap.get(workflowId) ?? '',
      });
    }

    return infos;
  }

  /**
   * Get file path for a workflow
   */
  getFilePath(workflowId: string): string | undefined {
    return this.filePathMap.get(workflowId);
  }

  /**
   * Load a single workflow from a file
   */
  private async loadFile(filePath: string): Promise<Workflow | undefined> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      let data: unknown;
      if (ext === '.json') {
        data = JSON.parse(content);
      } else {
        data = parseYaml(content);
      }

      // INV-WF-LDR-001: Validate against schema
      const result = WorkflowSchema.safeParse(data);

      if (!result.success) {
        const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        console.warn(`Invalid workflow in ${filePath}: ${errors}`);
        return undefined;
      }

      return result.data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to load workflow from ${filePath}: ${message}`);
      return undefined;
    }
  }

  /**
   * Infer workflow status from metadata
   */
  private inferStatus(workflow: Workflow): 'active' | 'inactive' | 'draft' {
    // Check metadata for explicit status
    const metadata = workflow.metadata;
    if (metadata?.status === 'inactive') return 'inactive';
    if (metadata?.status === 'draft') return 'draft';

    // Check if name contains draft indicator
    if (workflow.name?.toLowerCase().includes('draft')) return 'draft';
    if (workflow.name?.toLowerCase().includes('wip')) return 'draft';

    // Default to active
    return 'active';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a file system workflow loader
 */
export function createWorkflowLoader(config: WorkflowLoaderConfig): FileSystemWorkflowLoader {
  return new FileSystemWorkflowLoader(config);
}

/**
 * Default workflow directories to search
 */
export const DEFAULT_WORKFLOW_DIRS = [
  'examples/workflows',
  'workflows',
  '.automatosx/workflows',
];

/**
 * Finds the first existing workflow directory
 */
export function findWorkflowDir(basePath: string): string | undefined {
  for (const dir of DEFAULT_WORKFLOW_DIRS) {
    const fullPath = path.join(basePath, dir);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}
