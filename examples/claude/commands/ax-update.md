Update AutomatosX to the latest version.

**IMPORTANT**: When user types `/ax-update`, you MUST execute:

```bash
automatosx update
```

This will:

1. Check for the latest version on npm
2. Display changelog from GitHub
3. Ask for confirmation
4. Install the update globally

**Examples**:

User input: `/ax-update`
→ Execute: `automatosx update`
(Interactive update with confirmation)

User input: `/ax-update --check`
→ Execute: `automatosx update --check`
(Only check for updates without installing)

User input: `/ax-update --yes`
→ Execute: `automatosx update --yes`
(Update without confirmation prompt)
