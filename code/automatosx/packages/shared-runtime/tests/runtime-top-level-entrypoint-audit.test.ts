import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const TOP_LEVEL_ENTRYPOINT = '@defai.digital/shared-runtime';
const ALLOWED_TOP_LEVEL_IMPORTS = new Set([
  'createSharedRuntimeService',
  'SharedRuntimeService',
  'RuntimeParallelTask',
  'RuntimeTraceTreeNode',
]);

function collectRepoSourceFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [join(root, 'packages'), join(root, 'tests')];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      continue;
    }

    for (const entry of readdirSync(current)) {
      if (entry === 'dist' || entry === 'node_modules') {
        continue;
      }

      const path = join(current, entry);
      const stats = statSync(path);
      if (stats.isDirectory()) {
        stack.push(path);
        continue;
      }

      if (path.endsWith('.ts')) {
        files.push(path);
      }
    }
  }

  return files;
}

function collectTopLevelEntrypointImports(root: string): Array<{ file: string; name: string }> {
  const imports: Array<{ file: string; name: string }> = [];

  for (const file of collectRepoSourceFiles(root)) {
    const source = readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

    for (const statement of sourceFile.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) {
        continue;
      }
      if (statement.moduleSpecifier === undefined) {
        continue;
      }

      const moduleName = statement.moduleSpecifier.getText(sourceFile).slice(1, -1);
      if (moduleName !== TOP_LEVEL_ENTRYPOINT) {
        continue;
      }

      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (clause === undefined) {
          continue;
        }

        if (clause.name !== undefined) {
          imports.push({ file, name: clause.name.text });
        }

        if (clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            imports.push({
              file,
              name: element.propertyName?.text ?? element.name.text,
            });
          }
        }
        continue;
      }

      if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          imports.push({
            file,
            name: element.propertyName?.text ?? element.name.text,
          });
        }
      }
    }
  }

  return imports;
}

describe('shared-runtime top-level entrypoint audit', () => {
  it('keeps top-level imports focused on the runtime service and shared runtime-adjacent types', () => {
    const topLevelImports = collectTopLevelEntrypointImports(REPO_ROOT);
    const disallowed = topLevelImports
      .filter((entry) => !ALLOWED_TOP_LEVEL_IMPORTS.has(entry.name))
      .map((entry) => `${relative(REPO_ROOT, entry.file)}:${entry.name}`)
      .sort();

    expect(topLevelImports.length).toBeGreaterThan(0);
    expect(disallowed).toEqual([]);
  });
});
