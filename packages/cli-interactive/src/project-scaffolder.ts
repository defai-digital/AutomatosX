/**
 * Project Scaffolder
 *
 * Creates projects and scaffolds components from templates
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname, resolve, sep } from 'path';

export interface ProjectTemplate {
  name: string;
  description: string;
  files: TemplateFile[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface TemplateFile {
  path: string;
  content: string;
}

export interface ScaffoldOptions {
  name: string;
  template: string;
  install?: boolean;
  git?: boolean;
}

export interface ComponentOptions {
  name: string;
  type: string;
  path?: string;
}

export class ProjectScaffolder {
  constructor(private workspaceRoot: string) {}

  /**
   * BUG #30 FIX: Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * List available templates
   */
  listTemplates(): ProjectTemplate[] {
    return [
      {
        name: 'react',
        description: 'React application with Vite and TypeScript',
        files: [],
        dependencies: {
          'react': '^18.2.0',
          'react-dom': '^18.2.0'
        },
        devDependencies: {
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          '@vitejs/plugin-react': '^4.0.0',
          'typescript': '^5.0.0',
          'vite': '^5.0.0'
        }
      },
      {
        name: 'vue',
        description: 'Vue 3 application with Vite and TypeScript',
        files: [],
        dependencies: {
          'vue': '^3.3.0'
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^4.0.0',
          'typescript': '^5.0.0',
          'vite': '^5.0.0',
          'vue-tsc': '^1.8.0'
        }
      },
      {
        name: 'express',
        description: 'Express.js server with TypeScript',
        files: [],
        dependencies: {
          'express': '^4.18.0'
        },
        devDependencies: {
          '@types/express': '^4.17.0',
          '@types/node': '^20.0.0',
          'typescript': '^5.0.0',
          'tsx': '^4.0.0'
        }
      },
      {
        name: 'typescript',
        description: 'TypeScript library',
        files: [],
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0',
          'tsup': '^7.0.0',
          'vitest': '^1.0.0'
        }
      },
      {
        name: 'node',
        description: 'Node.js project with TypeScript',
        files: [],
        devDependencies: {
          'typescript': '^5.0.0',
          '@types/node': '^20.0.0',
          'tsx': '^4.0.0'
        }
      }
    ];
  }

  /**
   * Create project from template
   */
  async createProject(options: ScaffoldOptions): Promise<void> {
    // SECURITY: Validate project name - no path traversal
    if (!options.name || options.name.includes('..') || options.name.includes('/') || options.name.includes('\\')) {
      throw new Error('Invalid project name. Must not contain path separators or parent directory references.');
    }

    // SECURITY: Validate name format (alphanumeric, hyphens, underscores only)
    if (!/^[a-zA-Z0-9-_]+$/.test(options.name)) {
      throw new Error('Project name must contain only alphanumeric characters, hyphens, and underscores.');
    }

    const template = this.listTemplates().find(t => t.name === options.template);

    if (!template) {
      throw new Error(`Template not found: ${options.template}. Use /scaffold list to see available templates.`);
    }

    const projectPath = resolve(join(this.workspaceRoot, options.name));

    // SECURITY: Ensure projectPath is within workspace (prevent path traversal)
    if (!projectPath.startsWith(resolve(this.workspaceRoot))) {
      throw new Error('Project path escapes workspace root');
    }

    // Check if directory already exists
    if (existsSync(projectPath)) {
      throw new Error(`Directory already exists: ${options.name}`);
    }

    // Create project directory
    mkdirSync(projectPath, { recursive: true });

    // Generate files based on template
    const files = this.generateTemplateFiles(template, options.name);

    for (const file of files) {
      const filePath = join(projectPath, file.path);
      const dir = dirname(filePath); // BUG #14 FIX: Use dirname instead of join(..)

      // Create directory if it doesn't exist
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Write file
      writeFileSync(filePath, file.content, 'utf-8');
    }

    // Create package.json
    const packageJson = {
      name: options.name,
      version: '0.1.0',
      type: 'module',
      scripts: this.getScripts(template.name),
      dependencies: template.dependencies || {},
      devDependencies: template.devDependencies || {}
    };

    writeFileSync(
      join(projectPath, 'package.json'),
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    // Create .gitignore
    const gitignore = this.getGitignore();
    writeFileSync(join(projectPath, '.gitignore'), gitignore, 'utf-8');

    // Create README.md
    const readme = this.getReadme(options.name, template.description);
    writeFileSync(join(projectPath, 'README.md'), readme, 'utf-8');
  }

  /**
   * Scaffold component
   */
  async scaffoldComponent(options: ComponentOptions): Promise<void> {
    // BUG #16 FIX: Validate component name (must be valid identifier)
    if (!options.name || !/^[A-Z][a-zA-Z0-9]*$/.test(options.name)) {
      throw new Error(
        'Invalid component name. Must start with uppercase letter and contain only alphanumeric characters.'
      );
    }

    const content = this.generateComponent(options.type, options.name);
    const filePath = this.getComponentPath(options);

    const dir = join(filePath, '..');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
  }

  /**
   * Generate file from template
   */
  async generateFile(template: string, vars: Record<string, string>): Promise<string> {
    let content = template;

    for (const [key, value] of Object.entries(vars)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(regex, value);
    }

    return content;
  }

  /**
   * Generate template files
   */
  private generateTemplateFiles(template: ProjectTemplate, name: string): TemplateFile[] {
    const files: TemplateFile[] = [];

    switch (template.name) {
      case 'react':
        files.push(
          {
            path: 'src/main.tsx',
            content: this.getReactMain()
          },
          {
            path: 'src/App.tsx',
            content: this.getReactApp(name)
          },
          {
            path: 'index.html',
            content: this.getReactHtml(name)
          },
          {
            path: 'vite.config.ts',
            content: this.getViteConfig('react')
          },
          {
            path: 'tsconfig.json',
            content: this.getTsConfig('react')
          }
        );
        break;

      case 'vue':
        files.push(
          {
            path: 'src/main.ts',
            content: this.getVueMain()
          },
          {
            path: 'src/App.vue',
            content: this.getVueApp(name)
          },
          {
            path: 'index.html',
            content: this.getVueHtml(name)
          },
          {
            path: 'vite.config.ts',
            content: this.getViteConfig('vue')
          },
          {
            path: 'tsconfig.json',
            content: this.getTsConfig('vue')
          }
        );
        break;

      case 'express':
        files.push(
          {
            path: 'src/index.ts',
            content: this.getExpressIndex()
          },
          {
            path: 'tsconfig.json',
            content: this.getTsConfig('node')
          }
        );
        break;

      case 'typescript':
      case 'node':
        files.push(
          {
            path: 'src/index.ts',
            content: this.getNodeIndex()
          },
          {
            path: 'tsconfig.json',
            content: this.getTsConfig('node')
          }
        );
        break;
    }

    return files;
  }

  /**
   * Get scripts for package.json
   */
  private getScripts(template: string): Record<string, string> {
    const scripts: Record<string, string> = {};

    switch (template) {
      case 'react':
      case 'vue':
        scripts['dev'] = 'vite';
        scripts['build'] = 'vite build';
        scripts['preview'] = 'vite preview';
        break;

      case 'express':
        scripts['dev'] = 'tsx watch src/index.ts';
        scripts['build'] = 'tsc';
        scripts['start'] = 'node dist/index.js';
        break;

      case 'typescript':
        scripts['dev'] = 'tsup --watch';
        scripts['build'] = 'tsup';
        scripts['test'] = 'vitest';
        break;

      case 'node':
        scripts['dev'] = 'tsx src/index.ts';
        scripts['build'] = 'tsc';
        scripts['start'] = 'node dist/index.js';
        break;
    }

    return scripts;
  }

  /**
   * Get .gitignore content
   */
  private getGitignore(): string {
    return `node_modules
dist
.env
.env.local
*.log
.DS_Store
coverage
.vite
.turbo
`;
  }

  /**
   * Get README.md content
   */
  private getReadme(name: string, description: string): string {
    return `# ${name}

${description}

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
\`\`\`

## License

MIT
`;
  }

  // Template generators
  private getReactMain(): string {
    return `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
  }

  private getReactApp(name: string): string {
    return `function App() {
  return (
    <div>
      <h1>${name}</h1>
      <p>Welcome to your new React app!</p>
    </div>
  )
}

export default App
`;
  }

  private getReactHtml(name: string): string {
    const safeName = this.escapeHtml(name); // BUG #30 FIX: Escape HTML to prevent XSS
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
  }

  private getVueMain(): string {
    return `import { createApp } from 'vue'
import App from './App.vue'

createApp(App).mount('#app')
`;
  }

  private getVueApp(name: string): string {
    return `<template>
  <div>
    <h1>${name}</h1>
    <p>Welcome to your new Vue app!</p>
  </div>
</template>

<script setup lang="ts">
</script>
`;
  }

  private getVueHtml(name: string): string {
    const safeName = this.escapeHtml(name); // BUG #30 FIX: Escape HTML to prevent XSS
    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
  }

  private getExpressIndex(): string {
    return `import express from 'express'

const app = express()
const port = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Hello World!' })
})

app.listen(port, () => {
  console.log(\`Server running on port \${port}\`)
})
`;
  }

  private getNodeIndex(): string {
    return `export function hello(name: string): string {
  return \`Hello, \${name}!\`
}

console.log(hello('World'))
`;
  }

  private getViteConfig(type: 'react' | 'vue'): string {
    const plugin = type === 'react' ? 'react' : 'vue';
    return `import { defineConfig } from 'vite'
import ${plugin} from '@vitejs/plugin-${plugin}'

export default defineConfig({
  plugins: [${plugin}()],
})
`;
  }

  private getTsConfig(type: 'react' | 'vue' | 'node'): string {
    const lib = type === 'node' ? '["ES2022"]' : '["ES2022", "DOM", "DOM.Iterable"]';

    // BUG #15 FIX: Only include jsx for react, and ensure valid JSON
    const jsxLine = type === 'react' ? '"jsx": "react-jsx",' : '';

    return `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ${lib},
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,${jsxLine ? '\n    ' + jsxLine : ''}
    "outDir": "dist"
  },
  "include": ["src"]
}
`;
  }

  private generateComponent(type: string, name: string): string {
    switch (type) {
      case 'component':
        return `interface ${name}Props {
  // Add props here
}

export function ${name}(props: ${name}Props) {
  return (
    <div>
      <h2>${name}</h2>
    </div>
  )
}
`;

      case 'test':
        return `import { describe, it, expect } from 'vitest'

describe('${name}', () => {
  it('should work', () => {
    expect(true).toBe(true)
  })
})
`;

      default:
        return `// ${name}\n`;
    }
  }

  private getComponentPath(options: ComponentOptions): string {
    const ext = options.type === 'test' ? '.test.ts' : '.tsx';
    const fileName = `${options.name}${ext}`;

    let basePath: string;
    if (options.path) {
      // BUG #28 FIX: Validate BEFORE resolving to prevent normalization tricks
      // Check for parent directory references
      if (options.path.includes('..')) {
        throw new Error('Invalid path: must not contain parent directory references (..)');
      }

      // BUG #29 FIX: Check for absolute paths
      if (options.path.startsWith('/') || /^[a-zA-Z]:[\\\/]/.test(options.path)) {
        throw new Error('Invalid path: must be relative, not absolute');
      }

      // BUG #29 FIX: Validate path contains only safe characters
      if (!/^[a-zA-Z0-9\-_\/]+$/.test(options.path)) {
        throw new Error('Invalid path: must contain only alphanumeric characters, hyphens, underscores, and slashes');
      }

      // Now resolve and double-check workspace boundary
      const fullPath = resolve(join(this.workspaceRoot, options.path));
      const workspaceNormalized = resolve(this.workspaceRoot);

      // Ensure path is within workspace (use path separator to prevent prefix matching)
      if (!fullPath.startsWith(workspaceNormalized + sep) && fullPath !== workspaceNormalized) {
        throw new Error('Component path escapes workspace root');
      }

      basePath = fullPath;
    } else {
      basePath = join(this.workspaceRoot, 'src');
    }

    return join(basePath, fileName);
  }
}
