# Tasks

<!-- Task format: - [ ] id:task-id ops:"command" dep:dependency-id -->
<!-- Example: -->
<!-- - [ ] id:setup:env ops:"ax run devops 'Setup development environment'" -->
<!-- - [ ] id:impl:api ops:"ax run backend 'Implement REST API'" dep:setup:env -->
<!-- - [ ] id:test:api ops:"ax run quality 'Write API tests'" dep:impl:api -->

## Phase 1: Setup
- [ ] id:setup:env ops:"ax run devops 'Setup development environment'"
- [ ] id:setup:db ops:"ax run backend 'Setup database schema'" dep:setup:env

## Phase 2: Implementation
- [ ] id:impl:core ops:"ax run backend 'Implement core functionality'" dep:setup:db

## Phase 3: Testing
- [ ] id:test:unit ops:"ax run quality 'Write unit tests'" dep:impl:core
- [ ] id:test:integration ops:"ax run quality 'Write integration tests'" dep:impl:core

## Phase 4: Documentation
- [ ] id:docs:api ops:"ax run writer 'Write API documentation'" dep:impl:core
