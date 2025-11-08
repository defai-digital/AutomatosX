# Developer Onboarding Handbook (P0 Sprint 1)

## 1. Welcome & Objectives
This guide equips new contributors to work on the ReScript refactor and SQLite integration within AutomatosX. Expect to complete the setup in under two hours, including tooling verification and first contribution checklist.

## 2. Prerequisites
- macOS 13+ or Linux (Ubuntu 22.04+). Windows users should use WSL2.  
- Node.js 20 LTS, pnpm 9.x (install via Volta or asdf for version locking).  
- Docker Desktop 4.26+ (for containerized workflows).  
- Git 2.43+, direnv (optional), jq, sqlite3 CLI.  
- Access to AutomatosX GitHub repository and CI pipelines.

## 3. System Preparation
```bash
# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -

# Install Node 20 with Volta
curl https://get.volta.sh | bash
volta install node@20

# Verify sqlite3
sqlite3 --version
```
Configure direnv if using workspace-specific environment variables:
```bash
brew install direnv
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
```

## 4. Repository Setup
```bash
git clone git@github.com:defai-digital/automatosx.git
cd automatosx
pnpm install
pnpm run bootstrap # if monorepo dependencies need linking
```
Copy environment template:
```bash
cp .env.sample .env
```
Update `.env` with local paths for SQLite databases (e.g., `SQLITE_DB_PATH=./tmp/dev.db`).

## 5. Development Workflow
| Task | Command |
|------|---------|
| Build TypeScript + ReScript | `pnpm run build` |
| ReScript incremental build | `pnpm res:watch` |
| Run unit tests | `pnpm test` |
| Run ReScript binding tests | `pnpm test:res` |
| Run SQLite migration checks | `pnpm migrate:sqlite status` |
| Launch CLI locally | `pnpm start -- --help` |

Sequence for a typical change:
1. Update ReScript source under `rescript/` and run `pnpm res:build`.  
2. Verify generated bindings in `rescript/gen/`.  
3. Update TypeScript consumers under `src/` and run `pnpm test`.  
4. If schema changes required, create timestamped migration and execute `pnpm migrate:sqlite up --env local`.  
5. Commit with descriptive message and reference related ADR or ticket.

## 6. Containerized Environment (Optional)
Use Docker for consistent tooling:
```bash
docker build -t automatosx-dev -f docker/Dockerfile .
docker run --rm -it \
  -v $(pwd):/workspace \
  -w /workspace \
  automatosx-dev zsh
```
Container image should include Node 20, pnpm, ReScript compiler, sqlite3, and Vitest. DevOps (Oliver) maintains base image versioning; request refresh if dependencies change.

## 7. IDE & Editor Recommendations
- **VS Code:**  
  - Extensions: ReScript Language, ESLint, Prettier, SQLite, GitLens.  
  - Settings: enable format on save, TypeScript SDK from workspace, ReScript build-on-save disabled (we use pnpm scripts).  
  - Tasks: configure `tasks.json` entries for `pnpm res:build` and `pnpm test`.
- **JetBrains (WebStorm):** configure `File Watcher` for ReScript formatting and `Node.js` run configurations for PNPM scripts.

## 8. Debugging Setup
- **ReScript:** Use generated `.gen.ts` to debug in VS Code (breakpoints on TypeScript side). For deep debugging, emit source maps using `BS_VITE=1` and run Node with `--enable-source-maps`.  
- **TypeScript:** Run `pnpm test -- --runInBand --inspect-brk` to attach debugger.  
- **SQLite:** Use `sqlite3 $(pnpm config get sqlite.db)` to introspect; add `.dump` to inspect states before/after migrations.  
- Log important data path decisions to align with ADR-004 security measures.

## 9. Common Tasks & Shortcuts
- Generate new binding skeleton: `pnpm run scaffold:binding <ModuleName>`.  
- Create migration: `pnpm migrate:sqlite create "add agent metadata"`.  
- Format code: `pnpm lint` (runs ESLint + ReScript formatter).  
- Update documentation: add notes under `automatosx/PRD/` for persistent records.  
- Quick coverage report: `pnpm coverage:summary`.

## 10. Troubleshooting & FAQ
| Issue | Resolution |
|-------|------------|
| ReScript build fails with ESM complaints | Ensure Node 20 and `suffix` is `.mjs`; clean `lib/bs` via `pnpm res:clean`. |
| Generated bindings missing | Run `pnpm res:build`; check `gentypeconfig` in `bsconfig.json`. |
| SQLite lock errors | Close other apps using the database, ensure migrations run inside transactions. |
| Vitest fails locating modules | Verify `.gen.ts` paths and update `paths` in `tsconfig.json`. |
| CI mismatch vs local | Confirm `.env.ci` overrides and ensure no local-only migrations pending. |
| Unknown environment variables | Sync `.env.sample`; architecture governance requires new vars documented and approved. |

## 11. First Contribution Checklist
- [ ] Run `pnpm res:build`, `pnpm test`, `pnpm migrate:sqlite status`.  
- [ ] Submit sample PR updating documentation or small binding change.  
- [ ] Schedule knowledge transfer session with ReScript Champion.  
- [ ] Review ADR-002, ADR-003, ADR-009 to understand constraints.  
- [ ] Attend next daily standup to introduce yourself and share progress.

## 12. Support Channels
- **Slack:** `#automatosx-rescript` for daily collaboration, `#automatosx-sqlite` for data questions.  
- **Office Hours:** ReScript Champion (Tue/Thu 14:00 UTC), Oliver (DevOps) (Wed 16:00 UTC).  
- **Escalation:** Architecture (Avery) for structural concerns; Release Manager for release-blocking issues.
