import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { WorkflowSchema, type Workflow } from '@defai.digital/contracts';

export interface WorkflowLoaderConfig {
  workflowsDir: string;
  extensions?: string[];
  watch?: boolean;
  silent?: boolean;
}

export interface WorkflowLoader {
  load: (workflowId: string) => Promise<Workflow | undefined>;
  loadAll: () => Promise<Workflow[]>;
  exists: (workflowId: string) => Promise<boolean>;
  reload: () => Promise<void>;
  count: () => number;
}

export interface WorkflowInfo {
  id: string;
  name: string;
  version: string;
  description: string | undefined;
  stepCount: number;
  status: 'active' | 'inactive' | 'draft';
  filePath: string;
}

const DEFAULT_EXTENSIONS = ['.yaml', '.yml', '.json'];
const MAX_WARNED_FILES = 500;
const warnedFiles = new Set<string>();

export class FileSystemWorkflowLoader implements WorkflowLoader {
  private readonly config: Required<Omit<WorkflowLoaderConfig, 'silent'>> & { silent: boolean };
  private cache = new Map<string, Workflow>();
  private filePathMap = new Map<string, string>();
  private loaded = false;
  private loadingPromise: Promise<Workflow[]> | null = null;

  constructor(config: WorkflowLoaderConfig) {
    this.config = {
      workflowsDir: config.workflowsDir,
      extensions: config.extensions ?? DEFAULT_EXTENSIONS,
      watch: config.watch ?? false,
      silent: config.silent ?? false,
    };
  }

  async load(workflowId: string): Promise<Workflow | undefined> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.get(workflowId);
  }

  async loadAll(): Promise<Workflow[]> {
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    if (this.loaded) {
      return Array.from(this.cache.values());
    }

    this.loadingPromise = this.performLoad();
    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = null;
    }
  }

  async exists(workflowId: string): Promise<boolean> {
    if (!this.loaded) {
      await this.loadAll();
    }
    return this.cache.has(workflowId);
  }

  async reload(): Promise<void> {
    this.loaded = false;
    await this.loadAll();
  }

  count(): number {
    return this.cache.size;
  }

  async listAll(): Promise<WorkflowInfo[]> {
    if (!this.loaded) {
      await this.loadAll();
    }

    return Array.from(this.cache.entries()).map(([workflowId, workflow]) => ({
      id: workflowId,
      name: workflow.name ?? workflowId,
      version: workflow.version,
      description: workflow.description,
      stepCount: workflow.steps.length,
      status: 'active',
      filePath: this.filePathMap.get(workflowId) ?? '',
    }));
  }

  private async performLoad(): Promise<Workflow[]> {
    this.cache.clear();
    this.filePathMap.clear();

    if (!fs.existsSync(this.config.workflowsDir)) {
      this.loaded = true;
      return [];
    }

    const validFiles = fs.readdirSync(this.config.workflowsDir)
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        if (!this.config.extensions.includes(ext)) {
          return false;
        }
        const filePath = path.join(this.config.workflowsDir, file);
        return !fs.statSync(filePath).isDirectory();
      })
      .map((file) => ({ file, filePath: path.join(this.config.workflowsDir, file) }));

    const loadResults = await Promise.all(
      validFiles.map(async ({ file, filePath }) => ({
        file,
        filePath,
        workflow: await this.loadFile(filePath),
      })),
    );

    const workflows: Workflow[] = [];
    for (const { file, filePath, workflow } of loadResults) {
      if (workflow === null) {
        continue;
      }
      if (this.cache.has(workflow.workflowId)) {
        if (!this.config.silent && !warnedFiles.has(`dup:${filePath}`)) {
          if (warnedFiles.size >= MAX_WARNED_FILES) {
            warnedFiles.clear();
          }
          warnedFiles.add(`dup:${filePath}`);
          console.warn(`Duplicate workflow ID "${workflow.workflowId}" found in ${file}, skipping`);
        }
        continue;
      }
      this.cache.set(workflow.workflowId, workflow);
      this.filePathMap.set(workflow.workflowId, filePath);
      workflows.push(workflow);
    }

    this.loaded = true;
    return workflows;
  }

  private async loadFile(filePath: string): Promise<Workflow | null> {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath).toLowerCase();
      const data = ext === '.json' ? JSON.parse(raw) : parseYaml(raw);
      return WorkflowSchema.parse(data);
    } catch (error) {
      if (!this.config.silent && !warnedFiles.has(filePath)) {
        if (warnedFiles.size >= MAX_WARNED_FILES) {
          warnedFiles.clear();
        }
        warnedFiles.add(filePath);
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to load workflow from ${filePath}: ${message}`);
      }
      return null;
    }
  }
}

export function createWorkflowLoader(config: WorkflowLoaderConfig): FileSystemWorkflowLoader {
  return new FileSystemWorkflowLoader(config);
}

export const DEFAULT_WORKFLOW_DIRS = [
  'examples/workflows',
  'workflows',
  '.automatosx/workflows',
];

export function findWorkflowDir(basePath: string): string | undefined {
  for (const dir of DEFAULT_WORKFLOW_DIRS) {
    const fullPath = path.join(basePath, dir);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return undefined;
}

export function clearWarnedFilesCache(): void {
  warnedFiles.clear();
}
