# Changelog

All notable changes to this project will be documented in this file.

## [11.3.4] - 2025-12-05

### Added
- Comprehensive iterate mode controller tests with multi-phase orchestration
- Mock executor and provider helpers for improved test coverage
- Budget enforcement tests for iteration and token limits

### Changed
- Enhanced executeWithIterate() with executor injection support
- Improved test structure with Phase 3 & 4 orchestration tests
- Better action handling tests for completion and pause scenarios

### Fixed
- Test alignment for handleResponse() behavior when state not initialized
- Classification history tracking in multi-iteration execution

## [11.3.3] - 2025-12-05

### Added
- New iterate mode auto-responder system with intelligent classification
- Enhanced iterate mode controller with improved state management
- Unit tests for iterate classifier and auto-responder components

### Changed
- Improved iterate classifier patterns for better accuracy
- Enhanced iterate mode controller with better pause/resume handling
- Updated setup command with additional configuration options

### Fixed
- Iterate mode pattern improvements for edge cases
- Auto-response handling for confirmation prompts

## [11.3.2] - 2025-12-04

### Fixed
- SDK bug fixes and resource management improvements

## [11.3.1] - 2025-12-03

### Added
- Mode persistence across sessions
- CLI shortcuts for common operations

### Fixed
- Various bug fixes

## [11.3.0] - 2025-12-02

### Added
- Embedded Instructions System
- Orchestration Service
- Token budget management

For earlier versions, see the git history.
