# License Change Summary

**Date:** 2025-11-05
**Change:** Apache License 2.0 → Elastic License 2.0
**Copyright Holder:** DEFAI Private Limited

---

## Changes Made

### 1. LICENSE File
- **File:** `LICENSE`
- **Change:** Replaced Apache License 2.0 with Elastic License 2.0
- **Copyright:** Copyright 2025 DEFAI Private Limited

### 2. package.json Files
Updated license field in both package.json files:

**Root package.json:**
```json
- "license": "Apache-2.0",
+ "license": "Elastic-2.0",
```

**packages/cli-interactive/package.json:**
```json
- "license": "Apache-2.0",
+ "license": "Elastic-2.0",
```

### 3. Documentation Updates

**README.md:**
- Updated license badge: `Apache 2.0` → `Elastic 2.0`
- Updated license section:
  ```markdown
  ## 📄 License

  Elastic License 2.0 - See [LICENSE](LICENSE) for details.

  Copyright 2025 DEFAI Private Limited
  ```

**packages/cli-interactive/README.md:**
- Updated license section:
  ```markdown
  ## License

  Elastic License 2.0 (same as AutomatosX)

  Copyright 2025 DEFAI Private Limited
  ```

**CONTRIBUTING.md:**
- Updated contributor license agreement:
  ```markdown
  By contributing, you agree that your contributions will be licensed under the Elastic License 2.0.
  ```

---

## About Elastic License 2.0

The Elastic License 2.0 (ELv2) is a simple, non-copyleft license that allows for most uses, including commercial uses, while preventing three specific use cases:

### What You CAN Do:
✅ Use the software commercially
✅ Modify and distribute the software
✅ Use the software as part of your product
✅ Sell products that use the software

### What You CANNOT Do:
❌ Provide the software as a hosted/managed service
❌ Circumvent or remove license key functionality
❌ Alter or remove copyright/license notices

### Key Differences from Apache 2.0:
1. **Hosted Service Restriction:** You cannot provide AutomatosX as a managed service (SaaS)
2. **Simpler Terms:** Shorter, more readable license text
3. **Same Permissiveness:** For most use cases, equally permissive as Apache 2.0

---

## Files Changed

| File | Change |
|------|--------|
| `LICENSE` | Complete replacement (Apache 2.0 → Elastic 2.0) |
| `package.json` | License field: `"Apache-2.0"` → `"Elastic-2.0"` |
| `packages/cli-interactive/package.json` | License field: `"Apache-2.0"` → `"Elastic-2.0"` |
| `README.md` | Badge and license section updated |
| `packages/cli-interactive/README.md` | License section updated |
| `CONTRIBUTING.md` | Contributor license agreement updated |

**Total:** 6 files modified

---

## Verification

### License Field Check
```bash
$ grep "license" package.json
  "license": "Elastic-2.0",

$ grep "license" packages/cli-interactive/package.json
  "license": "Elastic-2.0",
```

### LICENSE File Check
```bash
$ head -5 LICENSE
Elastic License 2.0

URL: https://www.elastic.co/licensing/elastic-license

## Acceptance
```

### Copyright Holder Check
```bash
$ grep "Copyright" LICENSE
Copyright 2025 DEFAI Private Limited
```

---

## NPM Publishing Note

When publishing to npm with the new license:

1. **npm will recognize `Elastic-2.0`** as a valid SPDX identifier
2. **Package page will show:** "Elastic-2.0" as the license
3. **Users will see:** The license in the LICENSE file when they install

No additional configuration needed for npm publication.

---

## Git Commit Suggestion

```bash
git add LICENSE package.json packages/cli-interactive/package.json
git add README.md packages/cli-interactive/README.md CONTRIBUTING.md
git add LICENSE-CHANGE-SUMMARY.md

git commit -m "chore: Change license from Apache 2.0 to Elastic License 2.0

- Replace LICENSE file with Elastic License 2.0
- Update license field in all package.json files
- Update license references in README files
- Update CONTRIBUTING.md contributor license agreement
- Copyright holder: DEFAI Private Limited

The Elastic License 2.0 maintains most permissiveness while adding
three specific restrictions:
1. Cannot provide as hosted/managed service
2. Cannot circumvent license key functionality
3. Cannot alter/remove copyright notices

SPDX License ID: Elastic-2.0
License URL: https://www.elastic.co/licensing/elastic-license

See LICENSE-CHANGE-SUMMARY.md for full details."
```

---

## Impact Assessment

### For End Users
✅ **No impact** for normal usage
✅ Can still use commercially
✅ Can still modify and distribute
✅ Can still integrate into products

### For Contributors
✅ Clear license terms in CONTRIBUTING.md
✅ Contributions under Elastic License 2.0
✅ Simpler, more readable license text

### For Package Distribution
✅ npm recognizes Elastic-2.0 as valid SPDX ID
✅ No changes needed to publish process
✅ Clear license display on npm package page

### For Compliance
✅ LICENSE file clearly states copyright holder
✅ All documentation references updated
✅ Consistent across all package files

---

## Next Steps

1. ✅ Review LICENSE-CHANGE-SUMMARY.md (this file)
2. ⏳ Commit license changes
3. ⏳ Update any external documentation (if needed)
4. ⏳ Publish next version with new license

---

**Copyright:** 2025 DEFAI Private Limited
**License:** Elastic License 2.0
**SPDX ID:** Elastic-2.0
**License URL:** https://www.elastic.co/licensing/elastic-license
