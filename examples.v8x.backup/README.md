# AutomatosX - Examples

**Version:** 8.0.0

This directory contains practical examples demonstrating how to use AutomatosX's three core systems:

1. **AI Agent System** (21 specialized agents)
2. **Multi-Provider Integration** (Claude, Gemini, OpenAI)
3. **Workflow Orchestration** (ReScript state machines)

---

## Prerequisites

### Environment Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Configure API keys:**
   Create `.env` file in project root:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=AIza...
   OPENAI_API_KEY=sk-proj-...  # Optional
   ```

4. **Initialize database:**
   ```bash
   npm run cli -- status
   # This will create database and run migrations
   ```

---

## Examples

### 01. Multi-Agent Collaboration

**File:** `01-multi-agent-collaboration.ts`

**What it demonstrates:**
- How to set up and register multiple agents
- Agent collaboration on a complex task
- Provider router integration
- Task execution and result aggregation

**Run:**
```bash
npm run build
node examples/01-multi-agent-collaboration.ts
```

**Expected output:**
```
🤖 Multi-Agent Collaboration Example

Setting up provider router...
Initializing agent registry...
  ✓ Registered Security Agent (vulnerability-scanning, owasp-top-10, secrets-detection)
  ✓ Registered Quality Agent (code-review, linting, complexity-analysis)
  ✓ Registered Architect Agent (system-design, architecture-review, design-patterns)
  ✓ Registered Writer Agent (documentation, technical-writing, api-docs)

📦 Analyzing repository: /Users/you/code/automatosx2

🔒 Step 1: Security Analysis
  → Provider selected: claude (Priority-based selection)
  ✓ claude responded in 1234ms
  ✓ Security analysis completed
    - Duration: 2456ms
    - Findings: 3 vulnerabilities detected

📊 Step 2: Code Quality Analysis
  → Provider selected: gemini (Priority-based selection)
  ✓ gemini responded in 987ms
  ✓ Quality analysis completed

🏗️  Step 3: Architecture Review
  ✓ Architecture review completed

📝 Step 4: Report Generation
  ✓ Report generated

📈 Runtime Statistics:
  - Total tasks executed: 4
  - Successful: 4
  - Failed: 0
  - Average duration: 1567ms

✨ Multi-agent collaboration completed!
```

**Key concepts:**
- `AgentRegistry` - Central registry for all agents
- `AgentRuntime` - Executes tasks using registered agents
- `ProviderRouter` - Routes AI requests to providers
- Task routing based on agent capabilities

---

### 02. Workflow with Provider Fallback

**File:** `02-workflow-with-fallback.ts`

**What it demonstrates:**
- Workflow definition and execution
- Automatic provider fallback on failures
- Checkpoint/resume capability
- Provider health monitoring

**Run:**
```bash
# Normal execution
node examples/02-workflow-with-fallback.ts

# Chaos mode (simulates random provider failures)
CHAOS_MODE=true node examples/02-workflow-with-fallback.ts
```

**Expected output (chaos mode):**
```
🔄 Workflow with Provider Fallback Example

Setting up provider router with fallback...

📋 Workflow Definition:
  - Name: code-review-with-fallback
  - Steps: 4
  - Dependency levels: 3

🚀 Starting workflow execution...

[Attempt 1] Trying claude (retry 1)...
  ✗ claude failed: Chaos mode: Simulated failure for claude
[Attempt 2] Trying claude (retry 2)...
  ✗ claude failed: Chaos mode: Simulated failure for claude
[Attempt 3] Trying gemini (retry 1)...
  ✓ gemini succeeded in 1123ms

[Attempt 4] Trying gemini (retry 1)...
  ✗ gemini failed: Chaos mode: Simulated failure for gemini
[Attempt 5] Trying openai (retry 1)...
  ✓ openai succeeded in 1456ms

✅ Workflow completed successfully!

📊 Execution Summary:
  - Duration: 15234ms
  - Steps completed: 4/4
  - Steps failed: 0

💾 Checkpoint/Resume Capability:
  Note: Checkpoints are created automatically after each level
  To resume: const result = await engine.resumeWorkflow(checkpointId)

🏥 Provider Health Status:
  ✓ claude:
     - Latency: 1234ms
     - Error rate: 67%
     - Requests: 3/min
  ✓ gemini:
     - Latency: 1123ms
     - Error rate: 50%
     - Requests: 2/min
  ✓ openai:
     - Latency: 1456ms
     - Error rate: 0%
     - Requests: 1/min
```

**Key concepts:**
- `WorkflowEngineV2` - Orchestrates multi-step workflows
- Provider fallback chain (Claude → Gemini → OpenAI)
- Automatic retry with exponential backoff
- Checkpoint creation for resume capability
- Health monitoring and metrics

---

## Workflow Examples

See `../workflows/` directory for complete workflow definitions:

### CI/CD Pipeline

**File:** `../workflows/cicd-pipeline.yaml`

Complete CI/CD pipeline with:
- 15 steps across 10 stages
- Security scanning, testing, quality checks
- Parallel and sequential execution
- Multi-environment deployment (staging → production)

**Run:**
```bash
ax workflow execute workflows/cicd-pipeline.yaml \
  --context '{"repository": "./", "branch": "main", "version": "1.2.3"}'
```

**Features demonstrated:**
- Multi-stage workflows
- Dependency management
- Parallel step execution
- Error handling with `continueOnError`
- Multiple agent types (Security, Testing, Quality, DevOps, Infrastructure, Writer)

### Technical Debt Analysis

**File:** `../workflows/tech-debt-analysis.yaml`

Comprehensive technical debt analysis with:
- 24 steps across 10 stages
- Multi-dimensional analysis (security, quality, performance, architecture)
- Priority and ROI calculation
- Executive summary generation

**Run:**
```bash
ax workflow execute workflows/tech-debt-analysis.yaml \
  --context '{"repository": "./", "targetVersion": "2.0.0"}'
```

**Features demonstrated:**
- Complex dependency graphs
- 12+ different agents collaborating
- Financial impact analysis
- Report generation at multiple levels (technical + executive)
- Sprint planning and ticket generation

---

## Running Examples

### Method 1: Direct Execution

```bash
# Build first
npm run build

# Run example
node examples/01-multi-agent-collaboration.ts
```

### Method 2: Using npm scripts

Add to `package.json`:
```json
{
  "scripts": {
    "example:agents": "node examples/01-multi-agent-collaboration.ts",
    "example:fallback": "node examples/02-workflow-with-fallback.ts"
  }
}
```

Then run:
```bash
npm run example:agents
npm run example:fallback
```

### Method 3: CLI Workflows

For YAML workflows, use the CLI:
```bash
# Execute workflow
ax workflow execute workflows/cicd-pipeline.yaml

# Monitor execution
ax workflow status <execution-id>

# Resume from checkpoint
ax workflow resume <checkpoint-id>
```

---

## Creating Your Own Examples

### Example Template

```typescript
/**
 * Example: Your Example Name
 *
 * Description of what this example demonstrates
 */

import { AgentRegistry } from '../src/agents/AgentRegistry.js';
import { ProviderRouterV2 } from '../src/services/ProviderRouterV2.js';
import { getDatabase } from '../src/database/connection.js';

async function yourExample() {
  console.log('🚀 Your Example\n');

  // 1. Setup
  const db = getDatabase();
  const router = new ProviderRouterV2({
    providers: {
      claude: {
        enabled: true,
        priority: 1,
        apiKey: process.env.ANTHROPIC_API_KEY,
        maxRetries: 3,
        timeout: 60000,
      }
    }
  });

  // 2. Your implementation
  // ...

  // 3. Cleanup
  db.close();
}

// Run
if (import.meta.url === `file://${process.argv[1]}`) {
  yourExample()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Example failed:', error);
      process.exit(1);
    });
}

export { yourExample };
```

### Workflow Template

```yaml
# Your Workflow Name
name: your-workflow
version: 1.0.0
description: What this workflow does

steps:
  # Stage 1: First set of tasks
  - key: step1
    description: What this step does
    agent: backend  # Which agent to use
    action: action-name
    provider: claude  # Optional: preferred provider
    timeout: 30000
    continueOnError: false

  - key: step2
    description: Another parallel step
    agent: security
    action: security-scan

  # Stage 2: Depends on stage 1
  - key: step3
    description: Runs after step1 and step2
    agent: quality
    action: quality-check
    dependsOn:
      - step1
      - step2
```

---

## Troubleshooting

### API Key Errors

**Error:** `ProviderAuthError: Invalid API key`

**Solution:**
```bash
# Check environment variables
echo $ANTHROPIC_API_KEY
echo $GOOGLE_API_KEY

# Test provider connection
ax provider test claude
```

### Build Errors

**Error:** `Cannot find module` or TypeScript errors

**Solution:**
```bash
# Clean and rebuild
npm run clean
npm install
npm run build
```

### Database Errors

**Error:** `database is locked` or migration errors

**Solution:**
```bash
# Remove database and recreate
rm -rf .automatosx/
npm run cli -- status  # Recreates DB

# Or manually run migrations
node -e "import('./dist/database/migrations.js').then(m => m.runMigrations())"
```

### Example Fails to Run

**Checklist:**
1. ✓ Project is built (`npm run build`)
2. ✓ API keys are set in `.env`
3. ✓ Database is initialized (`ax status`)
4. ✓ Running from project root directory
5. ✓ Node.js version is 18+

---

## Performance Tips

### 1. Enable Caching

```typescript
import { WorkflowCache } from '../src/cache/WorkflowCache.js';

const cache = new WorkflowCache({
  maxSize: 1000,
  ttl: 3600000, // 1 hour
});

const engine = new WorkflowEngineV2(db, cache);
```

### 2. Adjust Timeouts

For long-running tasks:
```yaml
steps:
  - key: slow-task
    timeout: 300000  # 5 minutes
```

### 3. Parallel Execution

Maximize parallelism by minimizing dependencies:
```yaml
# Good: 3 steps run in parallel
steps:
  - key: step1
  - key: step2
  - key: step3

# Bad: All steps run sequentially
steps:
  - key: step1
  - key: step2
    dependsOn: [step1]
  - key: step3
    dependsOn: [step2]
```

### 4. Provider Selection

Use faster/cheaper providers for simple tasks:
```yaml
steps:
  - key: simple-task
    provider: gemini  # Faster and cheaper
  - key: complex-task
    provider: claude  # More capable
```

---

## Next Steps

1. **Run all examples** to understand each system
2. **Review workflows** in `workflows/` directory
3. **Read integration guide** at `automatosx/PRD/INTEGRATION-GUIDE.md`
4. **Create custom agents** using examples as templates
5. **Design workflows** for your use cases

## Additional Resources

- **Integration Guide:** `../automatosx/PRD/INTEGRATION-GUIDE.md`
- **Agent Development:** `../docs/agent-development.md`
- **Workflow Guide:** `../docs/workflow-development.md`
- **API Reference:** `../docs/api-reference.md`

---

**Questions?** Open an issue on GitHub or check the documentation.

**Last Updated:** January 11, 2025
