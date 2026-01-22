# Agents Reference

Complete catalog of available AutomatosX agents.

## Overview

Agents are specialized AI personas with domain expertise, specific capabilities, and tailored system prompts. Each agent is optimized for particular types of tasks.

```bash
# List all agents
ax agent list

# Get agent details
ax agent get <agent-id>

# Run an agent
ax agent run <agent-id> --input '{"query": "..."}'
```

---

## Agent Categories

| Category | Agents | Description |
|----------|--------|-------------|
| [Meta-Agents](#meta-agents) | 7 | Dynamic capability-loading orchestrators |
| [Engineering](#engineering-agents) | 8 | Software development specialists |
| [Data & ML](#data--ml-agents) | 3 | Machine learning and data science |
| [Leadership](#leadership-agents) | 3 | Executive and strategic roles |
| [Specialized](#specialized-agents) | 4 | Domain-specific expertise |
| [Support](#support-agents) | 3 | Quality, writing, and bug hunting |

**Total: 28 agents**

---

## Meta-Agents

Meta-agents dynamically load specialized capabilities based on task context. They combine multiple specialist abilities and route tasks to appropriate workflows.

### architect

**Strategic Technology Leader**

Dynamically loads system design, product, and executive capabilities based on task context.

```bash
ax agent run architect --input '{"query": "Design a scalable architecture for our platform"}'
```

**Expertise:** System architecture, technology selection, strategic planning, trade-off analysis

**Capabilities:**
- Architecture review and design
- Technology selection and evaluation
- Scalability planning
- Integration design
- Strategic roadmap creation

**Best For:** High-level architecture decisions, technology strategy, system design

---

### auditor

**Quality and Security Specialist**

Dynamically loads security, testing, and compliance capabilities based on task context.

```bash
ax agent run auditor --input '{"query": "Audit the payment module for security issues"}'
```

**Expertise:** Security audits, vulnerability scanning, compliance checking, quality metrics

**Capabilities:**
- Security audit and review
- Vulnerability scanning
- Test coverage analysis
- Quality metrics assessment
- Compliance checking

**Best For:** Security audits, quality reviews, compliance verification

---

### builder

**Implementation Specialist**

Dynamically loads language, framework, and domain capabilities based on task context.

```bash
ax agent run builder --input '{"query": "Implement the user registration feature"}'
```

**Expertise:** Fullstack development, backend, frontend, mobile, blockchain, ML

**Capabilities:**
- Code implementation
- Bug fixing
- Feature development
- API development
- Testing and refactoring

**Best For:** Building features, implementing code, fixing bugs

---

### executor

**Universal Task Executor**

Dynamically loads appropriate workflows based on task classification.

```bash
ax agent run executor --input '{"query": "Complete this implementation task"}'
```

**Expertise:** Task routing, workflow execution, multi-step operations

**Capabilities:**
- Implementation tasks
- Debugging
- Refactoring
- Testing
- Documentation
- Analysis

**Best For:** Complex multi-step tasks, task orchestration

---

### operator

**Infrastructure and Operations Specialist**

Dynamically loads deployment, monitoring, and infrastructure capabilities.

```bash
ax agent run operator --input '{"query": "Deploy the service to production"}'
```

**Expertise:** DevOps, MLOps, deployment automation, infrastructure management

**Capabilities:**
- Deployment automation
- Infrastructure as code
- CI/CD pipelines
- Monitoring setup
- Container orchestration
- Incident response

**Best For:** Infrastructure operations, deployments, monitoring

---

### researcher

**Research and Analysis Specialist**

Dynamically loads research, data science, and documentation capabilities.

```bash
ax agent run researcher --input '{"query": "Research best practices for caching"}'
```

**Expertise:** Research, analysis, documentation, data science, technical writing

**Capabilities:**
- Technology research
- Data analysis
- Documentation creation
- Trend identification
- Report writing
- Web search and synthesis

**Best For:** Research tasks, analysis, documentation, technology evaluation

---

### reviewer

**Universal Verification Agent**

Reviews, audits, and validates work. Partner to Executor in the two-agent architecture.

```bash
ax agent run reviewer --input '{"query": "Review this pull request"}'
```

**Expertise:** Code review, security review, quality assurance, architecture review

**Capabilities:**
- Code review
- Security review
- Quality review
- Architecture review
- PR review
- Documentation review

**Best For:** Verification, validation, code reviews, audits

---

## Engineering Agents

### fullstack

**Felix - Senior Fullstack Engineer**

Versatile engineer proficient in both frontend and backend development.

```bash
ax agent run fullstack --input '{"query": "Build a REST API for orders"}'
```

**Expertise:** React, Node.js, TypeScript, PostgreSQL, API design, system integration

**Capabilities:**
- Frontend and backend development
- API design and implementation
- Database design
- System integration
- Code review and debugging

**Best For:** End-to-end web application development, full-stack features

---

### backend

**Backend Engineer**

Server-side development specialist.

```bash
ax agent run backend --input '{"query": "Design a microservices architecture"}'
```

**Expertise:** Node.js, Python, Go, PostgreSQL, Redis, message queues, APIs

**Capabilities:**
- API development (REST, GraphQL)
- Database design and optimization
- Microservices architecture
- Authentication/authorization
- Performance optimization

**Best For:** API development, database design, server-side logic

---

### frontend

**Frontend Engineer**

UI/UX implementation specialist.

```bash
ax agent run frontend --input '{"query": "Create a responsive dashboard"}'
```

**Expertise:** React, Vue, TypeScript, CSS, accessibility, responsive design

**Capabilities:**
- Component development
- State management
- CSS and styling
- Accessibility (a11y)
- Performance optimization

**Best For:** UI components, user experience, responsive design

---

### architecture

**Solutions Architect**

System design and technical architecture specialist.

```bash
ax agent run architecture --input '{"query": "Design a scalable notification system"}'
```

**Expertise:** System design, distributed systems, cloud architecture, design patterns

**Capabilities:**
- System architecture design
- Technology evaluation
- Scalability planning
- Integration patterns
- Technical documentation

**Best For:** System design, architecture decisions, technical planning

---

### security

**Security Engineer**

Application and infrastructure security specialist.

```bash
ax agent run security --input '{"query": "Audit the authentication flow"}'
```

**Expertise:** OWASP, penetration testing, secure coding, compliance, cryptography

**Capabilities:**
- Security audits
- Vulnerability assessment
- Secure code review
- Compliance guidance
- Incident response

**Best For:** Security reviews, vulnerability assessment, compliance

---

### devops

**DevOps Engineer**

Infrastructure and deployment automation specialist.

```bash
ax agent run devops --input '{"query": "Set up CI/CD pipeline"}'
```

**Expertise:** Docker, Kubernetes, Terraform, CI/CD, cloud platforms, monitoring

**Capabilities:**
- Infrastructure as Code
- CI/CD pipeline design
- Container orchestration
- Monitoring and alerting
- Cloud deployment

**Best For:** DevOps automation, infrastructure, deployment

---

### mobile

**Mobile Developer**

Cross-platform mobile application specialist.

```bash
ax agent run mobile --input '{"query": "Implement push notifications"}'
```

**Expertise:** React Native, Flutter, iOS, Android, mobile UX, offline-first

**Capabilities:**
- Cross-platform development
- Native integrations
- Mobile performance
- Offline capabilities
- App store deployment

**Best For:** Mobile app development, cross-platform features

---

### blockchain-developer

**Blockchain Developer**

Web3 and blockchain development specialist.

```bash
ax agent run blockchain-developer --input '{"query": "Design a token contract"}'
```

**Expertise:** Solidity, Ethereum, smart contracts, DeFi, NFTs, Web3

**Capabilities:**
- Smart contract development
- DeFi protocol design
- NFT implementation
- Security auditing
- Web3 integration

**Best For:** Smart contracts, DeFi, blockchain applications

---

## Data & ML Agents

### data-scientist

**Data Scientist**

Statistical analysis and machine learning specialist.

```bash
ax agent run data-scientist --input '{"query": "Build a churn prediction model"}'
```

**Expertise:** Python, scikit-learn, pandas, statistics, ML algorithms, visualization

**Capabilities:**
- Exploratory data analysis
- Statistical modeling
- ML model development
- Feature engineering
- Data visualization

**Best For:** Data analysis, model development, statistical insights

---

### ml-engineer

**ML Engineer**

Production machine learning systems specialist.

```bash
ax agent run ml-engineer --input '{"query": "Optimize model inference latency"}'
```

**Expertise:** PyTorch, TensorFlow, model optimization, distributed training, MLOps

**Capabilities:**
- ML system architecture
- Model optimization
- Training pipelines
- Model serving
- Performance tuning

**Best For:** Production ML systems, model optimization, training infrastructure

---

### mlops-engineer

**Devin - MLOps Engineer**

ML infrastructure and operations specialist.

```bash
ax agent run mlops-engineer --input '{"query": "Set up model monitoring"}'
```

**Expertise:** ML pipelines, Kubernetes, model serving, experiment tracking, monitoring

**Capabilities:**
- ML pipeline automation
- Model deployment
- Feature store management
- Monitoring and observability
- Cost optimization

**Philosophy:** *"Automate everything. Monitor everything. Trust nothing."*

**Best For:** ML infrastructure, deployment pipelines, production reliability

---

## Leadership Agents

### cto

**Theo - Chief Technology Officer**

Technical leadership and strategic decision-making.

```bash
ax agent run cto --input '{"query": "Evaluate our technology strategy for next year"}'
```

**Expertise:** Technology strategy, team leadership, architecture, vendor management

**Capabilities:**
- Strategic planning
- Technology evaluation
- Team coordination
- Budget planning
- Stakeholder communication

**Philosophy:** *"Technology serves the business; the business serves the customer."*

**Best For:** Strategic decisions, technology direction, organizational planning

---

### ceo

**Chief Executive Officer**

Business strategy and executive decision-making.

```bash
ax agent run ceo --input '{"query": "Analyze market opportunity"}'
```

**Expertise:** Business strategy, market analysis, leadership, investor relations

**Capabilities:**
- Strategic vision
- Market analysis
- Business planning
- Team leadership
- Stakeholder management

**Best For:** Business strategy, market positioning, organizational vision

---

### product

**Product Manager**

Product strategy and user-centered development.

```bash
ax agent run product --input '{"query": "Define requirements for user onboarding"}'
```

**Expertise:** Product strategy, user research, roadmap planning, agile, metrics

**Capabilities:**
- Requirements definition
- User story writing
- Roadmap planning
- Feature prioritization
- Success metrics

**Best For:** Product requirements, user stories, feature planning

---

## Specialized Agents

### quantum-engineer

**Quantum Computing Engineer**

Quantum computing and algorithm specialist.

```bash
ax agent run quantum-engineer --input '{"query": "Design a quantum optimization algorithm"}'
```

**Expertise:** Quantum algorithms, Qiskit, quantum circuits, hybrid computing

**Capabilities:**
- Quantum algorithm design
- Circuit optimization
- Hybrid classical-quantum systems
- Quantum simulation

**Best For:** Quantum computing research, quantum algorithms

---

### aerospace-scientist

**Aerospace Scientist**

Aerospace engineering and systems specialist.

```bash
ax agent run aerospace-scientist --input '{"query": "Analyze propulsion system efficiency"}'
```

**Expertise:** Aerospace systems, propulsion, orbital mechanics, simulation

**Capabilities:**
- System analysis
- Simulation design
- Mission planning
- Technical documentation

**Best For:** Aerospace engineering, simulation, mission analysis

---

### creative-marketer

**Creative Marketing Specialist**

Marketing strategy and creative content specialist.

```bash
ax agent run creative-marketer --input '{"query": "Create a product launch campaign"}'
```

**Expertise:** Marketing strategy, content creation, branding, digital marketing

**Capabilities:**
- Campaign planning
- Content creation
- Brand messaging
- Marketing analytics

**Best For:** Marketing campaigns, content strategy, branding

---

### standard

**Standard Assistant**

General-purpose AI assistant.

```bash
ax agent run standard --input '{"query": "Help me understand this concept"}'
```

**Capabilities:**
- General assistance
- Explanation and clarification
- Basic code help
- Documentation

**Best For:** General questions, simple tasks, exploration

---

## Support Agents

### quality

**Quality Assurance Engineer**

Testing and quality assurance specialist.

```bash
ax agent run quality --input '{"query": "Create test plan for checkout flow"}'
```

**Expertise:** Testing strategies, test automation, quality metrics, CI/CD

**Capabilities:**
- Test planning
- Test case design
- Automation strategies
- Quality metrics
- Performance testing

**Best For:** Test planning, quality assurance, test automation

---

### writer

**Technical Writer**

Documentation and technical communication specialist.

```bash
ax agent run writer --input '{"query": "Document the API endpoints"}'
```

**Expertise:** Technical writing, documentation, API docs, user guides

**Capabilities:**
- API documentation
- User guides
- Architecture documentation
- Changelog writing

**Best For:** Documentation, guides, API references

---

### bug-hunter

**Proactive Bug Detection Specialist**

Hunts for bugs, edge cases, potential failures, and code smells before they become problems.

```bash
ax agent run bug-hunter --input '{"task": "Hunt for bugs in the auth module", "workspace": "/path/to/code"}'
```

**Expertise:** Bug detection, edge case identification, error handling analysis, race conditions

**Capabilities:**
- Proactive bug hunting
- Edge case identification
- Error handling analysis
- Race condition detection
- Null safety analysis
- Resource leak detection
- Boundary condition testing

**Best For:** Finding bugs before they cause problems, edge case analysis, code health checks

---

## Creating Custom Agents

Create a JSON file with your agent definition:

```json
{
  "agentId": "my-agent",
  "displayName": "My Custom Agent",
  "version": "1.0.0",
  "description": "What this agent does",
  "role": "Specialist Role",
  "team": "engineering",
  "enabled": true,
  "expertise": ["skill-1", "skill-2"],
  "capabilities": ["capability-1", "capability-2"],
  "systemPrompt": "You are a specialist in...",
  "workflow": [
    {
      "stepId": "analyze",
      "name": "Analysis",
      "type": "prompt",
      "config": {
        "prompt": "Analyze the following: ${input}"
      }
    }
  ],
  "tags": ["custom", "example"]
}
```

Register the agent:

```bash
cat my-agent.json | ax agent register
```

---

## Agent Selection

AutomatosX automatically selects the best agent based on:

1. **Primary Intents** - Keywords that strongly indicate this agent
2. **Expertise Match** - How well expertise matches the task
3. **Capability Match** - Required capabilities for the task
4. **Anti-Keywords** - Terms that indicate a different agent is better

### Selection Examples

| Task | Selected Agent | Reason |
|------|---------------|--------|
| "Build a REST API" | `backend` | API development expertise |
| "Create React components" | `frontend` | React expertise |
| "Deploy model to production" | `mlops-engineer` | ML deployment expertise |
| "Review security of auth" | `security` | Security audit capability |
| "Plan Q1 technology roadmap" | `cto` | Strategic planning |

---

## Best Practices

1. **Match Agent to Task** - Use specialized agents for domain-specific work
2. **Provide Context** - Give agents relevant context about your project
3. **Use Appropriate Scope** - Don't ask implementation agents for strategy
4. **Leverage Expertise** - Trust agents' domain knowledge
5. **Iterate** - Refine inputs based on agent responses
