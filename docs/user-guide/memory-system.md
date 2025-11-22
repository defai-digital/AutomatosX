# Memory Management Tutorial

**Level**: Beginner to Intermediate
**Time**: 15 minutes
**Prerequisites**: AutomatosX installed and initialized

---

## What You'll Learn

In this tutorial, you'll learn how to:

1. Understand how memory works automatically
2. Search and explore memory entries
3. Export and import memory for backup
4. Clean up old memories
5. Use memory effectively in agent workflows

---

## Understanding Memory

### What is Memory For?

Memory is AutomatosX's **long-term knowledge base** that provides contextual awareness to agents. Think of it as the system's "brain" that remembers past conversations.

**Memory enables:**
- ✅ Continuity across agent executions
- ✅ Learning from past work
- ✅ Knowledge sharing between agents
- ✅ Avoiding repeated mistakes

**Memory is NOT:**
- ❌ For current agent-to-agent communication (use delegation)
- ❌ For file sharing (use workspaces)
- ❌ A chat history viewer (it's a knowledge base)

---

## Step 1: See Memory in Action

### Run Your First Agent

```bash
# Initialize if you haven't already
ax setup

# Run an agent with a task
ax run paris "Design a simple calculator with add and subtract functions"
```

**What happens:**
1. Paris designs the calculator
2. The conversation (task + response) is **automatically saved to memory**
3. Memory is now searchable for future tasks

### Run a Second Agent

```bash
# Now run another agent
ax run sofia "Implement the calculator that was designed"
```

**What happens:**
1. Memory searches for "calculator" automatically
2. Paris's design is **auto-injected** into Sofia's context
3. Sofia sees: "Relevant Context from Memory: Paris's calculator design..."
4. Sofia implements based on Paris's design **without you repeating the spec**

**This is the power of memory!**

---

## Step 2: Search Memory

### Basic Search

```bash
# Search for calculator-related memories
ax memory search "calculator"
```

**Output:**
```
🔍 Search Results (2 entries)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entry #2 (Relevance: 95.2%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: paris
Type: conversation
Created: 2025-10-10 12:59:16

Content:
Agent: paris
Task: Design a simple calculator with add and subtract functions

Response: # Calculator Specification...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Entry #3 (Relevance: 87.3%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agent: sofia
Type: conversation
Created: 2025-10-10 13:01:22

Content:
Agent: sofia
Task: Implement the calculator that was designed

Response: Based on the calculator specification...
```

### Advanced Search

```bash
# Limit results
ax memory search "calculator" --limit 5

# Filter by type
ax memory search "design" --type conversation

# Filter by agent
ax memory search "implementation" --agent sofia

# Combine filters
ax memory search "bug fix" --type conversation --agent bob --limit 10
```

---

## Step 3: Explore Memory Entries

### List All Memories

```bash
# List all entries
ax memory list
```

**Output:**
```
📚 Memory Entries (13 total)

ID   Agent     Type           Created              Preview
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
14   paris     conversation   2025-10-10 04:59    Agent: paris, Task: Create...
13   queenie   conversation   2025-10-10 04:27    Agent: queenie, Task: i want...
12   bob       conversation   2025-10-10 04:22    Agent: bob, Task: please check...
11   wendy     conversation   2025-10-10 04:17    Agent: wendy, Task: please...
10   writer    conversation   2025-10-10 00:30    Agent: writer, Task: please...
```

### Filter by Date

```bash
# Entries from specific date
ax memory list --from 2025-10-10

# Date range
ax memory list --from 2025-10-01 --to 2025-10-10
```

### Filter by Agent

```bash
# All memories from paris
ax memory list --agent paris

# All memories from bob
ax memory list --agent bob
```

---

## Step 4: Memory Statistics

### View Overall Stats

```bash
ax memory stats
```

**Output:**
```
📊 Memory Statistics

Total Entries:  13
Database Size:  45.2 KB
Date Range:     2025-10-08 to 2025-10-10

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Entry Types:
  • conversation: 11 entries
  • code:         2 entries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Agents:
  • paris:   3 entries
  • bob:     4 entries
  • wendy:   2 entries
  • queenie: 2 entries
  • writer:  2 entries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Most Accessed:
  Entry #12: 15 accesses
  Entry #14: 8 accesses
  Entry #11: 5 accesses
```

### Understanding the Stats

- **Total Entries**: Number of conversations stored
- **Database Size**: Disk space used (typically 10-50 MB)
- **Entry Types**: Categorization of memories
- **Agents**: Which agents created which memories
- **Most Accessed**: Popular memories (frequently referenced)

---

## Step 5: Export & Backup

### Export All Memories

```bash
# Export everything to JSON
ax memory export backup.json
```

**Output:**
```
📦 Exporting memories...

✓ Exported 13 entries
✓ Saved to: backup.json
✓ File size: 45.2 KB
```

### Selective Export

```bash
# Export only conversations
ax memory export conversations.json --type conversation

# Export from specific agent
ax memory export paris-work.json --agent paris

# Export date range
ax memory export recent.json --from 2025-10-01

# Combine filters
ax memory export team-knowledge.json \
  --type conversation \
  --from 2025-10-01 \
  --to 2025-10-10
```

### Why Export?

✅ **Backup**: Protect against data loss
✅ **Sharing**: Share knowledge with team
✅ **Migration**: Move between projects
✅ **Archive**: Long-term storage

---

## Step 6: Import Memories

### Import Exported Data

```bash
# Import from backup
ax memory import backup.json
```

**Output:**
```
📥 Importing memories...

✓ Validated 13 entries
✓ Imported 13 new entries
✓ Skipped 0 duplicates

Total entries now: 26
```

### Import with Options

```bash
# Skip duplicates (default behavior)
ax memory import backup.json --skip-duplicates

# Validate before import
ax memory import backup.json --validate

# Use smaller batches (for large imports)
ax memory import huge-backup.json --batch-size 100
```

### Use Cases

**Team Knowledge Sharing:**
```bash
# Developer A exports
ax memory export project-knowledge.json --type conversation

# Share file (git, email, etc.)

# Developer B imports
ax memory import project-knowledge.json

# Now both have same knowledge base
```

**Project Templates:**
```bash
# Create template with best practices
ax memory export template-practices.json --tags best-practices

# New project
ax setup
ax memory import template-practices.json

# Start with proven patterns
```

---

## Step 7: Clean Up Memory

### View What to Clean

```bash
# See old entries
ax memory list --before 30  # Older than 30 days
```

### Clear Old Entries

```bash
# Clear entries older than 30 days
ax memory clear --older-than 30
```

**Output:**
```
🗑️  Clearing old memories...

⚠️  This will delete 8 entries older than 30 days
Continue? (y/N): y

✓ Deleted 8 entries
✓ Remaining: 5 entries
✓ Freed space: 32 KB
```

### Selective Cleanup

```bash
# Clear by type
ax memory clear --type experiment

# Clear by agent
ax memory clear --agent old-agent

# Clear specific date range
ax memory clear --from 2025-01-01 --to 2025-06-01
```

### Clear All (⚠️ Dangerous)

```bash
# Export first!
ax memory export full-backup.json

# Then clear everything
ax memory clear --all
```

**Warning**: This is irreversible unless you have a backup!

---

## Step 8: Memory-Driven Workflow

### Scenario: Multi-Day Project

**Day 1: Design Phase**
```bash
ax run paris "Design authentication system with JWT and OAuth2"
# → Design saved to memory
```

**Day 2: Implementation**
```bash
ax run bob "Implement the authentication system"
# → Memory auto-injects Paris's design
# → Bob implements based on design
```

**Week 2: Security Audit**
```bash
ax run steve "Security audit the authentication system"
# → Memory finds: Design + Implementation
# → Steve reviews with full context
```

**Week 3: Documentation**
```bash
ax run wendy "Document the authentication system"
# → Memory finds: Design + Implementation + Audit
# → Wendy creates comprehensive docs
```

**Week 4: Bug Fix**
```bash
ax run bob "Fix JWT token expiration issue"
# → Memory finds: All auth-related work
# → Bob fixes with full historical context
```

### The Value

**Without Memory:**
- User repeats context at each step
- Agents start from scratch every time
- Risk of inconsistency
- Time wasted on explanations

**With Memory:**
- Context flows automatically
- Agents build on past work
- Consistency maintained
- User focuses on new work

---

## Step 9: Verify Memory is Working

### Test Automatic Injection

```bash
# 1. Create first memory
ax run paris "Design a REST API with GET /users endpoint"

# 2. Test memory retrieval
ax memory search "REST API users"
# Should find Paris's design

# 3. Run dependent task
ax run bob "Implement the users endpoint"

# 4. Check if Bob received context
# In Bob's response, look for references to Paris's design
# Example: "Based on the REST API design with GET /users..."
```

### Debug Memory Issues

```bash
# Check if memory is enabled
ax status
# Look for: Memory: ✓ Enabled

# Check database exists
ls .automatosx/memory/memory.db

# Check entry count
ax memory stats

# Test search
ax memory search "test query"

# Verify auto-injection
ax run --verbose agent "task"
# Look for: "Memory injected: X entries"
```

---

## Best Practices

### 1. Regular Backups

```bash
# Weekly backup
ax memory export backup-$(date +%Y%m%d).json

# Keep backups in version control
git add memory-backups/
git commit -m "Weekly memory backup"
```

### 2. Periodic Cleanup

```bash
# Monthly maintenance
ax memory clear --older-than 90

# Remove experimental work
ax memory clear --type experiment
```

### 3. Knowledge Sharing

```bash
# Export team knowledge
ax memory export --type conversation team-knowledge.json

# Share with team
cp team-knowledge.json /shared/project/

# Import on team machines
ax memory import /shared/project/team-knowledge.json
```

### 4. Privacy Management

```bash
# Don't save sensitive tasks to memory
ax run agent "sensitive task" --skip-memory

# Clear sensitive entries
ax memory list --tags sensitive
ax memory clear --tags sensitive
```

### 5. Efficient Searching

```bash
# Use specific keywords
ax memory search "JWT token implementation"  # Good
ax memory search "auth"  # Too broad

# Combine filters
ax memory search "bug fix" --agent bob --type conversation

# Use date filters
ax memory search "design" --from 2025-10-01
```

---

## Advanced Topics

### Memory Configuration

Edit `.automatosx/config.json` or `ax.config.json`:

```json
{
  "memory": {
    "enabled": true,
    "dbPath": ".automatosx/memory/memory.db",
    "maxEntries": 10000,
    "autoCleanup": true,
    "cleanupDays": 30,
    "trackAccess": true,
    "defaultSearchLimit": 5
  }
}
```

**Options:**
- `enabled`: Enable/disable memory system
- `maxEntries`: Maximum entries to keep (prevents unbounded growth)
- `autoCleanup`: Automatically delete old entries
- `cleanupDays`: Delete entries older than N days
- `trackAccess`: Track access count for LRU eviction
- `defaultSearchLimit`: How many memories to inject per execution

### Disable Memory Temporarily

```bash
# Single execution without memory
ax run agent "task" --skip-memory

# Useful for:
# - One-off tasks
# - Privacy-sensitive work
# - Testing without context
```

### Memory Size Management

```bash
# Check size
ax memory stats

# If too large:
# 1. Export important entries
ax memory export important.json --type conversation

# 2. Clear all
ax memory clear --all

# 3. Import back
ax memory import important.json

# Result: Smaller, curated knowledge base
```

---

## Troubleshooting

### Memory Not Found

**Problem**: `ax memory search "query"` returns no results

**Solutions:**
```bash
# 1. Check if entries exist
ax memory list

# 2. Verify search query
ax memory search "broader query"

# 3. Check filters
ax memory search "query" --type conversation
```

### Search Too Slow

**Problem**: Searches take >1 second

**Solutions:**
```bash
# 1. Check database size
ax memory stats

# 2. Clear old entries
ax memory clear --older-than 60

# 3. Reduce max entries in config
{
  "memory": {
    "maxEntries": 5000  // Reduced from 10000
  }
}
```

### Import Fails

**Problem**: `ax memory import` fails

**Solutions:**
```bash
# 1. Validate JSON
ax memory import backup.json --validate

# 2. Check JSON format
cat backup.json | jq .

# 3. Use smaller batches
ax memory import backup.json --batch-size 100
```

---

## Summary

You've learned how to:

✅ Understand memory's purpose (long-term knowledge base)
✅ See memory work automatically (context injection)
✅ Search memory effectively (FTS5 keyword search)
✅ Export/import for backup and sharing
✅ Clean up old memories
✅ Use memory in multi-day workflows
✅ Debug memory issues

### Key Takeaways

1. **Memory is automatic**: Every execution saves to memory
2. **Context is free**: Agents get relevant past context automatically
3. **Search is fast**: < 1ms, zero cost, 100% local
4. **Backup is easy**: Export/import JSON files
5. **Cleanup is simple**: Clear old entries periodically

---

## Next Steps

- **[Agent Communication Guide](../guides/agent-communication.md)** - Understand delegation vs memory
- **[Multi-Agent Orchestration](../guides/multi-agent-orchestration.md)** - Build complex workflows
- **[CLI Commands Reference](../reference/cli-commands.md)** - All memory commands

---

**Happy learning! 🚀**
