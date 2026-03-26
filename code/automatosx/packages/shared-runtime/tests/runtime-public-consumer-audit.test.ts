import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  EXPECTED_AGENT_CATALOG_PUBLIC_TYPES,
  EXPECTED_BRIDGE_CONTRACT_PUBLIC_TYPES,
  EXPECTED_BRIDGE_RUNTIME_PUBLIC_TYPES,
  EXPECTED_GOVERNANCE_SUMMARY_PUBLIC_TYPES,
  EXPECTED_REVIEW_PUBLIC_TYPES,
  EXPECTED_RUNTIME_VALUE_EXPORTS,
  EXPECTED_WORKFLOW_CATALOG_PUBLIC_TYPES,
  INTENTIONALLY_UNCONSUMED_RUNTIME_VALUE_EXPORTS,
} from './support/runtime-public-api-manifest.js';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');
const SHARED_RUNTIME_PACKAGE_NAME = '@defai.digital/shared-runtime';

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

function collectRuntimePackageConsumers(root: string): {
  valueConsumers: Set<string>;
  typeConsumers: Set<string>;
  consumerFiles: Set<string>;
} {
  const valueConsumers = new Set<string>();
  const typeConsumers = new Set<string>();
  const consumerFiles = new Set<string>();
  const files = collectRepoSourceFiles(root);

  for (const file of files) {
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
      if (moduleName !== SHARED_RUNTIME_PACKAGE_NAME) {
        continue;
      }
      consumerFiles.add(file);

      if (ts.isImportDeclaration(statement)) {
        const clause = statement.importClause;
        if (clause === undefined) {
          continue;
        }

        if (clause.name !== undefined) {
          valueConsumers.add(clause.name.text);
        }

        if (clause.namedBindings !== undefined && ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) {
            const importedName = element.propertyName?.text ?? element.name.text;
            if (clause.isTypeOnly || element.isTypeOnly) {
              typeConsumers.add(importedName);
            } else {
              valueConsumers.add(importedName);
            }
          }
        }
        continue;
      }

      if (statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          const exportedName = element.propertyName?.text ?? element.name.text;
          if (statement.isTypeOnly || element.isTypeOnly) {
            typeConsumers.add(exportedName);
          } else {
            valueConsumers.add(exportedName);
          }
        }
      }
    }
  }

  return { valueConsumers, typeConsumers, consumerFiles };
}

describe('shared-runtime public consumer audit', () => {
  it('keeps only the intended direct-helper values publicly unconsumed inside the repo', () => {
    const consumers = collectRuntimePackageConsumers(REPO_ROOT);
    const unusedRuntimeValues = [...EXPECTED_RUNTIME_VALUE_EXPORTS]
      .filter((name) => !consumers.valueConsumers.has(name))
      .sort();

    expect(consumers.consumerFiles.size).toBeGreaterThan(0);
    expect(unusedRuntimeValues).toEqual([...INTENTIONALLY_UNCONSUMED_RUNTIME_VALUE_EXPORTS].sort());
  });

  it('keeps the curated bridge and catalog public types actively consumed by repo code', () => {
    const consumers = collectRuntimePackageConsumers(REPO_ROOT);
    const curatedPublicTypes = [
      ...EXPECTED_BRIDGE_CONTRACT_PUBLIC_TYPES,
      ...EXPECTED_BRIDGE_RUNTIME_PUBLIC_TYPES,
      ...EXPECTED_GOVERNANCE_SUMMARY_PUBLIC_TYPES,
      ...EXPECTED_REVIEW_PUBLIC_TYPES,
      ...EXPECTED_AGENT_CATALOG_PUBLIC_TYPES,
      ...EXPECTED_WORKFLOW_CATALOG_PUBLIC_TYPES,
    ];
    const unusedCuratedTypes = curatedPublicTypes
      .filter((name) => !consumers.typeConsumers.has(name))
      .sort();

    expect(unusedCuratedTypes, `Unused type exports: ${unusedCuratedTypes.join(', ')}`).toEqual([]);
  });

  it('does not accidentally count internal-module imports as package-entry consumers', () => {
    const consumers = collectRuntimePackageConsumers(REPO_ROOT);
    const relativeFiles = [...consumers.consumerFiles].map((file) => relative(REPO_ROOT, file));

    expect(relativeFiles.some((file) => file.includes('src/runtime-public-bridge-exports.ts'))).toBe(false);
    expect(relativeFiles.some((file) => file.includes('src/runtime-public-governance-exports.ts'))).toBe(false);
    expect(relativeFiles.some((file) => file.includes('src/runtime-public-catalog-exports.ts'))).toBe(false);
  });
});
