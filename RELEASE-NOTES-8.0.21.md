# AutomatosX v8.0.21 Release Notes

**Release Date**: January 16, 2025

## 🔒 Privacy by Default

This release implements **Privacy by Default** - a major improvement to user privacy and onboarding experience.

### What's Changed

#### ✨ Default Telemetry Behavior
- **Telemetry is now DISABLED by default** without requiring user interaction
- Removes the interactive consent prompt that appeared on first run
- Shows a simple one-time informational message instead
- Users can opt-in anytime with `ax telemetry enable`

**Before (v8.0.20 and earlier)**:
```
📊 Welcome to AutomatosX!

To improve AutomatosX, we collect anonymous usage data...

? How would you like to configure telemetry? (Use arrow keys)
❯ Enable (local only) - Store data locally for debugging
  Enable (with remote submission) - Help improve AutomatosX
  Disable - Do not collect any data
```

**After (v8.0.21)**:
```
💡 Privacy by default: Telemetry is disabled
   To help improve AutomatosX, run: ax telemetry enable
   Learn more: ax telemetry --help
```

### Benefits

✅ **Zero-friction onboarding** - Start using AutomatosX immediately without answering prompts

✅ **Privacy-first** - Complies with GDPR "Privacy by Default" principle (Article 25)

✅ **CI/CD friendly** - No interactive prompts that could block automation pipelines

✅ **Transparent** - Users have complete control and can enable telemetry if they choose

✅ **Aligned with industry standards** - Follows Homebrew, Rust/Cargo, and pnpm's privacy-first approach

### Documentation Updates

- 📚 **README.md** - Added comprehensive Privacy & Telemetry section
- 📖 **CLAUDE.md** - Added detailed telemetry documentation for future Claude Code instances
- 🔗 Added PRIVACY.md link to documentation section

### Migration Guide

**For existing users**: No action required. Your current telemetry settings are preserved.

**For new users**: Telemetry is disabled by default. To enable:

```bash
# Local-only telemetry (stored in SQLite)
ax telemetry enable

# Remote submission (helps improve AutomatosX)
ax telemetry enable --remote

# Check status
ax telemetry status

# Disable anytime
ax telemetry disable
```

**For CI/CD environments**: Use environment variable to skip even the informational message:

```bash
export AUTOMATOSX_TELEMETRY_ENABLED=false
ax find "test"  # No telemetry message shown
```

### Technical Details

**Modified Files**:
- `src/utils/telemetryConsent.ts` - Changed default behavior from prompt to silent disable
- `README.md` - Added Privacy & Telemetry section
- `CLAUDE.md` - Added comprehensive telemetry documentation

**What We Collect (if enabled)**:
- ✅ Command usage (which commands you run)
- ✅ Query performance (how long operations take)
- ✅ Error occurrences (what errors happen)
- ✅ Parser invocations (which languages are used)

**What We NEVER Collect**:
- ❌ File paths or names
- ❌ Code content
- ❌ User identifiers (IP addresses, usernames)
- ❌ Personal information

### Compliance

This release ensures compliance with:
- **GDPR** Article 25 (Data protection by design and by default)
- **CCPA** (California Consumer Privacy Act)
- **Privacy by Default** principle
- Industry best practices for open-source tools

---

## 📊 Version Details

- **Version**: 8.0.21
- **Previous Version**: 8.0.20
- **Release Type**: Minor (Privacy Enhancement)
- **Breaking Changes**: None
- **Migration Required**: No

## 🔗 Links

- **GitHub Repository**: https://github.com/defai-digital/automatosx
- **NPM Package**: https://www.npmjs.com/package/@defai.digital/automatosx
- **Documentation**: https://github.com/defai-digital/automatosx#readme
- **Privacy Policy**: https://github.com/defai-digital/automatosx/blob/main/PRIVACY.md
- **Issues**: https://github.com/defai-digital/automatosx/issues

## 🙏 Acknowledgments

Thank you to all users who provided feedback on improving the privacy and user experience of AutomatosX!

---

**Full Changelog**: https://github.com/defai-digital/automatosx/compare/v8.0.20...v8.0.21
