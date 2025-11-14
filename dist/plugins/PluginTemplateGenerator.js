/**
 * Plugin Template Generator
 * Sprint 6 Day 51: Enhanced template generator with category selection
 */
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
/**
 * Plugin category
 */
export var PluginCategory;
(function (PluginCategory) {
    PluginCategory["AGENT"] = "agent";
    PluginCategory["TOOL"] = "tool";
    PluginCategory["WORKFLOW"] = "workflow";
    PluginCategory["HYBRID"] = "hybrid";
})(PluginCategory || (PluginCategory = {}));
/**
 * Plugin language
 */
export var PluginLanguage;
(function (PluginLanguage) {
    PluginLanguage["TYPESCRIPT"] = "typescript";
    PluginLanguage["JAVASCRIPT"] = "javascript";
    PluginLanguage["PYTHON"] = "python";
})(PluginLanguage || (PluginLanguage = {}));
/**
 * Plugin template generator
 */
export class PluginTemplateGenerator extends EventEmitter {
    templates = new Map();
    constructor() {
        super();
        this.initializeBuiltInTemplates();
    }
    /**
     * Generate plugin from template
     */
    async generate(options, outputDir) {
        const errors = [];
        const filesCreated = [];
        try {
            // Validate options
            const validation = this.validateOptions(options);
            if (!validation.valid) {
                return {
                    success: false,
                    outputPath: outputDir,
                    filesCreated: [],
                    errors: validation.errors,
                };
            }
            // Get template files
            const templates = this.getTemplateFiles(options.category, options.language);
            if (templates.length === 0) {
                return {
                    success: false,
                    outputPath: outputDir,
                    filesCreated: [],
                    errors: [`No template found for ${options.category} in ${options.language}`],
                };
            }
            // Create output directory
            const pluginDir = path.join(outputDir, options.name);
            await fs.mkdir(pluginDir, { recursive: true });
            // Generate files
            for (const template of templates) {
                const filePath = path.join(pluginDir, template.path);
                const content = this.interpolateTemplate(template.content, options);
                // Create directory if needed
                const dir = path.dirname(filePath);
                await fs.mkdir(dir, { recursive: true });
                // Write file
                await fs.writeFile(filePath, content, 'utf-8');
                filesCreated.push(template.path);
                this.emit('file-created', { path: template.path, plugin: options.name });
            }
            // Generate optional files
            if (options.includeTests) {
                const testFiles = this.generateTestFiles(options);
                for (const testFile of testFiles) {
                    const filePath = path.join(pluginDir, testFile.path);
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, testFile.content, 'utf-8');
                    filesCreated.push(testFile.path);
                }
            }
            if (options.includeDocs) {
                const docFiles = this.generateDocFiles(options);
                for (const docFile of docFiles) {
                    const filePath = path.join(pluginDir, docFile.path);
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, docFile.content, 'utf-8');
                    filesCreated.push(docFile.path);
                }
            }
            if (options.includeExamples) {
                const exampleFiles = this.generateExampleFiles(options);
                for (const exampleFile of exampleFiles) {
                    const filePath = path.join(pluginDir, exampleFile.path);
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, exampleFile.content, 'utf-8');
                    filesCreated.push(exampleFile.path);
                }
            }
            this.emit('generation-complete', {
                plugin: options.name,
                category: options.category,
                filesCreated: filesCreated.length,
            });
            return {
                success: true,
                outputPath: pluginDir,
                filesCreated,
            };
        }
        catch (error) {
            errors.push(error instanceof Error ? error.message : 'Unknown error');
            return {
                success: false,
                outputPath: outputDir,
                filesCreated,
                errors,
            };
        }
    }
    /**
     * Validate template options
     */
    validateOptions(options) {
        const errors = [];
        if (!options.name || options.name.trim().length === 0) {
            errors.push('Plugin name is required');
        }
        if (!/^[a-z0-9-]+$/.test(options.name)) {
            errors.push('Plugin name must contain only lowercase letters, numbers, and hyphens');
        }
        if (!Object.values(PluginCategory).includes(options.category)) {
            errors.push(`Invalid category: ${options.category}`);
        }
        if (!Object.values(PluginLanguage).includes(options.language)) {
            errors.push(`Invalid language: ${options.language}`);
        }
        return {
            valid: errors.length === 0,
            errors,
        };
    }
    /**
     * Get template files for category and language
     */
    getTemplateFiles(category, language) {
        const categoryTemplates = this.templates.get(category);
        if (!categoryTemplates)
            return [];
        const languageTemplates = categoryTemplates.get(language);
        return languageTemplates || [];
    }
    /**
     * Interpolate template with options
     */
    interpolateTemplate(template, options) {
        return template
            .replace(/{{name}}/g, options.name)
            .replace(/{{Name}}/g, this.toPascalCase(options.name))
            .replace(/{{description}}/g, options.description || 'A new plugin')
            .replace(/{{author}}/g, options.author || 'AutomatosX Developer')
            .replace(/{{version}}/g, options.version || '1.0.0')
            .replace(/{{category}}/g, options.category)
            .replace(/{{language}}/g, options.language);
    }
    /**
     * Convert kebab-case to PascalCase
     */
    toPascalCase(str) {
        return str
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
    /**
     * Generate test files
     */
    generateTestFiles(options) {
        const ext = options.language === PluginLanguage.TYPESCRIPT ? 'ts' : 'js';
        return [
            {
                path: `__tests__/${options.name}.test.${ext}`,
                content: `/**
 * ${this.toPascalCase(options.name)} Tests
 */

import { describe, it, expect } from 'vitest'
import { ${this.toPascalCase(options.name)} } from '../src/index.${ext === 'ts' ? 'js' : 'js'}'

describe('${this.toPascalCase(options.name)}', () => {
  it('should be defined', () => {
    expect(${this.toPascalCase(options.name)}).toBeDefined()
  })

  // Add more tests here
})
`,
            },
        ];
    }
    /**
     * Generate documentation files
     */
    generateDocFiles(options) {
        return [
            {
                path: 'README.md',
                content: `# ${this.toPascalCase(options.name)}

${options.description || 'A new AutomatosX plugin'}

## Installation

\`\`\`bash
ax plugin install ${options.name}
\`\`\`

## Usage

\`\`\`${options.language}
// Add usage examples here
\`\`\`

## Configuration

// Add configuration options here

## License

MIT
`,
            },
        ];
    }
    /**
     * Generate example files
     */
    generateExampleFiles(options) {
        const ext = options.language === PluginLanguage.TYPESCRIPT ? 'ts' : 'js';
        return [
            {
                path: `examples/basic.${ext}`,
                content: `/**
 * Basic usage example for ${this.toPascalCase(options.name)}
 */

import { ${this.toPascalCase(options.name)} } from '../src/index.${ext === 'ts' ? 'js' : 'js'}'

// Add example code here
console.log('Example: ${options.name}')
`,
            },
        ];
    }
    /**
     * Register custom template
     */
    registerTemplate(category, language, files) {
        let categoryTemplates = this.templates.get(category);
        if (!categoryTemplates) {
            categoryTemplates = new Map();
            this.templates.set(category, categoryTemplates);
        }
        categoryTemplates.set(language, files);
        this.emit('template-registered', { category, language, fileCount: files.length });
    }
    /**
     * Get available categories
     */
    getCategories() {
        return Object.values(PluginCategory);
    }
    /**
     * Get available languages
     */
    getLanguages() {
        return Object.values(PluginLanguage);
    }
    /**
     * Get template statistics
     */
    getStatistics() {
        let totalTemplates = 0;
        for (const categoryTemplates of this.templates.values()) {
            totalTemplates += categoryTemplates.size;
        }
        return {
            totalCategories: this.templates.size,
            totalLanguages: Object.values(PluginLanguage).length,
            totalTemplates,
        };
    }
    /**
     * Initialize built-in templates
     */
    initializeBuiltInTemplates() {
        // Agent templates
        this.registerTemplate(PluginCategory.AGENT, PluginLanguage.TYPESCRIPT, [
            {
                path: 'src/index.ts',
                content: `/**
 * {{Name}} Agent
 * {{description}}
 */

export class {{Name}}Agent {
  async execute(task: string): Promise<string> {
    // Implement agent logic here
    return \`Executed: \${task}\`
  }
}

export default {{Name}}Agent
`,
            },
            {
                path: 'package.json',
                content: `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  }
}
`,
            },
        ]);
        // Tool templates
        this.registerTemplate(PluginCategory.TOOL, PluginLanguage.TYPESCRIPT, [
            {
                path: 'src/index.ts',
                content: `/**
 * {{Name}} Tool
 * {{description}}
 */

export class {{Name}}Tool {
  async run(input: any): Promise<any> {
    // Implement tool logic here
    return { result: input }
  }
}

export default {{Name}}Tool
`,
            },
            {
                path: 'package.json',
                content: `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}
`,
            },
        ]);
        // Workflow templates
        this.registerTemplate(PluginCategory.WORKFLOW, PluginLanguage.TYPESCRIPT, [
            {
                path: 'src/index.ts',
                content: `/**
 * {{Name}} Workflow
 * {{description}}
 */

export class {{Name}}Workflow {
  async execute(steps: string[]): Promise<void> {
    for (const step of steps) {
      console.log(\`Executing step: \${step}\`)
      // Implement workflow step logic here
    }
  }
}

export default {{Name}}Workflow
`,
            },
            {
                path: 'package.json',
                content: `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "main": "dist/index.js"
}
`,
            },
        ]);
        // Hybrid templates
        this.registerTemplate(PluginCategory.HYBRID, PluginLanguage.TYPESCRIPT, [
            {
                path: 'src/index.ts',
                content: `/**
 * {{Name}} Hybrid Plugin
 * {{description}}
 */

export class {{Name}}Plugin {
  async execute(input: any): Promise<any> {
    // Implement hybrid logic here (agent + tool + workflow)
    return { result: input }
  }
}

export default {{Name}}Plugin
`,
            },
            {
                path: 'package.json',
                content: `{
  "name": "{{name}}",
  "version": "{{version}}",
  "description": "{{description}}",
  "author": "{{author}}",
  "main": "dist/index.js"
}
`,
            },
        ]);
    }
}
/**
 * Create plugin template generator
 */
export function createTemplateGenerator() {
    return new PluginTemplateGenerator();
}
/**
 * Global template generator
 */
let globalGenerator = null;
/**
 * Get global template generator
 */
export function getGlobalGenerator() {
    if (!globalGenerator) {
        globalGenerator = createTemplateGenerator();
    }
    return globalGenerator;
}
/**
 * Reset global template generator
 */
export function resetGlobalGenerator() {
    globalGenerator = null;
}
//# sourceMappingURL=PluginTemplateGenerator.js.map