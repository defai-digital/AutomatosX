# Tasks: Spec-Kit CLI Integration

## Phase 1: Core Executor (COMPLETED)
- [x] id:executor:types ops:"ax run backend 'Design SpecExecutionResult and TaskExecutionResult types'"
- [x] id:executor:impl ops:"ax run backend 'Implement SpecExecutor class with sequential and parallel execution'" dep:executor:types
- [x] id:executor:persist ops:"ax run backend 'Add task status persistence in tasks.md'" dep:executor:impl

## Phase 2: CLI Commands (COMPLETED)
- [x] id:cli:run ops:"ax run backend 'Implement ax spec run command with all options'" dep:executor:impl
- [x] id:cli:status ops:"ax run backend 'Implement ax spec status command with JSON output'" dep:executor:impl
- [x] id:cli:validate ops:"ax run backend 'Implement ax spec validate command'" dep:executor:impl
- [x] id:cli:graph ops:"ax run backend 'Implement ax spec graph command with DOT/Mermaid export'" dep:executor:impl
- [x] id:cli:register ops:"ax run backend 'Register spec command in CLI index'" dep:cli:run,cli:status,cli:validate,cli:graph

## Phase 3: Testing & Integration (PENDING)
- [ ] id:test:executor ops:"ax run quality 'Write 40+ unit tests for SpecExecutor'" dep:cli:register labels:testing
- [ ] id:test:cli ops:"ax run quality 'Write integration tests for CLI commands'" dep:cli:register labels:testing
- [ ] id:test:e2e ops:"ax run quality 'Write E2E tests with real .specify/ files'" dep:test:executor,test:cli labels:testing
- [ ] id:autodetect ops:"ax run backend 'Add auto-detection in ax run command'" dep:test:executor labels:feature
- [ ] id:perf:bench ops:"ax run quality 'Performance benchmarking for large specs'" dep:test:e2e labels:performance

## Phase 4: CI/CD & Documentation (PENDING)
- [ ] id:ci:workflow ops:"ax run devops 'Create GitHub Actions workflow for spec validation'" dep:test:e2e labels:ci-cd
- [ ] id:docs:readme ops:"ax run writer 'Update README with spec-kit CLI examples'" dep:cli:register labels:docs
- [ ] id:docs:tutorial ops:"ax run writer 'Create tutorial: Building Features with Spec-Kit'" dep:docs:readme labels:docs
- [ ] id:docs:changelog ops:"ax run writer 'Add CHANGELOG entry for v5.9.0'" dep:docs:tutorial labels:docs
