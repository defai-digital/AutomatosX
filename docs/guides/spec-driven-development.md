# Guide: Spec-Driven Development

**Transform AutomatosX from a tool into a platform.** Spec-Kit elevates AutomatosX from executing individual agent tasks to orchestrating complex, multi-agent workflows with automatic dependency management.

This guide provides a deep dive into how to use this powerful feature.

---

### 🎯 The Game Changer: Manual vs. Automated

**Before Spec-Kit** (Manual Coordination):
If you wanted to build a feature, you had to run each command manually, in the correct order, and wait for each to finish. This is slow and error-prone.

```bash
# You manually execute each task in order
ax run backend "Setup authentication"
ax run backend "Implement JWT"           # Wait for setup to finish
ax run security "Audit authentication"   # Wait for implementation
ax run quality "Write tests"             # Remember dependencies
ax run devops "Deploy to staging"        # Hope you got the order right
```

**Problems:**
- ❌ Manual coordination of every single task
- ❌ Easy to forget dependencies or run tasks in wrong order
- ❌ No progress tracking - can't resume if interrupted
- ❌ Can't parallelize independent tasks
- ❌ Difficult to share workflows with team

**With Spec-Kit** (Automated Orchestration):
You define the entire workflow once, and AutomatosX handles the rest.

```bash
# 1. Define your workflow once in .specify/tasks.md
- [ ] id:auth:setup ops:"ax run backend 'Setup authentication'"
- [ ] id:auth:impl ops:"ax run backend 'Implement JWT'" dep:auth:setup
- [ ] id:auth:audit ops:"ax run security 'Audit'" dep:auth:impl
- [ ] id:auth:test ops:"ax run quality 'Write tests'" dep:auth:impl
- [ ] id:deploy ops:"ax run devops 'Deploy'" dep:auth:audit,auth:test

# 2. Execute with one command
ax spec run --parallel

# AutomatosX automatically:
# ✅ Executes auth:setup first
# ✅ Runs auth:impl after setup completes
# ✅ Runs auth:audit AND auth:test in PARALLEL (both depend only on impl)
# ✅ Waits for both audit and test before deploying
# ✅ Saves progress - can resume if interrupted
```

---

### 💡 Key Concepts

#### 1. **Declarative Workflows** (Describe WHAT, not HOW)
You define the desired outcome and dependencies in simple markdown files. AutomatosX figures out the execution order automatically.

#### 2. **Smart Dependency Management**
- **DAG (Directed Acyclic Graph)**: Your `dep:` tags create a dependency graph, which AutomatosX uses to resolve the correct execution order.
- **Cycle Detection**: The system automatically detects and reports impossible workflows (e.g., Task A depends on B, and B depends on A).
- **Topological Sorting**: This algorithm ensures that a task only runs after all its dependencies are met.

#### 3. **Parallel Execution**
AutomatosX analyzes the dependency graph to find tasks that can run simultaneously, significantly speeding up execution time.

```bash
ax spec run --parallel

# Execution plan:
# Level 1: auth:setup
# Level 2: auth:impl
# Level 3: auth:audit, auth:test  ← Run in parallel!
# Level 4: deploy
```

#### 4. **Progress Tracking & Resume**
If your workflow is interrupted, AutomatosX saves the progress. Completed tasks are marked in `tasks.md`.

```bash
ax spec status
# 📊 Progress: 3/5 tasks (60%)
# ✅ Completed: auth:setup, auth:impl, auth:test
# ⏳ Pending: auth:audit, deploy

# To resume, simply run the command again:
ax spec run  # Automatically skips completed tasks
```

---

### 🎨 Natural Language Workflows (v5.8.3)

**The easiest way to use Spec-Kit** is to describe what you want in plain English. This is the recommended starting point.

```bash
# Method 1: Direct command
ax spec create "Build authentication with database, API, JWT, security audit, and tests"

# Method 2: Interactive prompt (automatically suggested for complex tasks)
ax run backend "Build complete authentication system with database, API, JWT, audit, and tests"
# → AutomatosX detects complexity and suggests a spec-kit workflow
# → Generates .specify/ files automatically
# → Executes with parallel mode

# Method 3: Create and execute immediately
ax spec create "Build auth system" --execute
```

**What happens automatically**:
1. ✅ AI analyzes your description.
2. ✅ Generates `spec.md`, `plan.md`, and `tasks.md`.
3. ✅ Creates task dependencies intelligently.
4. ✅ Selects appropriate agents for each task.
5. ✅ Optionally executes with parallel mode.

**Example Output**:
```
🎨 Spec-Kit: Create from Natural Language

📊 Complexity Analysis:
  Score: 8/10
  • Multiple technical components
  • Project-level scope
  • 5 items separated by commas

✓ Spec files generated

📁 Files:
  • .specify/spec.md - Project specification
  • .specify/plan.md - Technical plan
  • .specify/tasks.md - 8 tasks with dependencies

📋 Tasks Overview:
  • auth: 3 tasks
  • test: 2 tasks
  • security: 1 task
  • deploy: 2 tasks

🤖 Agents:
  • backend: 3 tasks
  • quality: 2 tasks
  • security: 1 task
  • devops: 2 tasks
```

---

### 🚀 Quick Start (Manual Method)

For maximum control, you can create the spec files manually.

```bash
# 1. Initialize spec-kit in your project
ax init --spec-kit

# 2. Edit the generated .specify/ files
.specify/
├── spec.md    # High-level requirements and success criteria
├── plan.md    # Technical approach and architecture
└── tasks.md   # Task breakdown with dependencies

# 3. Validate your spec for errors
ax spec validate

# 4. Preview the execution plan (dry-run)
ax spec run --dry-run

# 5. Execute the workflow
ax spec run --parallel

# 6. Track progress at any time
ax spec status

# 7. Visualize dependencies
ax spec graph
# Or export to an image
ax spec graph --dot | dot -Tpng -o workflow.png
```

---

### 🎓 Real-World Example

Here is a complete example of building a user authentication feature.

**.specify/tasks.md**:
```markdown
## Phase 1: Design
- [ ] id:design:api ops:"ax run product 'Design authentication API'"
- [ ] id:design:db ops:"ax run backend 'Design user schema'" dep:design:api

## Phase 2: Implementation
- [ ] id:impl:backend ops:"ax run backend 'Implement JWT auth'" dep:design:db
- [ ] id:impl:frontend ops:"ax run frontend 'Build login UI'" dep:design:api

## Phase 3: Quality & Security
- [ ] id:test:unit ops:"ax run quality 'Unit tests'" dep:impl:backend
- [ ] id:test:e2e ops:"ax run quality 'E2E tests'" dep:impl:backend,impl:frontend
- [ ] id:security ops:"ax run security 'Security audit'" dep:impl:backend

## Phase 4: Documentation & Deployment
- [ ] id:docs ops:"ax run writer 'Write docs'" dep:impl:backend,impl:frontend
- [ ] id:deploy:staging ops:"ax run devops 'Deploy staging'" dep:test:e2e,security
- [ ] id:deploy:prod ops:"ax run devops 'Deploy production'" dep:deploy:staging
```

**Execution**:
When you run `ax spec run --parallel`, AutomatosX will orchestrate the 7 different agents to collaborate automatically in the correct order, parallelizing where possible.

---

### 💡 When to Use Spec-Kit vs. `ax run`

**Use `ax spec` for:**
- ✅ Complex, multi-step projects (5+ tasks)
- ✅ Workflows with dependencies
- ✅ Production environments requiring reliability
- ✅ Team collaboration (`.specify/` files in Git)
- ✅ Repeatable workflows (bug fixes, deployments)
- ✅ Projects requiring progress tracking

**Use `ax run` for:**
- ✅ Quick, exploratory tasks
- ✅ One-off commands
- ✅ Interactive development
- ✅ Learning and experimentation

Both are powerful—choose the right tool for the job.