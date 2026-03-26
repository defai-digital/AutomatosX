export type StableWorkflowCommandId = 'ship' | 'architect' | 'audit' | 'qa' | 'release';
export type StableWorkflowRequiredInputMode = 'all' | 'any';

export interface StableWorkflowCatalogEntry {
  commandId: StableWorkflowCommandId;
  workflowId: string;
  workflowName: string;
  version: string;
  description: string;
  usage: string[];
  agentId: string;
  stages: string[];
  artifactNames: string[];
  requiredInputs: string[];
  requiredInputMode: StableWorkflowRequiredInputMode;
  optionalInputs: string[];
  positionalArgumentName: string;
  whenToUse: string[];
  avoidWhen: string[];
  examples: string[];
}

const STABLE_WORKFLOW_CATALOG: readonly StableWorkflowCatalogEntry[] = [
  {
    commandId: 'ship',
    workflowId: 'ship',
    workflowName: 'ax ship',
    version: 'v0',
    description: 'Prepare a change for ship readiness with review findings, test posture, risk notes, and a PR-ready summary.',
    usage: [
      'ax ship --scope <area>',
      'ax ship <scope> --dry-run',
    ],
    agentId: 'quality',
    stages: [
      'Inspect scope and current implementation context',
      'Review quality and risk posture',
      'Summarize test status or recommended test plan',
      'Produce PR-ready summary artifacts',
    ],
    artifactNames: ['review summary', 'test summary or test plan', 'risk notes', 'PR draft summary'],
    requiredInputs: ['scope'],
    requiredInputMode: 'all',
    optionalInputs: ['issue', 'policy', 'branch'],
    positionalArgumentName: 'scope',
    whenToUse: [
      'A change is close to merge and needs a structured quality and risk pass.',
      'You need a concise ship summary with test posture and follow-up actions.',
      'You want a dry-run artifact pack before final review or PR creation.',
    ],
    avoidWhen: [
      'You still need system design or ADR work before implementation is settled.',
      'You are investigating a specific regression and need bug triage instead of ship readiness.',
    ],
    examples: [
      'ax ship --scope checkout',
      'ax ship checkout --issue AX-123 --dry-run',
      'ax ship --scope packages/cli --policy strict',
    ],
  },
  {
    commandId: 'architect',
    workflowId: 'architect',
    workflowName: 'ax architect',
    version: 'v0',
    description: 'Turn a requirement into an implementation-ready architecture proposal with ADR, phased plan, and risks.',
    usage: [
      'ax architect --request "<requirement>"',
      'ax architect "<requirement>" --dry-run',
    ],
    agentId: 'architect',
    stages: [
      'Interpret requirements and constraints',
      'Develop architecture proposal',
      'Draft ADR and phased implementation plan',
      'Summarize risks and tradeoffs',
    ],
    artifactNames: ['architecture proposal', 'ADR draft', 'phased implementation plan', 'risk matrix'],
    requiredInputs: ['request', 'input'],
    requiredInputMode: 'any',
    optionalInputs: ['timeline', 'constraints'],
    positionalArgumentName: 'request',
    whenToUse: [
      'You need a technical direction before implementation begins.',
      'You want explicit tradeoffs, ADR material, or a phased delivery plan.',
      'A change crosses multiple services, teams, or system boundaries.',
    ],
    avoidWhen: [
      'The task is a narrow defect fix or regression investigation.',
      'You only need release notes or rollout messaging.',
    ],
    examples: [
      'ax architect --request "Design tenant-isolated billing"',
      'ax architect "Migrate monitor to modular services" --dry-run',
      'ax architect --request "Add SSO for enterprise customers" --constraints "no schema rewrite"',
    ],
  },
  {
    commandId: 'audit',
    workflowId: 'audit',
    workflowName: 'ax audit',
    version: 'v0',
    description: 'Audit a repository or subsystem for design drift, risk, bottlenecks, and remediation priorities.',
    usage: [
      'ax audit --scope <path-or-area>',
    ],
    agentId: 'quality',
    stages: [
      'Inspect repository or selected scope',
      'Analyze risks, bottlenecks, and quality gaps',
      'Rank issues by severity',
      'Produce remediation guidance',
    ],
    artifactNames: ['audit report', 'severity ranking', 'bottleneck list', 'remediation plan'],
    requiredInputs: ['scope'],
    requiredInputMode: 'all',
    optionalInputs: ['repo', 'depth'],
    positionalArgumentName: 'scope',
    whenToUse: [
      'You need a ranked review of design, quality, or operational issues.',
      'You want a remediation plan for a subsystem, repo, or release area.',
      'A team needs a fast architectural and quality snapshot before planning work.',
    ],
    avoidWhen: [
      'You are validating end-user behavior against scenarios and should run QA instead.',
      'You need a release summary rather than a risk audit.',
    ],
    examples: [
      'ax audit --scope packages/cli',
      'ax audit --repo . --depth deep',
      'ax audit --scope src/runtime --provider claude',
    ],
  },
  {
    commandId: 'qa',
    workflowId: 'qa',
    workflowName: 'ax qa',
    version: 'v0',
    description: 'Validate user-facing behavior, capture pass or fail outcomes, and document reproducible defects.',
    usage: [
      'ax qa --target <service-or-feature> --url <url>',
    ],
    agentId: 'quality',
    stages: [
      'Interpret target and expected scenarios',
      'Validate user-facing behavior',
      'Capture pass/fail outcomes and defects',
      'Summarize reproduction steps and follow-up actions',
    ],
    artifactNames: ['pass/fail report', 'scenario summary', 'defect summary', 'reproduction steps'],
    requiredInputs: ['target', 'url'],
    requiredInputMode: 'all',
    optionalInputs: ['scenario'],
    positionalArgumentName: 'target',
    whenToUse: [
      'You need scenario-based validation of a feature, service, or environment.',
      'You want pass or fail outcomes with reproduction steps for defects.',
      'A workflow or release candidate needs a user-facing validation pass.',
    ],
    avoidWhen: [
      'You only need a code audit without user-facing scenario execution.',
      'You are producing ADRs or implementation plans.',
    ],
    examples: [
      'ax qa --target checkout --url https://localhost:3000',
      'ax qa --target monitor --scenario "empty state, detail refresh, copy actions"',
      'ax qa --target billing --url https://staging.example.com --dry-run',
    ],
  },
  {
    commandId: 'release',
    workflowId: 'release',
    workflowName: 'ax release',
    version: 'v0',
    description: 'Prepare release notes, changelog, upgrade guidance, and deployment follow-up artifacts.',
    usage: [
      'ax release --release-version <version>',
    ],
    agentId: 'release-manager',
    stages: [
      'Inspect target version and release scope',
      'Summarize merged work and release highlights',
      'Draft release artifacts and upgrade guidance',
      'Produce deployment and docs follow-up checklist',
    ],
    artifactNames: ['changelog draft', 'release notes', 'upgrade notes', 'deployment checklist'],
    requiredInputs: ['releaseVersion'],
    requiredInputMode: 'all',
    optionalInputs: ['commits', 'target'],
    positionalArgumentName: 'releaseVersion',
    whenToUse: [
      'You need a structured release packet for a version, environment, or milestone.',
      'You want changelog, upgrade notes, and deployment follow-ups in one pass.',
      'A release manager needs a draft before final human editing.',
    ],
    avoidWhen: [
      'You are still deciding the technical design or implementation plan.',
      'You need code-level debugging or QA execution.',
    ],
    examples: [
      'ax release --release-version 14.0.1',
      'ax release --release-version 14.1.0 --target production',
      'ax release --release-version 14.0.1 --commits "abc123..def456"',
    ],
  },
] as const;

const STABLE_WORKFLOW_CATALOG_BY_ID = new Map(
  STABLE_WORKFLOW_CATALOG.map((entry) => [entry.commandId, entry] as const),
);

export function listWorkflowCatalog(): StableWorkflowCatalogEntry[] {
  return STABLE_WORKFLOW_CATALOG.map(cloneCatalogEntry);
}

export function getWorkflowCatalogEntry(workflowId: string): StableWorkflowCatalogEntry | undefined {
  const byCommandId = STABLE_WORKFLOW_CATALOG_BY_ID.get(workflowId as StableWorkflowCommandId);
  if (byCommandId !== undefined) {
    return cloneCatalogEntry(byCommandId);
  }

  const byWorkflowId = STABLE_WORKFLOW_CATALOG.find((entry) => entry.workflowId === workflowId);
  return byWorkflowId === undefined ? undefined : cloneCatalogEntry(byWorkflowId);
}

export function formatWorkflowInputSummary(
  inputs: string[],
  mode: StableWorkflowRequiredInputMode,
): string {
  if (inputs.length === 0) {
    return 'none';
  }

  const separator = mode === 'all' ? ' and ' : ' or ';
  return inputs.join(separator);
}

function cloneCatalogEntry(entry: StableWorkflowCatalogEntry): StableWorkflowCatalogEntry {
  return {
    commandId: entry.commandId,
    workflowId: entry.workflowId,
    workflowName: entry.workflowName,
    version: entry.version,
    description: entry.description,
    usage: [...entry.usage],
    agentId: entry.agentId,
    stages: [...entry.stages],
    artifactNames: [...entry.artifactNames],
    requiredInputs: [...entry.requiredInputs],
    requiredInputMode: entry.requiredInputMode,
    optionalInputs: [...entry.optionalInputs],
    positionalArgumentName: entry.positionalArgumentName,
    whenToUse: [...entry.whenToUse],
    avoidWhen: [...entry.avoidWhen],
    examples: [...entry.examples],
  };
}
