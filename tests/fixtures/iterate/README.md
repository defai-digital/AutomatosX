# Iterate Mode Test Fixtures

This directory contains test fixtures for iterate mode unit tests.

## Contents

### `sample-patterns.yaml`
Sample pattern library for testing the IterateClassifier.

**Structure:**
- Classification types (confirmation_prompt, genuine_question, etc.)
- Regex patterns with priority and confidence scores
- Used to test pattern matching and classification logic

**Usage:**
```typescript
await classifier.loadPatterns('tests/fixtures/iterate/sample-patterns.yaml');
```

### `sample-templates.yaml`
Sample template library for testing the IterateAutoResponder.

**Structure:**
- Templates for each classification type
- Generic and provider-specific templates
- Templates with variable placeholders ({{variable}})
- Priority-based template selection

**Usage:**
```typescript
await responder.loadTemplates('tests/fixtures/iterate/sample-templates.yaml');
```

## Phase Information

**Week 1 (Current):** Basic scaffolding fixtures only
- Files exist but are not actively used by skeleton implementations
- Serve as examples for future implementation

**Week 2:** Pattern library loading and validation
- sample-patterns.yaml will be actively used in classifier tests

**Week 3:** Template library and response generation
- sample-templates.yaml will be actively used in responder tests

## Notes

- These are test fixtures only - not used in production
- Production pattern and template libraries should be in `.automatosx/iterate/`
- Fixtures are version-controlled for test reproducibility
- Keep fixtures simple and focused on specific test scenarios
