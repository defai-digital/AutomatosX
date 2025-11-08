# ReScript Setup Guide (P0 Sprint 1)

## 1. Prerequisites
- Node.js 20 LTS (aligns with ADR-002 ESM mandate).  
- pnpm 9.x (preferred) or npm 10.x.  
- ReScript CLI (`@rescript/react` optional for UI work).  
- Existing TypeScript strict-mode configuration (ADR-003).

## 2. Compiler Installation & Version Pinning
1. Add ReScript packages to the workspace root:
   ```bash
   pnpm add -D rescript@10.1.4 @rescript/react@0.12.0
   ```
2. Pin versions in `package.json` using exact semver and enable package manager overrides if needed:
   ```json
   {
     "devDependencies": {
       "rescript": "10.1.4",
       "@rescript/react": "0.12.0"
     },
     "pnpm": {
       "overrides": {
         "rescript": "10.1.4"
       }
     }
   }
   ```
3. Define compiler scripts:
   ```json
   {
     "scripts": {
       "res:build": "rescript build",
       "res:clean": "rescript clean",
       "res:watch": "rescript build -w",
       "res:fmt": "rescript format -all"
     }
   }
   ```

## 3. `bsconfig.json` Baseline
Create or update `bsconfig.json` at the repository root:
```json
{
  "name": "automatosx-rescript",
  "namespace": true,
  "package-specs": [
    {
      "module": "es6",
      "in-source": true
    }
  ],
  "suffix": ".mjs",
  "sources": [
    {
      "dir": "rescript",
      "subdirs": true
    }
  ],
  "reason": { "react-jsx": 3 },
  "bs-dependencies": ["@rescript/react"],
  "bs-dev-dependencies": [],
  "warnings": {
    "number": "-44-102",
    "error": "+5+8"
  },
  "gentypeconfig": {
    "language": "typescript",
    "module": "esmodule",
    "generatedFileExtension": ".gen.ts",
    "debug": {
      "all": false
    }
  }
}
```
Key choices:
- `module: "es6"` ensures compatibility with ESM bundling (ADR-002).  
- `suffix: ".mjs"` avoids conflicts with Node’s ESM resolution.  
- `namespace: true` keeps generated module names stable during gradual migration.  
- `gentypeconfig` configures TypeScript bindings generation (see Section 6).

## 4. Build Toolchain Integration
- **tsup bundling:** Extend `tsup.config.ts` to include ReScript outputs:
  ```ts
  import { defineConfig } from 'tsup';

  export default defineConfig({
    entry: {
      cli: 'src/cli/index.ts',
      rescript: 'rescript/index.mjs'
    },
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: true
  });
  ```
- Ensure ReScript builds run prior to TypeScript bundling:
  ```json
  {
    "scripts": {
      "build": "pnpm res:build && tsup",
      "watch": "pnpm res:watch & tsup --watch"
    }
  }
  ```
- Update `.gitignore` to include generated `.bs.js`, `.mjs`, `lib/bs` if not in source.

## 5. CI Pipeline Configuration
Example GitHub Actions workflow `ci-rescript.yml`:
```yaml
name: ReScript CI
on:
  pull_request:
    paths:
      - 'rescript/**'
      - 'bsconfig.json'
      - '.github/workflows/ci-rescript.yml'
  push:
    branches: [main]

jobs:
  rescript:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm res:build
      - run: pnpm run test:res
      - name: Upload coverage
        run: pnpm run coverage:res
      - name: Archive artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: rescript-logs
          path: rescript/**/*.log
```
Add `test:res` script invoking Vitest or Jest harness for generated bindings (see Section 7).

## 6. TypeScript ↔ ReScript Interop Patterns
- Use Gentype for automatic `.gen.ts` shims; place generated bindings inside `rescript/gen/`.  
- Maintain shared type definitions in TypeScript under `types/` and import into ReScript via `.resi` interface files.  
- Example pattern for exposing a ReScript function to TypeScript:
  ```rescript
  // rescript/Greetings.res
  let greet = (name: string) => `Hello, ${name}!`
  ```
  ```rescript
  // rescript/Greetings.resi
  let greet: string => string
  ```
  Generated TypeScript (`rescript/gen/Greetings.gen.ts`):
  ```ts
  import * as GreetingsBS from '../Greetings.mjs';
  export const greet: (name: string) => string = GreetingsBS.greet;
  ```
- For TypeScript invoking ReScript modules, only consume `.gen.ts` exports.  
- For ReScript consuming TypeScript utilities, expose them via `rescript-shims/` with stable ESM exports and annotate using `external`.

## 7. Auto-generated `.d.ts` Strategy
- Use Gentype’s `.gen.ts` output as source of truth for type declarations.  
- Provide `typesVersions` mapping in `package.json` to point to `.gen.ts` and `.d.ts` combos when published.  
- For ReScript modules that must ship pure TypeScript definitions, run:
  ```bash
  pnpm gentype --path rescript --outDir rescript/gen
  ```
- Add post-build script to emit `.d.ts` via `tsc --emitDeclarationOnly --project tsconfig.gentype.json` targeting generated `.gen.ts`.

## 8. Validation Test Framework
- Extend Vitest to run ReScript-targeted tests (leveraging generated `.gen.ts`):
  ```ts
  // tests/rescript/greetings.test.ts
  import { describe, expect, it } from 'vitest';
  import { greet } from '../../rescript/gen/Greetings.gen';

  describe('ReScript bindings', () => {
    it('greets user', () => {
      expect(greet('AutomatosX')).toBe('Hello, AutomatosX!');
    });
  });
  ```
- Configure dedicated Vitest project `vitest.config.rescript.ts` to focus on `rescript/gen/**/*.gen.ts`.  
- Include coverage instrumentation (`coverage: { reporter: ['text', 'lcov'], exclude: ['**/*.resi'] }`).

## 9. Troubleshooting Guide
- **Compiler not found:** Ensure `node_modules/.bin` is on PATH or invoke scripts via `pnpm res:build`.  
- **Mismatched ESM extension errors:** Confirm `suffix: ".mjs"` and Node 20+; clear old `.bs.js`.  
- **Gentype not generating files:** Validate `gentypeconfig` exists and run `pnpm res:build` (Gentype runs as part of build).  
- **CI cache misses:** Cache `~/.cache/rescript` or `lib/bs` directories to reduce compile time; ensure cache keys include `rescript` version.  
- **Coverage gaps:** Confirm Vitest includes generated bindings; consider instrumentation via `c8` if coverage is not reported.  
- **Interop circular dependency:** Break into interface modules; avoid ReScript modules importing TypeScript modules that re-import the same generated file.

## 10. Governance Checklist
- Version lock compiler and dependencies.  
- Ensure bsconfig changes are reviewed by Architecture (Avery) and ReScript Champion.  
- Automated tests must accompany each new binding.  
- Update ADR references if fundamental conventions diverge.  
- Document any deviations in sprint notes for rapid feedback loops.
