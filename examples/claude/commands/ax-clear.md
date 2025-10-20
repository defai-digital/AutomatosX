Clear AutomatosX memory.

**IMPORTANT**: When user types `/ax-clear`, you MUST execute:

```bash
automatosx memory clear --confirm
```

This will delete all stored memories from the AutomatosX memory database.

**Examples**:

User input: `/ax-clear`
→ Execute: `automatosx memory clear --confirm`

User input: `/ax-clear --type task`
→ Execute: `automatosx memory clear --confirm --type task`

User input: `/ax-clear --older-than 30`
→ Execute: `automatosx memory clear --confirm --older-than 30`

⚠️ **Warning**: This action cannot be undone. Consider backing up first.
