# Ability Contract Invariants

This document specifies the behavioral guarantees that MUST be enforced by any implementation of the Ability domain.

## Core Invariants

### INV-ABL-001: Ability ID Uniqueness

**Guarantee:** Within a single registry, ability IDs are unique. Registering an ability with an existing ID overwrites the previous entry.

**Enforcement:**
- Registry uses Map keyed by `abilityId`
- No duplicate ID check on register (overwrites)
- Get operations return single ability or undefined

**Test Verification:** `tests/core/ability-domain.test.ts` - "should overwrite existing ability with same ID"

---

### INV-ABL-002: Priority-Based Sorting

**Guarantee:** When listing abilities, results are sorted by priority in descending order (higher priority first).

**Enforcement:**
- `list()` method sorts by `priority` field (default 50)
- Higher values appear first in results
- Ties maintain insertion order

**Test Verification:** `tests/core/ability-domain.test.ts` - "should list all abilities sorted by priority"

---

### INV-ABL-003: Token Limit Enforcement

**Guarantee:** When injecting abilities, the combined content never exceeds the specified `maxTokens` limit.

**Enforcement:**
- `injectAbilities()` tracks cumulative token count
- Abilities are added until adding another would exceed limit
- `truncated` flag indicates if abilities were skipped
- Token estimation: ~4 characters per token (rough approximation)

**Test Verification:** `tests/core/ability-domain.test.ts` - "should respect maxTokens limit and set truncated flag"

---

### INV-ABL-004: Applicability Filtering

**Guarantee:** Abilities are filtered based on their `applicableTo` and `excludeFrom` arrays relative to the requesting agent.

**Rules:**
1. If `excludeFrom` contains the agent ID, ability is excluded
2. If `applicableTo` is empty or undefined, ability applies to all agents
3. If `applicableTo` contains `*` (wildcard), ability applies to all agents
4. If `applicableTo` contains the agent ID, ability applies
5. Otherwise, ability is excluded

**Enforcement:**
- `list()` method with `applicableTo` filter applies these rules
- Manager uses this filtering for `getApplicableAbilities()`

**Test Verification:** `tests/core/ability-domain.test.ts` - "should filter by applicableTo", "should handle wildcard applicableTo"

---

### INV-ABL-005: Enabled Status Filtering

**Guarantee:** Only enabled abilities are returned when filtering by `enabled: true` or when getting abilities for tasks.

**Enforcement:**
- `list({ enabled: true })` excludes disabled abilities
- `getAbilitiesForTask()` uses `getApplicableAbilities()` which filters by enabled
- Disabled abilities can still be retrieved directly by ID

**Test Verification:** `tests/core/ability-domain.test.ts` - "should filter by enabled status", "should not return disabled abilities"

---

## Scoring Invariants

### INV-ABL-SCR-001: Core Ability Prioritization

**Guarantee:** Abilities specified as "core" receive a significant scoring bonus (+100) to ensure they appear first.

**Enforcement:**
- `scoreAbility()` adds 100 points for core ability match
- Other scoring factors (tags, category, keywords) have lower weights

**Test Verification:** `tests/core/ability-domain.test.ts` - "should prioritize core abilities", "should include core abilities first"

---

### INV-ABL-SCR-002: Deterministic Scoring

**Guarantee:** Given the same inputs, ability scoring produces the same results.

**Scoring Algorithm:**
- Core ability bonus: +100 points
- Tag match (per tag): +10 points
- Category match: +15 points
- Content keyword matches: +2 points each (max 20 points)
- Priority bonus: +priority/10 points

**Enforcement:**
- No random factors in scoring
- No side effects during scoring

---

## Loading Invariants

### INV-ABL-LDR-001: Schema Validation on Load

**Guarantee:** All loaded abilities pass schema validation via `validateAbility()`.

**Enforcement:**
- `FileSystemAbilityLoader.loadFile()` calls `validateAbility()` after parsing
- Invalid abilities are skipped with warning logged
- Valid abilities are cached

**Test Verification:** Contract tests in `tests/contract/ability.test.ts`

---

### INV-ABL-LDR-002: ID Generation from Filename

**Guarantee:** If an ability file lacks an `abilityId` in frontmatter, the ID is generated from the filename.

**Algorithm:**
- Remove `.md` extension
- Convert to lowercase
- Replace non-alphanumeric characters with dashes

**Example:** `TypeScript-Best-Practices.md` → `typescript-best-practices`

**Test Verification:** `tests/core/ability-domain.test.ts` - "should generate ability ID from filename if not in frontmatter"

---

### INV-ABL-LDR-003: YAML Frontmatter Parsing

**Guarantee:** Markdown files with YAML frontmatter (delimited by `---`) have metadata extracted correctly.

**Supported Types:**
- Strings: Passed through
- Booleans: `true`/`false` converted
- Numbers: Integer strings converted
- Arrays: `[item1, item2]` inline format parsed

**Test Verification:** `tests/core/ability-domain.test.ts` - "should parse YAML frontmatter correctly"

---

## Error Handling

### Error Codes

| Code | Description |
|------|-------------|
| `ABILITY_NOT_FOUND` | Requested ability does not exist |
| `ABILITY_VALIDATION_ERROR` | Ability data fails schema validation |
| `ABILITY_LOAD_FAILED` | Failed to load ability from source |
| `ABILITY_CONFLICT` | Ability conflicts with another loaded ability |
| `ABILITY_DEPENDENCY_MISSING` | Required dependency ability not found |
| `ABILITY_TOKEN_LIMIT_EXCEEDED` | Combined content exceeds token limit |

---

## Implementation Notes

### Token Estimation

The current implementation uses a rough approximation of 4 characters per token. For production use, consider:
- Using tiktoken for accurate OpenAI tokenization
- Provider-specific tokenizers for other LLMs
- Configurable tokenization strategies

### Dependency Resolution

The current implementation does NOT enforce dependency resolution (INV-ABL-005 refers to sorting, not loading dependencies). Future versions may add:
- Dependency validation on load
- Automatic dependency inclusion
- Conflict detection and resolution

### Performance Considerations

- Abilities are cached after first load
- Large ability content should be paginated
- Consider lazy loading for large ability collections
