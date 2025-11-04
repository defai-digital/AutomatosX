# AX Init Default Template Fix

## Issue Reported

User reported error when running `ax init`:
```
Invalid values:
  Argument: template, Given: "basic", Choices: "minimal", "standard", "comprehensive"
✗ ax init failed with code 1
```

The command was showing "basic" template being used, which doesn't exist in the template choices.

## User Request

"please adjust the ax init to have default to use comprehensive output"

## Fix Applied

Changed the default template from **'standard'** to **'comprehensive'** in `src/cli/commands/init.ts`.

### Changes Made (3 edits):

#### 1. Line 41 - Changed default option value
```typescript
.option('template', {
  alias: 't',
  describe: 'Template to use',
  type: 'string',
  choices: ['minimal', 'standard', 'comprehensive'],
  default: 'comprehensive'  // ✅ Changed from 'standard'
})
```

#### 2. Lines 77-84 - Updated help examples
```typescript
.example([
  ['$0 init', 'Create ax.md with comprehensive template (default)'],
  ['$0 init -t minimal', 'Create minimal ax.md'],
  ['$0 init -t standard', 'Create standard ax.md'],
  ['$0 init --yaml', 'Create comprehensive ax.md + ax.config.yml'],
  ['$0 init --agents backend,frontend,security', 'Specify which agents you use'],
  ['$0 init --name "My Project" --description "A cool app"', 'Custom project info'],
  ['$0 init --analyze', 'AI auto-analyzes project and generates intelligent ax.md']
])
```

#### 3. Line 232 - Updated fallback logic
```typescript
const template = argv.template || 'comprehensive';  // ✅ Changed from 'standard'
```

## Build Status

Rebuilt the project with:
```bash
npm run build
```

Output:
```
CLI tsup v8.5.0
CLI Using tsup config: /Users/akiralam/code/automatosx/tsup.config.ts
CLI Target: node20
CLI Cleaning output folder
ESM Build start
DTS Build start
ESM dist/index.js 2.08 MB
ESM ⚡️ Build success in 759ms
DTS ⚡️ Build success in 1742ms
```

✅ **Build completed successfully** - Changes compiled into `dist/index.js`

## Verification

Tested the fix:

### 1. Help Output Verification
```bash
ax init --help
```

Shows:
```
-t, --template  Template to use  [string] [choices: "minimal", "standard", "comprehensive"] [default: "comprehensive"]
```

✅ **Default is now "comprehensive"**

### 2. Command Execution Test
```bash
mkdir -p /tmp/test-ax-init-v2
cd /tmp/test-ax-init-v2
ax init --force
```

Output:
```
🚀 AutomatosX Project Context Setup

✅ Created ax.md
   Template: comprehensive
   Location: /private/tmp/test-ax-init-v2/ax.md

📝 Next Steps:
   1. Edit ax.md to customize for your project:
      vim ax.md
   2. Use AutomatosX agents with project context:
      ax run backend "implement feature"
   3. Commit ax.md to version control:
      git add ax.md
      git commit -m "Add AutomatosX project context"
```

✅ **Comprehensive template is being used by default**

### 3. Generated File Verification
The generated `ax.md` includes comprehensive sections:
- Project Overview (description, architecture, stack, team)
- Agent Delegation Rules (backend, frontend, mobile, devops, security, quality, writer, architecture)
- Coding Conventions (testing, code style, git workflow)
- Critical Rules
- Common Commands
- File Structure
- And more...

✅ **Full comprehensive template content confirmed**

## Status

**✅ FIX COMPLETE**

The `ax init` command now:
- Uses "comprehensive" as the default template (as requested)
- No longer shows the "basic" template error
- Generates detailed project context with all comprehensive sections
- Help text and examples correctly show "comprehensive" as default

## Usage

```bash
# Uses comprehensive template by default (NEW)
ax init

# Still can choose other templates explicitly
ax init -t minimal
ax init -t standard
ax init -t comprehensive
```

## Files Modified

- `src/cli/commands/init.ts` (3 edits: lines 41, 77-84, 232)

## Version

- AutomatosX v7.1.2
- Build: 2025-11-04
