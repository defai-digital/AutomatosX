/**
 * Role-Specific Checklists - Domain expertise encoded as verification lists
 *
 * v13.0.0: Each role gets a checklist that encodes domain-specific concerns
 * that must be considered during the RISK SCAN phase.
 *
 * These checklists transform tacit expert knowledge into explicit verification steps.
 */

import type {
  RoleChecklist,
  RoleChecklistType,
  ChecklistItem,
} from '../../types/cognitive.js';

/**
 * Backend Developer Checklist
 */
const BACKEND_CHECKLIST: RoleChecklist = {
  id: 'backend',
  name: 'Backend Checklist',
  role: 'Backend Developer',
  categories: {
    security: [
      { id: 'be-sec-1', category: 'security', text: 'Authentication: Are endpoints properly protected?', severity: 'critical', triggers: ['api', 'endpoint', 'route'] },
      { id: 'be-sec-2', category: 'security', text: 'Authorization: Is access control enforced (who can do what)?', severity: 'critical', triggers: ['user', 'role', 'permission'] },
      { id: 'be-sec-3', category: 'security', text: 'Input validation: Are all inputs validated and sanitized?', severity: 'critical', triggers: ['input', 'request', 'body', 'params'] },
      { id: 'be-sec-4', category: 'security', text: 'Secrets: No hardcoded credentials, tokens, or keys?', severity: 'critical', triggers: ['config', 'env', 'secret', 'key'] },
    ],
    data_integrity: [
      { id: 'be-data-1', category: 'data_integrity', text: 'Migrations: Are database migrations reversible and safe?', severity: 'high', triggers: ['migration', 'schema', 'database', 'table'] },
      { id: 'be-data-2', category: 'data_integrity', text: 'Transactions: Are operations atomic where needed?', severity: 'high', triggers: ['transaction', 'update', 'insert', 'delete'] },
      { id: 'be-data-3', category: 'data_integrity', text: 'Idempotency: Can operations be safely retried?', severity: 'medium', triggers: ['retry', 'idempotent', 'duplicate'] },
      { id: 'be-data-4', category: 'data_integrity', text: 'Data validation: Are data constraints enforced at DB level?', severity: 'medium', triggers: ['constraint', 'schema', 'validate'] },
    ],
    performance: [
      { id: 'be-perf-1', category: 'performance', text: 'N+1 queries: Are database calls optimized (no loops of queries)?', severity: 'high', triggers: ['query', 'loop', 'database', 'fetch'] },
      { id: 'be-perf-2', category: 'performance', text: 'Caching: Is caching strategy appropriate for this data?', severity: 'medium', triggers: ['cache', 'redis', 'memory'] },
      { id: 'be-perf-3', category: 'performance', text: 'Indexing: Are queries using appropriate indexes?', severity: 'medium', triggers: ['query', 'search', 'filter', 'where'] },
      { id: 'be-perf-4', category: 'performance', text: 'Connection pooling: Are database connections managed properly?', severity: 'medium', triggers: ['connection', 'pool', 'database'] },
    ],
    reliability: [
      { id: 'be-rel-1', category: 'reliability', text: 'Error handling: Are errors caught, logged, and handled gracefully?', severity: 'high', triggers: ['error', 'catch', 'exception'] },
      { id: 'be-rel-2', category: 'reliability', text: 'Retry logic: Is there backoff for transient failures?', severity: 'medium', triggers: ['retry', 'backoff', 'timeout'] },
      { id: 'be-rel-3', category: 'reliability', text: 'Circuit breakers: Are external service calls protected?', severity: 'medium', triggers: ['external', 'api', 'service', 'http'] },
      { id: 'be-rel-4', category: 'reliability', text: 'Observability: Are metrics, logs, and traces in place?', severity: 'medium', triggers: ['log', 'metric', 'trace', 'monitor'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Backend

Before finalizing, verify each applicable item:

**Security** (CRITICAL)
- [ ] Authentication: Are endpoints properly protected?
- [ ] Authorization: Is access control enforced?
- [ ] Input validation: Are all inputs sanitized?
- [ ] Secrets: No hardcoded credentials?

**Data Integrity** (HIGH)
- [ ] Migrations: Reversible and safe?
- [ ] Transactions: Atomic where needed?
- [ ] Idempotency: Safe to retry?
- [ ] Data validation: Constraints enforced?

**Performance** (MEDIUM-HIGH)
- [ ] N+1 queries: Optimized database calls?
- [ ] Caching: Appropriate strategy?
- [ ] Indexing: Queries using indexes?
- [ ] Connection pooling: Managed properly?

**Reliability** (HIGH)
- [ ] Error handling: Graceful failures?
- [ ] Retry logic: Backoff for transient failures?
- [ ] Circuit breakers: External calls protected?
- [ ] Observability: Logs, metrics, traces?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Frontend Developer Checklist
 */
const FRONTEND_CHECKLIST: RoleChecklist = {
  id: 'frontend',
  name: 'Frontend Checklist',
  role: 'Frontend Developer',
  categories: {
    accessibility: [
      { id: 'fe-a11y-1', category: 'accessibility', text: 'Semantic HTML: Are elements properly labeled (headings, landmarks)?', severity: 'high', triggers: ['html', 'element', 'component'] },
      { id: 'fe-a11y-2', category: 'accessibility', text: 'Keyboard navigation: Is everything navigable without mouse?', severity: 'high', triggers: ['button', 'link', 'interactive', 'focus'] },
      { id: 'fe-a11y-3', category: 'accessibility', text: 'Screen reader: Are ARIA labels and roles correct?', severity: 'high', triggers: ['aria', 'label', 'role'] },
      { id: 'fe-a11y-4', category: 'accessibility', text: 'Color contrast: Does it meet WCAG AA standards?', severity: 'medium', triggers: ['color', 'text', 'background', 'style'] },
    ],
    user_experience: [
      { id: 'fe-ux-1', category: 'user_experience', text: 'Loading states: Are async operations indicated to user?', severity: 'high', triggers: ['async', 'fetch', 'load', 'api'] },
      { id: 'fe-ux-2', category: 'user_experience', text: 'Error states: Are failures communicated clearly?', severity: 'high', triggers: ['error', 'fail', 'catch'] },
      { id: 'fe-ux-3', category: 'user_experience', text: 'Empty states: Is there guidance when no data exists?', severity: 'medium', triggers: ['empty', 'no data', 'list', 'table'] },
      { id: 'fe-ux-4', category: 'user_experience', text: 'Responsive: Does it work on all screen sizes?', severity: 'high', triggers: ['layout', 'grid', 'flex', 'responsive'] },
    ],
    performance: [
      { id: 'fe-perf-1', category: 'performance', text: 'Bundle size: Are imports optimized (no full library imports)?', severity: 'medium', triggers: ['import', 'library', 'package'] },
      { id: 'fe-perf-2', category: 'performance', text: 'Lazy loading: Are heavy components/routes deferred?', severity: 'medium', triggers: ['route', 'component', 'heavy', 'large'] },
      { id: 'fe-perf-3', category: 'performance', text: 'Memoization: Are expensive renders cached (useMemo, React.memo)?', severity: 'medium', triggers: ['render', 'memo', 'expensive', 'computation'] },
      { id: 'fe-perf-4', category: 'performance', text: 'Images: Are they optimized and lazy-loaded?', severity: 'medium', triggers: ['image', 'img', 'picture', 'media'] },
    ],
    security: [
      { id: 'fe-sec-1', category: 'security', text: 'XSS: Is user-generated content sanitized before rendering?', severity: 'critical', triggers: ['user', 'content', 'html', 'dangerously'] },
      { id: 'fe-sec-2', category: 'security', text: 'CSRF: Are forms and state-changing requests protected?', severity: 'high', triggers: ['form', 'submit', 'post', 'put', 'delete'] },
      { id: 'fe-sec-3', category: 'security', text: 'Sensitive data: Is PII handled correctly (not logged, masked)?', severity: 'high', triggers: ['password', 'email', 'personal', 'sensitive'] },
      { id: 'fe-sec-4', category: 'security', text: 'Dependencies: No known vulnerable packages?', severity: 'medium', triggers: ['dependency', 'package', 'npm'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Frontend

Before finalizing, verify each applicable item:

**Accessibility** (HIGH)
- [ ] Semantic HTML: Proper labels and landmarks?
- [ ] Keyboard navigation: Works without mouse?
- [ ] Screen reader: ARIA labels correct?
- [ ] Color contrast: Meets WCAG AA?

**User Experience** (HIGH)
- [ ] Loading states: Async operations indicated?
- [ ] Error states: Failures communicated clearly?
- [ ] Empty states: Guidance when no data?
- [ ] Responsive: Works on all screen sizes?

**Performance** (MEDIUM)
- [ ] Bundle size: Imports optimized?
- [ ] Lazy loading: Heavy components deferred?
- [ ] Memoization: Expensive renders cached?
- [ ] Images: Optimized and lazy-loaded?

**Security** (CRITICAL-HIGH)
- [ ] XSS: User content sanitized?
- [ ] CSRF: Forms protected?
- [ ] Sensitive data: PII handled correctly?
- [ ] Dependencies: No known vulnerabilities?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Security Engineer Checklist
 */
const SECURITY_CHECKLIST: RoleChecklist = {
  id: 'security',
  name: 'Security Checklist',
  role: 'Security Engineer',
  categories: {
    threat_model: [
      { id: 'sec-tm-1', category: 'threat_model', text: 'Attack surface: What can be attacked? (inputs, APIs, data stores)', severity: 'critical', triggers: ['api', 'input', 'endpoint'] },
      { id: 'sec-tm-2', category: 'threat_model', text: 'Threat actors: Who would attack this? (script kiddies, insiders, nation states)', severity: 'high', triggers: ['user', 'access', 'public'] },
      { id: 'sec-tm-3', category: 'threat_model', text: 'Assets: What valuable data/access is at risk?', severity: 'critical', triggers: ['data', 'pii', 'credential', 'secret'] },
      { id: 'sec-tm-4', category: 'threat_model', text: 'STRIDE: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation?', severity: 'high', triggers: ['security', 'threat', 'vulnerability'] },
    ],
    owasp_top_10: [
      { id: 'sec-owasp-1', category: 'owasp_top_10', text: 'Injection: SQL, NoSQL, OS, LDAP injection possible?', severity: 'critical', triggers: ['query', 'sql', 'database', 'command'] },
      { id: 'sec-owasp-2', category: 'owasp_top_10', text: 'Broken Auth: Session management, credential handling secure?', severity: 'critical', triggers: ['auth', 'login', 'session', 'token'] },
      { id: 'sec-owasp-3', category: 'owasp_top_10', text: 'Sensitive Data: Encryption at rest and in transit?', severity: 'critical', triggers: ['encrypt', 'https', 'data', 'store'] },
      { id: 'sec-owasp-4', category: 'owasp_top_10', text: 'XXE: External entity processing disabled?', severity: 'high', triggers: ['xml', 'parse', 'entity'] },
      { id: 'sec-owasp-5', category: 'owasp_top_10', text: 'Broken Access Control: Privilege escalation possible?', severity: 'critical', triggers: ['role', 'permission', 'admin', 'access'] },
      { id: 'sec-owasp-6', category: 'owasp_top_10', text: 'Misconfiguration: Default settings, errors exposed?', severity: 'high', triggers: ['config', 'default', 'error', 'debug'] },
      { id: 'sec-owasp-7', category: 'owasp_top_10', text: 'XSS: Reflected, stored, DOM-based XSS possible?', severity: 'critical', triggers: ['html', 'script', 'render', 'output'] },
      { id: 'sec-owasp-8', category: 'owasp_top_10', text: 'Deserialization: Untrusted data deserialized safely?', severity: 'high', triggers: ['json', 'deserialize', 'parse', 'object'] },
      { id: 'sec-owasp-9', category: 'owasp_top_10', text: 'Components: Using components with known vulnerabilities?', severity: 'high', triggers: ['dependency', 'package', 'library', 'npm'] },
      { id: 'sec-owasp-10', category: 'owasp_top_10', text: 'Logging: Insufficient monitoring and logging?', severity: 'medium', triggers: ['log', 'audit', 'monitor', 'alert'] },
    ],
    secrets: [
      { id: 'sec-secret-1', category: 'secrets', text: 'No hardcoded secrets in code or config files?', severity: 'critical', triggers: ['key', 'token', 'password', 'secret'] },
      { id: 'sec-secret-2', category: 'secrets', text: 'Environment variables for sensitive config?', severity: 'high', triggers: ['env', 'config', 'setting'] },
      { id: 'sec-secret-3', category: 'secrets', text: 'Secrets rotation policy in place?', severity: 'medium', triggers: ['rotate', 'expire', 'refresh'] },
      { id: 'sec-secret-4', category: 'secrets', text: 'Audit logging for secret access?', severity: 'medium', triggers: ['audit', 'access', 'log'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Security

Before finalizing, verify each applicable item:

**Threat Model** (CRITICAL)
- [ ] Attack surface: What can be attacked?
- [ ] Threat actors: Who would attack this?
- [ ] Assets: What valuable data is at risk?
- [ ] STRIDE: Spoofing, Tampering, Repudiation, Info Disclosure, DoS, Elevation?

**OWASP Top 10** (CRITICAL)
- [ ] Injection: SQL/NoSQL/OS/LDAP injection possible?
- [ ] Broken Auth: Session/credential handling secure?
- [ ] Sensitive Data: Encrypted at rest and in transit?
- [ ] XXE: External entity processing disabled?
- [ ] Broken Access Control: Privilege escalation possible?
- [ ] Misconfiguration: Defaults secured, errors hidden?
- [ ] XSS: Reflected/stored/DOM XSS prevented?
- [ ] Deserialization: Untrusted data handled safely?
- [ ] Components: No known vulnerable dependencies?
- [ ] Logging: Sufficient monitoring and alerting?

**Secrets Management** (CRITICAL)
- [ ] No hardcoded secrets in code?
- [ ] Env vars for sensitive config?
- [ ] Rotation policy exists?
- [ ] Audit logging for access?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Quality Engineer Checklist
 */
const QUALITY_CHECKLIST: RoleChecklist = {
  id: 'quality',
  name: 'Quality Checklist',
  role: 'QA Engineer',
  categories: {
    test_scope: [
      { id: 'qa-scope-1', category: 'test_scope', text: 'Requirements: Are all requirements covered by tests?', severity: 'high', triggers: ['requirement', 'spec', 'feature'] },
      { id: 'qa-scope-2', category: 'test_scope', text: 'Edge cases: Are boundary conditions tested?', severity: 'high', triggers: ['edge', 'boundary', 'limit', 'max', 'min'] },
      { id: 'qa-scope-3', category: 'test_scope', text: 'Error paths: Are failure scenarios tested?', severity: 'high', triggers: ['error', 'fail', 'exception', 'invalid'] },
      { id: 'qa-scope-4', category: 'test_scope', text: 'Integration points: Are interfaces tested?', severity: 'medium', triggers: ['api', 'interface', 'integration', 'external'] },
    ],
    test_quality: [
      { id: 'qa-qual-1', category: 'test_quality', text: 'Isolation: Are tests independent (no shared state)?', severity: 'high', triggers: ['test', 'describe', 'it'] },
      { id: 'qa-qual-2', category: 'test_quality', text: 'Determinism: Do tests pass consistently (no flakiness)?', severity: 'high', triggers: ['flaky', 'random', 'timeout', 'intermittent'] },
      { id: 'qa-qual-3', category: 'test_quality', text: 'Speed: Are tests fast enough for CI feedback loop?', severity: 'medium', triggers: ['slow', 'timeout', 'performance'] },
      { id: 'qa-qual-4', category: 'test_quality', text: 'Readability: Can failures be diagnosed quickly?', severity: 'medium', triggers: ['message', 'assert', 'expect'] },
    ],
    regression: [
      { id: 'qa-reg-1', category: 'regression', text: 'Existing tests: Do all existing tests still pass?', severity: 'critical', triggers: ['change', 'modify', 'update'] },
      { id: 'qa-reg-2', category: 'regression', text: 'Coverage: Has test coverage decreased?', severity: 'high', triggers: ['coverage', 'uncovered', 'gap'] },
      { id: 'qa-reg-3', category: 'regression', text: 'Breaking changes: Are APIs backward compatible?', severity: 'high', triggers: ['api', 'interface', 'contract', 'public'] },
      { id: 'qa-reg-4', category: 'regression', text: 'Performance: Has latency/memory regressed?', severity: 'medium', triggers: ['performance', 'latency', 'memory', 'slow'] },
    ],
    validation: [
      { id: 'qa-val-1', category: 'validation', text: 'Reproducibility: Can the bug/behavior be reproduced?', severity: 'high', triggers: ['bug', 'issue', 'reproduce'] },
      { id: 'qa-val-2', category: 'validation', text: 'Root cause: Is the fix addressing the root cause?', severity: 'high', triggers: ['fix', 'patch', 'resolve'] },
      { id: 'qa-val-3', category: 'validation', text: 'Side effects: Are there unintended changes?', severity: 'medium', triggers: ['change', 'affect', 'impact'] },
      { id: 'qa-val-4', category: 'validation', text: 'Documentation: Are test changes documented?', severity: 'low', triggers: ['doc', 'comment', 'readme'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Quality

Before finalizing, verify each applicable item:

**Test Scope** (HIGH)
- [ ] Requirements: All requirements covered?
- [ ] Edge cases: Boundary conditions tested?
- [ ] Error paths: Failure scenarios tested?
- [ ] Integration points: Interfaces tested?

**Test Quality** (HIGH)
- [ ] Isolation: Tests independent (no shared state)?
- [ ] Determinism: Tests pass consistently?
- [ ] Speed: Fast enough for CI?
- [ ] Readability: Failures diagnosable?

**Regression** (CRITICAL)
- [ ] Existing tests: All still pass?
- [ ] Coverage: Not decreased?
- [ ] Breaking changes: APIs compatible?
- [ ] Performance: No regression?

**Validation** (HIGH)
- [ ] Reproducibility: Bug reproducible?
- [ ] Root cause: Fix addresses cause?
- [ ] Side effects: No unintended changes?
- [ ] Documentation: Changes documented?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Architecture Checklist
 */
const ARCHITECTURE_CHECKLIST: RoleChecklist = {
  id: 'architecture',
  name: 'Architecture Checklist',
  role: 'Software Architect',
  categories: {
    design: [
      { id: 'arch-des-1', category: 'design', text: 'Requirements alignment: Does it solve the right problem?', severity: 'critical', triggers: ['design', 'architecture', 'system'] },
      { id: 'arch-des-2', category: 'design', text: 'Simplicity: Is this the simplest viable solution?', severity: 'high', triggers: ['complex', 'simple', 'pattern'] },
      { id: 'arch-des-3', category: 'design', text: 'Extensibility: Can it evolve with future needs?', severity: 'medium', triggers: ['future', 'extend', 'scale'] },
      { id: 'arch-des-4', category: 'design', text: 'Consistency: Does it follow existing patterns?', severity: 'high', triggers: ['pattern', 'convention', 'style'] },
    ],
    trade_offs: [
      { id: 'arch-trade-1', category: 'trade_offs', text: 'Performance vs. complexity trade-off documented?', severity: 'high', triggers: ['performance', 'complexity', 'trade'] },
      { id: 'arch-trade-2', category: 'trade_offs', text: 'Build vs. buy decision documented?', severity: 'medium', triggers: ['build', 'buy', 'library', 'vendor'] },
      { id: 'arch-trade-3', category: 'trade_offs', text: 'Technology choices justified?', severity: 'high', triggers: ['technology', 'framework', 'language'] },
      { id: 'arch-trade-4', category: 'trade_offs', text: 'Rejected alternatives documented?', severity: 'medium', triggers: ['alternative', 'option', 'consider'] },
    ],
    risk: [
      { id: 'arch-risk-1', category: 'risk', text: 'Single points of failure identified?', severity: 'critical', triggers: ['single', 'failure', 'dependency'] },
      { id: 'arch-risk-2', category: 'risk', text: 'Scalability bottlenecks identified?', severity: 'high', triggers: ['scale', 'bottleneck', 'limit'] },
      { id: 'arch-risk-3', category: 'risk', text: 'Security implications considered?', severity: 'critical', triggers: ['security', 'auth', 'data'] },
      { id: 'arch-risk-4', category: 'risk', text: 'Operational complexity acceptable?', severity: 'medium', triggers: ['ops', 'deploy', 'maintain'] },
    ],
    governance: [
      { id: 'arch-gov-1', category: 'governance', text: 'ADR created for significant decisions?', severity: 'high', triggers: ['decision', 'adr', 'architecture'] },
      { id: 'arch-gov-2', category: 'governance', text: 'Stakeholders consulted?', severity: 'medium', triggers: ['stakeholder', 'team', 'review'] },
      { id: 'arch-gov-3', category: 'governance', text: 'Migration path defined?', severity: 'high', triggers: ['migrate', 'transition', 'phase'] },
      { id: 'arch-gov-4', category: 'governance', text: 'Rollback strategy exists?', severity: 'high', triggers: ['rollback', 'revert', 'undo'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Architecture

Before finalizing, verify each applicable item:

**Design** (CRITICAL-HIGH)
- [ ] Requirements alignment: Solves the right problem?
- [ ] Simplicity: Simplest viable solution?
- [ ] Extensibility: Can evolve with future needs?
- [ ] Consistency: Follows existing patterns?

**Trade-offs** (HIGH)
- [ ] Performance vs. complexity documented?
- [ ] Build vs. buy decision documented?
- [ ] Technology choices justified?
- [ ] Rejected alternatives documented?

**Risk** (CRITICAL)
- [ ] Single points of failure identified?
- [ ] Scalability bottlenecks identified?
- [ ] Security implications considered?
- [ ] Operational complexity acceptable?

**Governance** (HIGH)
- [ ] ADR created for significant decisions?
- [ ] Stakeholders consulted?
- [ ] Migration path defined?
- [ ] Rollback strategy exists?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * DevOps Checklist
 */
const DEVOPS_CHECKLIST: RoleChecklist = {
  id: 'devops',
  name: 'DevOps Checklist',
  role: 'DevOps Engineer',
  categories: {
    deployment: [
      { id: 'devops-dep-1', category: 'deployment', text: 'Zero-downtime: Can deploy without service interruption?', severity: 'high', triggers: ['deploy', 'release', 'rollout'] },
      { id: 'devops-dep-2', category: 'deployment', text: 'Rollback: Can quickly revert if issues arise?', severity: 'critical', triggers: ['rollback', 'revert', 'fail'] },
      { id: 'devops-dep-3', category: 'deployment', text: 'Configuration: Env-specific configs separated from code?', severity: 'high', triggers: ['config', 'env', 'environment'] },
      { id: 'devops-dep-4', category: 'deployment', text: 'Secrets: Managed securely (not in code/config)?', severity: 'critical', triggers: ['secret', 'key', 'credential'] },
    ],
    infrastructure: [
      { id: 'devops-infra-1', category: 'infrastructure', text: 'IaC: Infrastructure defined as code?', severity: 'high', triggers: ['infrastructure', 'terraform', 'kubernetes'] },
      { id: 'devops-infra-2', category: 'infrastructure', text: 'Scaling: Auto-scaling configured correctly?', severity: 'high', triggers: ['scale', 'auto', 'capacity'] },
      { id: 'devops-infra-3', category: 'infrastructure', text: 'Resources: CPU/memory limits appropriate?', severity: 'medium', triggers: ['resource', 'memory', 'cpu', 'limit'] },
      { id: 'devops-infra-4', category: 'infrastructure', text: 'Networking: Security groups and firewalls configured?', severity: 'high', triggers: ['network', 'firewall', 'security group'] },
    ],
    observability: [
      { id: 'devops-obs-1', category: 'observability', text: 'Logging: Structured logs with correlation IDs?', severity: 'high', triggers: ['log', 'logging', 'trace'] },
      { id: 'devops-obs-2', category: 'observability', text: 'Metrics: Key metrics exposed and collected?', severity: 'high', triggers: ['metric', 'prometheus', 'grafana'] },
      { id: 'devops-obs-3', category: 'observability', text: 'Alerting: Alerts configured for critical conditions?', severity: 'high', triggers: ['alert', 'notify', 'oncall'] },
      { id: 'devops-obs-4', category: 'observability', text: 'Dashboards: Visibility into system health?', severity: 'medium', triggers: ['dashboard', 'monitor', 'visualize'] },
    ],
    reliability: [
      { id: 'devops-rel-1', category: 'reliability', text: 'Health checks: Liveness and readiness probes configured?', severity: 'high', triggers: ['health', 'probe', 'check'] },
      { id: 'devops-rel-2', category: 'reliability', text: 'Disaster recovery: Backup and restore tested?', severity: 'critical', triggers: ['backup', 'restore', 'disaster'] },
      { id: 'devops-rel-3', category: 'reliability', text: 'Failover: Multi-region/AZ redundancy?', severity: 'high', triggers: ['failover', 'redundancy', 'region', 'availability'] },
      { id: 'devops-rel-4', category: 'reliability', text: 'Runbooks: Incident response procedures documented?', severity: 'medium', triggers: ['runbook', 'incident', 'procedure'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: DevOps

Before finalizing, verify each applicable item:

**Deployment** (CRITICAL-HIGH)
- [ ] Zero-downtime: Deploy without interruption?
- [ ] Rollback: Can quickly revert?
- [ ] Configuration: Env-specific configs separated?
- [ ] Secrets: Managed securely?

**Infrastructure** (HIGH)
- [ ] IaC: Infrastructure as code?
- [ ] Scaling: Auto-scaling configured?
- [ ] Resources: CPU/memory limits appropriate?
- [ ] Networking: Security groups configured?

**Observability** (HIGH)
- [ ] Logging: Structured with correlation IDs?
- [ ] Metrics: Key metrics collected?
- [ ] Alerting: Critical alerts configured?
- [ ] Dashboards: System health visible?

**Reliability** (CRITICAL-HIGH)
- [ ] Health checks: Probes configured?
- [ ] Disaster recovery: Backup/restore tested?
- [ ] Failover: Multi-region redundancy?
- [ ] Runbooks: Incident procedures documented?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Data Engineer Checklist
 */
const DATA_CHECKLIST: RoleChecklist = {
  id: 'data',
  name: 'Data Checklist',
  role: 'Data Engineer',
  categories: {
    data_quality: [
      { id: 'data-qual-1', category: 'data_quality', text: 'Schema validation: Data conforms to expected schema?', severity: 'high', triggers: ['schema', 'type', 'validate'] },
      { id: 'data-qual-2', category: 'data_quality', text: 'Null handling: Missing values handled appropriately?', severity: 'high', triggers: ['null', 'missing', 'empty'] },
      { id: 'data-qual-3', category: 'data_quality', text: 'Duplicates: Deduplication strategy in place?', severity: 'medium', triggers: ['duplicate', 'unique', 'distinct'] },
      { id: 'data-qual-4', category: 'data_quality', text: 'Freshness: Data SLAs defined and monitored?', severity: 'medium', triggers: ['fresh', 'stale', 'latency', 'sla'] },
    ],
    pipeline: [
      { id: 'data-pipe-1', category: 'pipeline', text: 'Idempotency: Pipeline can be safely re-run?', severity: 'high', triggers: ['pipeline', 'etl', 'process'] },
      { id: 'data-pipe-2', category: 'pipeline', text: 'Error handling: Failed records captured for review?', severity: 'high', triggers: ['error', 'fail', 'dead letter'] },
      { id: 'data-pipe-3', category: 'pipeline', text: 'Backfill: Historical data can be reprocessed?', severity: 'medium', triggers: ['backfill', 'historical', 'reprocess'] },
      { id: 'data-pipe-4', category: 'pipeline', text: 'Monitoring: Pipeline health and progress visible?', severity: 'high', triggers: ['monitor', 'alert', 'status'] },
    ],
    governance: [
      { id: 'data-gov-1', category: 'governance', text: 'Lineage: Data origin and transformations documented?', severity: 'medium', triggers: ['lineage', 'origin', 'source'] },
      { id: 'data-gov-2', category: 'governance', text: 'Privacy: PII identified and protected?', severity: 'critical', triggers: ['pii', 'privacy', 'gdpr', 'personal'] },
      { id: 'data-gov-3', category: 'governance', text: 'Retention: Data lifecycle and deletion policies?', severity: 'high', triggers: ['retention', 'delete', 'archive'] },
      { id: 'data-gov-4', category: 'governance', text: 'Access control: Data access properly restricted?', severity: 'high', triggers: ['access', 'permission', 'role'] },
    ],
    performance: [
      { id: 'data-perf-1', category: 'performance', text: 'Partitioning: Data partitioned for query efficiency?', severity: 'high', triggers: ['partition', 'query', 'large'] },
      { id: 'data-perf-2', category: 'performance', text: 'Indexing: Appropriate indexes for access patterns?', severity: 'high', triggers: ['index', 'search', 'filter'] },
      { id: 'data-perf-3', category: 'performance', text: 'Compression: Storage optimized with compression?', severity: 'medium', triggers: ['compress', 'storage', 'size'] },
      { id: 'data-perf-4', category: 'performance', text: 'Caching: Frequently accessed data cached?', severity: 'medium', triggers: ['cache', 'frequent', 'hot'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Data

Before finalizing, verify each applicable item:

**Data Quality** (HIGH)
- [ ] Schema validation: Conforms to expected schema?
- [ ] Null handling: Missing values handled?
- [ ] Duplicates: Deduplication in place?
- [ ] Freshness: Data SLAs defined?

**Pipeline** (HIGH)
- [ ] Idempotency: Safe to re-run?
- [ ] Error handling: Failed records captured?
- [ ] Backfill: Historical reprocessing possible?
- [ ] Monitoring: Pipeline health visible?

**Governance** (CRITICAL-HIGH)
- [ ] Lineage: Origin and transforms documented?
- [ ] Privacy: PII identified and protected?
- [ ] Retention: Lifecycle policies defined?
- [ ] Access control: Properly restricted?

**Performance** (HIGH)
- [ ] Partitioning: Query-efficient partitions?
- [ ] Indexing: Appropriate indexes?
- [ ] Compression: Storage optimized?
- [ ] Caching: Hot data cached?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Product Manager Checklist
 */
const PRODUCT_CHECKLIST: RoleChecklist = {
  id: 'product',
  name: 'Product Checklist',
  role: 'Product Manager',
  categories: {
    requirements: [
      { id: 'prod-req-1', category: 'requirements', text: 'User problem: Is the problem clearly defined?', severity: 'critical', triggers: ['user', 'problem', 'pain'] },
      { id: 'prod-req-2', category: 'requirements', text: 'Success criteria: How will we measure success?', severity: 'high', triggers: ['success', 'metric', 'kpi'] },
      { id: 'prod-req-3', category: 'requirements', text: 'Scope: Is scope clearly bounded?', severity: 'high', triggers: ['scope', 'feature', 'requirement'] },
      { id: 'prod-req-4', category: 'requirements', text: 'Acceptance criteria: What defines "done"?', severity: 'high', triggers: ['done', 'accept', 'criteria'] },
    ],
    stakeholders: [
      { id: 'prod-stake-1', category: 'stakeholders', text: 'Alignment: Key stakeholders aligned on approach?', severity: 'high', triggers: ['stakeholder', 'team', 'align'] },
      { id: 'prod-stake-2', category: 'stakeholders', text: 'Dependencies: Cross-team dependencies identified?', severity: 'medium', triggers: ['dependency', 'team', 'coordinate'] },
      { id: 'prod-stake-3', category: 'stakeholders', text: 'Communication: Rollout communication planned?', severity: 'medium', triggers: ['communicate', 'announce', 'rollout'] },
      { id: 'prod-stake-4', category: 'stakeholders', text: 'Feedback: User feedback collection planned?', severity: 'medium', triggers: ['feedback', 'user', 'research'] },
    ],
    delivery: [
      { id: 'prod-del-1', category: 'delivery', text: 'Timeline: Realistic timeline established?', severity: 'high', triggers: ['timeline', 'deadline', 'schedule'] },
      { id: 'prod-del-2', category: 'delivery', text: 'Risks: Key risks identified and mitigated?', severity: 'high', triggers: ['risk', 'blocker', 'issue'] },
      { id: 'prod-del-3', category: 'delivery', text: 'MVP: Minimum viable scope defined?', severity: 'high', triggers: ['mvp', 'minimum', 'viable'] },
      { id: 'prod-del-4', category: 'delivery', text: 'Rollback: Can we undo if issues arise?', severity: 'medium', triggers: ['rollback', 'undo', 'revert'] },
    ],
  },
  template: `## DOMAIN CHECKLIST: Product

Before finalizing, verify each applicable item:

**Requirements** (CRITICAL-HIGH)
- [ ] User problem: Problem clearly defined?
- [ ] Success criteria: How measured?
- [ ] Scope: Clearly bounded?
- [ ] Acceptance criteria: What defines "done"?

**Stakeholders** (HIGH-MEDIUM)
- [ ] Alignment: Key stakeholders aligned?
- [ ] Dependencies: Cross-team deps identified?
- [ ] Communication: Rollout planned?
- [ ] Feedback: Collection planned?

**Delivery** (HIGH)
- [ ] Timeline: Realistic?
- [ ] Risks: Identified and mitigated?
- [ ] MVP: Minimum scope defined?
- [ ] Rollback: Can undo if needed?

Mark items as [x] when verified, or note [N/A] if not applicable.
Flag any concerns with [RISK].
`,
};

/**
 * Empty checklist for agents that don't need domain-specific checks
 */
const NONE_CHECKLIST: RoleChecklist = {
  id: 'none',
  name: 'No Checklist',
  role: 'General',
  categories: {},
  template: '',
};

/**
 * All available checklists
 */
const CHECKLISTS: Record<RoleChecklistType, RoleChecklist> = {
  backend: BACKEND_CHECKLIST,
  frontend: FRONTEND_CHECKLIST,
  security: SECURITY_CHECKLIST,
  quality: QUALITY_CHECKLIST,
  architecture: ARCHITECTURE_CHECKLIST,
  devops: DEVOPS_CHECKLIST,
  data: DATA_CHECKLIST,
  product: PRODUCT_CHECKLIST,
  none: NONE_CHECKLIST,
};

/**
 * Get a checklist by type
 */
export function getRoleChecklist(type: RoleChecklistType): RoleChecklist {
  const checklist = CHECKLISTS[type];
  if (!checklist) {
    throw new Error(`Unknown checklist type: ${type}`);
  }
  return checklist;
}

/**
 * Get the formatted template for a checklist
 */
export function getChecklistTemplate(type: RoleChecklistType): string {
  return getRoleChecklist(type).template;
}

/**
 * Get all available checklist types
 */
export function getAvailableChecklists(): RoleChecklistType[] {
  return Object.keys(CHECKLISTS) as RoleChecklistType[];
}

/**
 * Apply overrides to a checklist template
 */
export function applyChecklistOverrides(
  type: RoleChecklistType,
  overrides: { add?: string[]; remove?: string[] }
): string {
  let template = getChecklistTemplate(type);

  // Remove specified items (by partial match)
  if (overrides.remove && overrides.remove.length > 0) {
    for (const item of overrides.remove) {
      const regex = new RegExp(`^- \\[ \\] .*${item}.*$`, 'gm');
      template = template.replace(regex, '');
    }
    // Clean up empty lines
    template = template.replace(/\n\n+/g, '\n\n');
  }

  // Add specified items at the end of relevant category or as custom section
  if (overrides.add && overrides.add.length > 0) {
    const customSection = `\n**Custom Checks**\n${overrides.add.map(item => `- [ ] ${item}`).join('\n')}\n`;
    template = template.replace(/Mark items as \[x\]/, customSection + '\nMark items as [x]');
  }

  return template;
}

/**
 * Get checklist items relevant to a task based on triggers
 */
export function getRelevantChecklistItems(
  type: RoleChecklistType,
  taskDescription: string
): ChecklistItem[] {
  const checklist = getRoleChecklist(type);
  const lowerTask = taskDescription.toLowerCase();
  const relevant: ChecklistItem[] = [];

  for (const category of Object.values(checklist.categories)) {
    for (const item of category) {
      // Always include critical items
      if (item.severity === 'critical') {
        relevant.push(item);
        continue;
      }

      // Check triggers
      if (item.triggers) {
        for (const trigger of item.triggers) {
          if (lowerTask.includes(trigger.toLowerCase())) {
            relevant.push(item);
            break;
          }
        }
      }
    }
  }

  return relevant;
}

export const RoleChecklists = {
  get: getRoleChecklist,
  getTemplate: getChecklistTemplate,
  getAvailable: getAvailableChecklists,
  applyOverrides: applyChecklistOverrides,
  getRelevant: getRelevantChecklistItems,
  BACKEND: BACKEND_CHECKLIST,
  FRONTEND: FRONTEND_CHECKLIST,
  SECURITY: SECURITY_CHECKLIST,
  QUALITY: QUALITY_CHECKLIST,
  ARCHITECTURE: ARCHITECTURE_CHECKLIST,
  DEVOPS: DEVOPS_CHECKLIST,
  DATA: DATA_CHECKLIST,
  PRODUCT: PRODUCT_CHECKLIST,
};

export default RoleChecklists;
