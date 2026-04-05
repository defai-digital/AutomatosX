import { mkdirSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterEach, describe, expect, it } from 'vitest';
import { RuntimeGovernanceAggregateSchema } from '@defai.digital/shared-runtime/governance';
import {
  buildDashboardHtml,
  createMonitorApiResponse,
  escapeHtml,
  getMonitorPath,
  parseMonitorArgs,
  readCachedProviderSnapshot,
  resolveMonitorConfig,
} from '../src/commands/monitor.js';
import type { MonitorApiState } from '../src/commands/monitor.js';

function createTempDir(): string {
  const dir = join(process.cwd(), '.tmp', `monitor-command-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createMonitorState(): MonitorApiState {
  return {
    status: {
      sessions: { total: 6, active: 1, completed: 2, failed: 3 },
      traces: { total: 9, running: 2, completed: 5, failed: 2 },
      runtime: {
        defaultProvider: 'claude',
        providerExecutionMode: 'simulate',
        configuredExecutors: ['claude', 'gemini'],
      },
      activeSessions: [],
      runningTraces: [],
      recentFailedTraces: [],
    },
    governance: {
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    },
    deniedInstalledBridges: {
      deniedCount: 0,
    },
    sessions: [{
      sessionId: 'session-1',
      task: 'release task',
      initiator: 'cli',
      status: 'active',
      participants: [],
      createdAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z',
    }],
    traces: [{
      traceId: 'trace-1',
      workflowId: 'ship',
      surface: 'cli',
      status: 'running',
      startedAt: '2026-03-24T12:00:00.000Z',
      stepResults: [],
    }],
    agents: [{
      agentId: 'architect',
      name: 'Architect',
      capabilities: [],
      metadata: {
        description: 'Turns requirements into architecture proposals.',
        team: 'core',
        ownedWorkflows: ['architect'],
        recommendedCommands: ['ax architect --request "Design auth"'],
        useCases: ['cross-cutting system design'],
        notFor: ['narrow bug triage'],
      },
      registrationKey: 'architect',
      registeredAt: '2026-03-24T12:00:00.000Z',
      updatedAt: '2026-03-24T12:00:00.000Z',
    }],
    workflows: [{
      workflowId: 'ship',
      name: 'Ship Workflow',
      version: '1.0.0',
      steps: 3,
      description: 'Prepare a change for ship readiness.',
      agentId: 'quality',
      artifactNames: ['review summary', 'risk notes'],
      requiredInputs: ['scope'],
      optionalInputs: ['issue'],
      whenToUse: ['A change is close to merge.'],
      avoidWhen: ['You still need architecture work.'],
      stages: ['Inspect scope', 'Summarize findings'],
    }],
    providers: {
      source: 'cached',
      generatedAt: '2026-03-24T12:00:00.000Z',
      detectedProviders: ['claude'],
      enabledProviders: ['claude'],
      installedButDisabledProviders: [],
      configuredButUnavailableProviders: [],
    },
  };
}

function extractDashboardScript(html: string): string {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (match === null || match[1] === undefined) {
    throw new Error('Dashboard script block not found');
  }
  return match[1];
}

function executeDashboardScript(
  html: string,
  overrides: Record<string, unknown> = {},
): Record<string, any> {
  const script = extractDashboardScript(html);
  const tabsNode: Record<string, any> = {
    style: { display: '' },
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    dataset: {},
  };
  const appNode: Record<string, any> = {
    innerHTML: '',
    addEventListener: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    dataset: {},
    style: {},
  };
  const toastNode: Record<string, any> = {
    textContent: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    style: {},
    dataset: {},
  };
  const copyNode: Record<string, any> = {
    textContent: '⎘ Copy ID',
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    style: {},
    dataset: {},
  };
  const genericNode = (): Record<string, any> => ({
    innerHTML: '',
    textContent: '',
    style: {},
    dataset: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    addEventListener: () => {},
  });
  const refreshButtonNode = genericNode();
  const liveDotNode = genericNode();
  const liveLabelNode = genericNode();
  const lastUpdatedNode = genericNode();

  const documentStub: Record<string, any> = {
    body: {
      appendChild: () => {},
      removeChild: () => {},
    },
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => ({
      value: '',
      style: {},
      dataset: {},
      setAttribute: () => {},
      focus: () => {},
      select: () => {},
      click: () => {},
      remove: () => {},
    }),
    execCommand: () => false,
    getElementById: (id: string) => {
      if (id === 'tabs') return tabsNode;
      if (id === 'app') return appNode;
      if (id === 'toast') return toastNode;
      if (id === 'copy-btn') return copyNode;
      if (id === 'refresh-btn') return refreshButtonNode;
      if (id === 'live-dot') return liveDotNode;
      if (id === 'live-label-text') return liveLabelNode;
      if (id === 'last-updated-rel') return lastUpdatedNode;
      return genericNode();
    },
  };

  const context: Record<string, any> = {
    document: documentStub,
    window: { addEventListener: () => {} },
    location: { hash: '' },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    fetch: async () => ({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    }),
    Blob: class {
      constructor(public readonly parts: unknown[], public readonly options: Record<string, unknown>) {}
    },
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: () => {},
    },
    HTMLElement: class {},
    HTMLInputElement: class {},
    HTMLSelectElement: class {},
    setTimeout: (fn: (...args: unknown[]) => void) => {
      fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: () => 1,
    clearInterval: () => {},
    console,
    ...overrides,
  };

  try {
    runInNewContext(script, context);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`${error.stack ?? error.message}\n--- Dashboard Script ---\n${script}`);
    }
    throw error;
  }
  return context;
}

describe('monitor command helpers', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((tempDir) => rm(tempDir, { recursive: true, force: true })));
  });

  it('escapes raw dashboard state before embedding it in html', () => {
    const state = createMonitorState();
    const html = buildDashboardHtml({
      ...state,
      sessions: [{ sessionId: '&lt;img src=x onerror=alert(1)&gt;' }],
      traces: [],
      agents: [],
      workflows: [],
      providers: {
        ...state.providers,
        generatedAt: '2026-03-24T00:00:00.000Z',
      },
    });

    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(html).toContain('\\u0026lt;img src=x onerror=alert(1)\\u0026gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain("fetch('/api/state'");
    expect(html).toContain('Overview');
    expect(html).toContain('Running Now');
    expect(html).toContain('Provider Usage');
    expect(html).toContain('Search trace id, workflow, provider');
    expect(html).toContain('ax ship --scope checkout');
    expect(html).toContain('ax architect --request \\"Design tenant-isolated billing\\"');
    expect(html).toContain('Refresh in <span id="last-updated-rel">10s</span>');
    expect(html).toContain('>Runs<');
    expect(html).not.toContain('data-tab="traces"');
    expect(html).toContain('onclick="openTrace(this.dataset.traceId)"');
    expect(html).toContain('onclick="openSession(this.dataset.sessionId)"');
    expect(html).toContain('onclick="openAgent(this.dataset.agentId)"');
    expect(html).toContain('onclick="openWorkflow(this.dataset.workflowId)"');
    expect(html).toContain('onclick="openProvider(this.dataset.providerId)"');
    expect(html).toContain('onclick="copyTraceId(this.dataset.traceId)"');
    expect(html).toContain('onclick="exportTrace(this.dataset.traceId)"');
    expect(html).toContain('onclick="switchTab(this.dataset.tab)"');
    expect(html).toContain('onclick="setActivityFilter(this.dataset.filterValue)"');
    expect(html).not.toMatch(/onclick="[^"]*JSON\.stringify/);
  });

  it('shows a refresh countdown and maps legacy traces tab routes into activity', () => {
    const context = executeDashboardScript(buildDashboardHtml(createMonitorState()));
    context.updateHeaderClock();

    expect(context.document.getElementById('last-updated-rel').textContent).toMatch(/^\d+s$/);
    expect(String(context.document.getElementById('last-updated-rel').textContent)).not.toContain('ago');
    expect(context.normalizeTab('traces')).toBe('activity');
  });

  it('renders configured-but-unavailable providers as not installed instead of enabled', () => {
    const state = createMonitorState();
    state.providers.enabledProviders = ['claude'];
    state.providers.detectedProviders = ['claude'];
    state.providers.configuredButUnavailableProviders = ['cursor'];

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('providers');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('cursor');
    expect(html).toContain('not installed');
    expect(html).not.toContain('cursor <span class="trace-id-short">(default)</span>');
  });

  it('paginates runs in the activity tab and keeps page navigation client-side', () => {
    const state = createMonitorState();
    const now = Date.now();
    state.traces = Array.from({ length: 30 }, (_, index) => ({
      traceId: `trace-${String(index + 1).padStart(3, '0')}`,
      workflowId: `workflow-${String(index + 1).padStart(2, '0')}`,
      surface: 'cli',
      status: index === 0 ? 'running' : 'completed',
      startedAt: new Date(now - (index * 1000)).toISOString(),
      stepResults: [],
    }));

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('activity');

    expect(context.document.getElementById('app').innerHTML).toContain('Showing 1-25 of 30 runs');
    expect(context.document.getElementById('app').innerHTML).toContain('Page 1 of 2');
    expect(context.document.getElementById('app').innerHTML).toContain('data-trace-id="trace-001"');
    expect(context.document.getElementById('app').innerHTML).not.toContain('data-trace-id="trace-026"');

    context.setActivityPage('2');

    expect(context.document.getElementById('app').innerHTML).toContain('Showing 26-30 of 30 runs');
    expect(context.document.getElementById('app').innerHTML).toContain('Page 2 of 2');
    expect(context.document.getElementById('app').innerHTML).toContain('data-trace-id="trace-026"');
    expect(context.document.getElementById('app').innerHTML).not.toContain('data-trace-id="trace-001"');

    context.setActivitySearch('workflow-30');

    expect(context.document.getElementById('app').innerHTML).toContain('data-trace-id="trace-030"');
    expect(context.document.getElementById('app').innerHTML).not.toContain('Page 2 of 2');
  });

  it('hides future-dated traces from the activity time window', () => {
    const state = createMonitorState();
    const now = Date.now();
    state.traces = [
      {
        traceId: 'trace-future',
        workflowId: 'workflow-future',
        surface: 'cli',
        status: 'completed',
        // One day in the future — clock skew / bad fixture / malicious input.
        startedAt: new Date(now + 86_400_000).toISOString(),
        stepResults: [],
      },
      {
        traceId: 'trace-recent',
        workflowId: 'workflow-recent',
        surface: 'cli',
        status: 'completed',
        startedAt: new Date(now - 60_000).toISOString(),
        stepResults: [],
      },
    ];

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('activity');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('data-trace-id="trace-recent"');
    expect(html).not.toContain('data-trace-id="trace-future"');
    // The workflow dropdown should only list workflows with in-window runs.
    expect(html).toContain('workflow-recent');
    expect(html).not.toContain('>workflow-future<');
  });

  it('shows a filter-aware empty state when all runs are filtered out', () => {
    const state = createMonitorState();
    const now = Date.now();
    state.traces = [{
      traceId: 'trace-visible',
      workflowId: 'workflow-a',
      surface: 'cli',
      status: 'completed',
      startedAt: new Date(now - 60_000).toISOString(),
      stepResults: [],
    }];

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('activity');
    // Narrow the search so nothing matches, forcing the filtered-empty path.
    context.setActivitySearch('zzz-no-such-workflow');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('No runs match the current filters');
    // The first-run onboarding hint must NOT appear — the user clearly has data.
    expect(html).not.toContain('No workflow runs yet');
  });

  it('boots the dashboard even when the url hash is malformed', () => {
    const html = buildDashboardHtml(createMonitorState());
    expect(() => executeDashboardScript(html, {
      location: { hash: '#trace:%E0%A4%A' },
    })).not.toThrow();
  });

  it('falls back to legacy copy behavior when navigator.clipboard is unavailable', () => {
    const html = buildDashboardHtml(createMonitorState());
    let copied = false;
    const context = executeDashboardScript(html, {
      navigator: {},
      document: {
        body: {
          appendChild: () => {},
          removeChild: () => {},
        },
        querySelectorAll: () => [],
        addEventListener: () => {},
        createElement: () => ({
          value: '',
          style: {},
          dataset: {},
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          click: () => {},
          remove: () => {},
        }),
        execCommand: (command: string) => {
          copied = command === 'copy';
          return copied;
        },
        getElementById: (id: string) => {
          if (id === 'tabs') {
            return {
              style: { display: '' },
              addEventListener: () => {},
              classList: { add: () => {}, remove: () => {}, toggle: () => false },
              dataset: {},
            };
          }
          if (id === 'app') {
            return {
              innerHTML: '',
              addEventListener: () => {},
              classList: { add: () => {}, remove: () => {}, toggle: () => false },
              dataset: {},
              style: {},
            };
          }
          if (id === 'toast') {
            return {
              textContent: '',
              classList: { add: () => {}, remove: () => {}, toggle: () => false },
              style: {},
              dataset: {},
            };
          }
          if (id === 'copy-btn') {
            return {
              textContent: '⎘ Copy ID',
              classList: { add: () => {}, remove: () => {}, toggle: () => false },
              style: {},
              dataset: {},
            };
          }
          return {
            innerHTML: '',
            textContent: '',
            style: {},
            dataset: {},
            classList: { add: () => {}, remove: () => {}, toggle: () => false },
            addEventListener: () => {},
          };
        },
      },
    });

    expect(() => context.copyTraceId('trace-clipboard-fallback')).not.toThrow();
    expect(copied).toBe(true);
  });

  it('renders enriched agent and workflow information in dashboard tabs and detail views', async () => {
    const state = createMonitorState();
    const workflowDetail = {
      workflow: {
        ...state.workflows[0],
        stepDefinitions: [
          { stepId: 'review-scope', type: 'prompt' },
          { stepId: 'prepare-summary', type: 'prompt' },
        ],
      },
      traces: [],
    };
    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/agents/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: state.agents[0] }),
          };
        }
        if (url.startsWith('/api/workflows/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: workflowDetail }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    context.switchTab('agents');
    expect(context.document.getElementById('app').innerHTML).toContain('Owns architect');
    expect(context.document.getElementById('app').innerHTML).toContain('Turns requirements into architecture proposals.');

    context.switchTab('workflows');
    expect(context.document.getElementById('app').innerHTML).toContain('Owner quality');
    expect(context.document.getElementById('app').innerHTML).toContain('Prepare a change for ship readiness.');

    await context.openAgent('architect', false);
    expect(context.document.getElementById('app').innerHTML).toContain('Recommended Commands');
    expect(context.document.getElementById('app').innerHTML).toContain('ax architect --request &quot;Design auth&quot;');
    expect(context.document.getElementById('app').innerHTML).toContain('Owned Workflows');

    await context.openWorkflow('ship', false);
    expect(context.document.getElementById('app').innerHTML).toContain('Owner: <strong>quality</strong>');
    expect(context.document.getElementById('app').innerHTML).toContain('Inputs');
    expect(context.document.getElementById('app').innerHTML).toContain('Artifacts');
    expect(context.document.getElementById('app').innerHTML).toContain('Planned Stages');
  });

  it('renders session and provider detail views from the generated dashboard client', async () => {
    const state = createMonitorState();
    state.sessions = [{
      ...state.sessions[0],
      summary: 'Coordinates the release review session.',
      participants: [{
        agentId: 'architect',
        role: 'collaborator',
        joinedAt: '2026-03-24T12:01:00.000Z',
      }],
      metadata: {
        team: 'core',
      },
    }];
    state.traces = [{
      ...state.traces[0],
      status: 'completed',
      completedAt: '2026-03-24T12:03:00.000Z',
      metadata: {
        provider: 'claude',
        sessionId: 'session-1',
      },
    }];

    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/sessions/')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              data: {
                session: state.sessions[0],
                traces: state.traces,
              },
            }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    context.switchTab('sessions');
    expect(context.document.getElementById('app').innerHTML).toContain('release task');
    expect(context.document.getElementById('app').innerHTML).toContain('Coordinates the release review session.');

    await context.openSession('session-1', false);
    expect(context.document.getElementById('app').innerHTML).toContain('Coordinates the release review session.');
    expect(context.document.getElementById('app').innerHTML).toContain('Participants');
    expect(context.document.getElementById('app').innerHTML).toContain('collaborator');
    expect(context.document.getElementById('app').innerHTML).toContain('Traces');

    context.openProvider('claude', false);
    expect(context.document.getElementById('app').innerHTML).toContain('Usage Summary');
    expect(context.document.getElementById('app').innerHTML).toContain('Workspace State');
    expect(context.document.getElementById('app').innerHTML).toContain('Recent Traces');
    expect(context.document.getElementById('app').innerHTML).toContain('Enabled: <strong>yes</strong>');
    expect(context.document.getElementById('app').innerHTML).toContain('ship');
  });

  it('renders readable labels for MCP tool traces in runs and trace detail views', async () => {
    const state = createMonitorState();
    const recentStart = new Date(Date.now() - 60_000).toISOString();
    const recentEnd = new Date(Date.now() - 55_000).toISOString();
    state.traces = [{
      traceId: 'trace-mcp-tool-1',
      workflowId: 'mcp.tool.memory_store',
      surface: 'mcp',
      status: 'completed',
      startedAt: recentStart,
      completedAt: recentEnd,
      stepResults: [],
      input: {
        namespace: 'ops',
        key: 'latest-request',
      },
      metadata: {
        command: 'memory_store',
        summary: 'ops/latest-request',
      },
    }];

    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/traces/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: state.traces[0] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    context.switchTab('activity');
    expect(context.document.getElementById('app').innerHTML).toContain('MCP: Memory Store');
    expect(context.document.getElementById('app').innerHTML).toContain('ops/latest-request');
    expect(context.document.getElementById('app').innerHTML).not.toContain('>mcp.tool.memory_store<');

    await context.openTrace('trace-mcp-tool-1', false);
    expect(context.document.getElementById('app').innerHTML).toContain('MCP: Memory Store');
    expect(context.document.getElementById('app').innerHTML).toContain('Summary');
    expect(context.document.getElementById('app').innerHTML).toContain('ops/latest-request');
  });

  it('renders runtime governance summaries in trace detail views', async () => {
    const state = createMonitorState();
    const recentStart = new Date(Date.now() - 60_000).toISOString();
    const recentEnd = new Date(Date.now() - 58_000).toISOString();
    state.traces = [{
      traceId: 'trace-guard-1',
      workflowId: 'workflow-skill-trust',
      surface: 'cli',
      status: 'failed',
      startedAt: recentStart,
      completedAt: recentEnd,
      stepResults: [{
        stepId: 'run-skill',
        success: false,
        durationMs: 120,
        retryCount: 0,
        error: 'Step blocked by runtime governance.',
      }],
      error: {
        code: 'WORKFLOW_GUARD_BLOCKED',
        message: 'Step run-skill blocked by guard: runtime_trust: trust state mismatch',
        failedStepId: 'run-skill',
      },
      metadata: {
        guardSummary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        guardId: 'enforce-runtime-trust',
        guardFailedGates: ['runtime_trust'],
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    }];

    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/traces/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: state.traces[0] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    context.switchTab('activity');
    expect(context.document.getElementById('app').innerHTML).toContain('Policy: Runtime governance blocked step');

    await context.openTrace('trace-guard-1', false);
    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('Policy');
    expect(html).toContain('Runtime governance blocked step &quot;run-skill&quot;');
    expect(html).toContain('Tool: skill.run');
    expect(html).toContain('Trust state: implicit-local');
    expect(html).toContain('Required trust states: trusted-id');
  });

  it('renders provider chips in trace detail views from trace input metadata, not only metadata.provider', async () => {
    const state = createMonitorState();
    state.traces = [{
      traceId: 'trace-provider-input-1',
      workflowId: 'parallel.run',
      surface: 'cli',
      status: 'completed',
      startedAt: '2026-03-24T12:00:00.000Z',
      completedAt: '2026-03-24T12:00:04.000Z',
      stepResults: [],
      input: {
        providers: ['claude', 'gemini'],
        task: 'Compare model outputs',
      },
      metadata: {
        summary: 'Compare model outputs across providers.',
      },
    }];

    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/traces/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: state.traces[0] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    await context.openTrace('trace-provider-input-1', false);
    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('Providers: <strong>claude, gemini</strong>');
    expect(html).toContain('Compare model outputs across providers.');
  });

  it('renders trace lists and detail views without leaking invalid timestamp text', async () => {
    const state = createMonitorState();
    const recentStart = new Date(Date.now() - 60_000).toISOString();
    state.traces = [{
      traceId: 'trace-invalid-time-1',
      workflowId: 'ship',
      surface: 'cli',
      status: 'failed',
      startedAt: recentStart,
      completedAt: 'also-not-a-real-date',
      stepResults: [{
        stepId: 'collect',
        success: false,
        durationMs: 150,
        retryCount: 0,
        error: 'provider timeout',
        startedAt: 'still-not-a-date',
      }],
      error: {
        code: 'STEP_FAILED',
        message: 'provider timeout',
        failedStepId: 'collect',
      },
      input: {
        provider: 'claude',
      },
      metadata: {
        summary: 'Bad timestamp regression case.',
      },
    }];

    const context = executeDashboardScript(buildDashboardHtml(state), {
      fetch: async (url: string) => {
        if (url.startsWith('/api/traces/')) {
          return {
            ok: true,
            json: async () => ({ success: true, data: state.traces[0] }),
          };
        }
        return {
          ok: true,
          json: async () => ({ success: true, data: [] }),
        };
      },
    });

    context.switchTab('activity');
    const activityHtml = context.document.getElementById('app').innerHTML;
    expect(activityHtml).not.toContain('NaN');
    expect(activityHtml).not.toContain('Invalid Date');
    expect(activityHtml).toContain('trace-invalid');

    await context.openTrace('trace-invalid-time-1', false);
    const detailHtml = context.document.getElementById('app').innerHTML;
    expect(detailHtml).not.toContain('NaN');
    expect(detailHtml).not.toContain('Invalid Date');
    expect(detailHtml).toContain('Provider: <strong>claude</strong>');
    expect(detailHtml).toContain('Error');
  });

  it('renders runtime governance aggregates in the overview tab', () => {
    const state = createMonitorState();
    state.traces = [{
      traceId: 'trace-governance-aggregate-1',
      workflowId: 'workflow-skill-trust',
      surface: 'cli',
      status: 'failed',
      startedAt: '2026-03-24T12:00:00.000Z',
      completedAt: '2026-03-24T12:00:02.000Z',
      stepResults: [],
      metadata: {
        guardSummary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        guardBlockedByRuntimeGovernance: true,
        guardToolName: 'skill.run',
        guardTrustState: 'implicit-local',
        guardRequiredTrustStates: ['trusted-id'],
      },
    }];
    state.status.traces.failed = 1;
    state.governance = {
      blockedCount: 1,
      latest: {
        traceId: 'trace-governance-aggregate-1',
        workflowId: 'workflow-skill-trust',
        startedAt: '2026-03-24T12:00:00.000Z',
        summary: 'Runtime governance blocked step "run-skill". Trust state: implicit-local. Required trust states: trusted-id.',
        blockedByRuntimeGovernance: true,
        failedGates: [],
        failedGateMessages: [],
        toolName: 'skill.run',
        trustState: 'implicit-local',
        requiredTrustStates: ['trusted-id'],
      },
      deniedImportedSkills: {
        deniedCount: 0,
      },
    };

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('overview');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('Runtime Governance');
    expect(html).toContain('Recent traces blocked by runtime-governance');
    expect(html).toContain('trace-governance-aggregate-1');
    expect(html).toContain('skill.run');
    expect(html).toContain('implicit-local');
    expect(html).toContain('trusted-id');
  });

  it('renders denied imported skill aggregates in the overview tab', () => {
    const state = createMonitorState();
    state.governance = {
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 1,
        latest: {
          skillId: 'community-review',
          relativePath: '.automatosx/skills/community-review/skill.json',
          importedAt: '2026-03-24T12:00:00.000Z',
          summary: 'Imported skill "community-review" is currently denied (denied). Execution blocked because "community-review" requires explicit trust.',
          trustState: 'denied',
          sourceRef: 'fixtures/community-review/SKILL.md',
        },
      },
    };

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('overview');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('Runtime Governance');
    expect(html).toContain('Imported skills currently denied by workspace trust policy');
    expect(html).toContain('community-review');
    expect(html).toContain('.automatosx/skills/community-review/skill.json');
    expect(html).toContain('fixtures/community-review/SKILL.md');
  });

  it('renders denied installed bridge aggregates in the overview tab', () => {
    const state = createMonitorState();
    state.deniedInstalledBridges = {
      deniedCount: 1,
      latest: {
        bridgeId: 'guarded-installed-bridge',
        relativePath: '.automatosx/bridges/guarded-installed-bridge/bridge.json',
        installedAt: '2026-03-24T12:00:00.000Z',
        summary: 'Installed bridge "guarded-installed-bridge" is currently denied (denied). Execution blocked because "guarded-installed-bridge" requires explicit trust.',
        trustState: 'denied',
        sourceRef: 'https://github.com/example/guarded-installed-bridge',
      },
    };

    const context = executeDashboardScript(buildDashboardHtml(state));
    context.switchTab('overview');

    const html = context.document.getElementById('app').innerHTML;
    expect(html).toContain('Runtime Governance');
    expect(html).toContain('Installed bridges currently denied by workspace trust policy');
    expect(html).toContain('guarded-installed-bridge');
    expect(html).toContain('.automatosx/bridges/guarded-installed-bridge/bridge.json');
    expect(html).toContain('https://github.com/example/guarded-installed-bridge');
  });

  it('parses monitor flags and rejects invalid ports', () => {
    expect(parseMonitorArgs(['--port', '8080', '--no-open'])).toEqual({
      explicitPort: 8080,
      noOpen: true,
    });

    expect(parseMonitorArgs(['--port=8181'])).toEqual({
      explicitPort: 8181,
      noOpen: false,
    });

    expect(parseMonitorArgs(['-p', '8282'])).toEqual({
      explicitPort: 8282,
      noOpen: false,
    });

    expect(parseMonitorArgs(['--port'])).toEqual({
      noOpen: false,
      error: 'Missing value for --port.',
    });

    expect(parseMonitorArgs(['--port', '70000'])).toEqual({
      noOpen: false,
      error: 'Port must be an integer between 1 and 65535.',
    });

    expect(parseMonitorArgs(['--bogus'])).toEqual({
      noOpen: false,
      error: 'Unknown monitor flag: --bogus.',
    });

    expect(parseMonitorArgs(['status'])).toEqual({
      noOpen: false,
      error: 'Usage: ax monitor [options]',
    });
  });

  it('normalizes monitor request paths that include query strings', () => {
    expect(getMonitorPath('/')).toBe('/');
    expect(getMonitorPath('/index.html?refresh=1')).toBe('/index.html');
    expect(getMonitorPath('/api/state?limit=5')).toBe('/api/state');
    expect(getMonitorPath(undefined)).toBe('/');
  });

  it('reads cached provider snapshot files without probing live providers', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const automatosxDir = join(tempDir, '.automatosx');
    mkdirSync(automatosxDir, { recursive: true });

    await writeFile(join(automatosxDir, 'environment.json'), `${JSON.stringify({
      generatedAt: '2026-03-24T12:00:00.000Z',
      providers: [
        { providerId: 'claude', cli: 'claude', installed: true },
        { providerId: 'gemini', cli: 'gemini', installed: false },
      ],
    }, null, 2)}\n`, 'utf8');
    await writeFile(join(automatosxDir, 'providers.json'), `${JSON.stringify({
      providers: [
        { providerId: 'claude', enabled: true, installed: true },
        { providerId: 'grok', enabled: false, installed: true },
      ],
    }, null, 2)}\n`, 'utf8');

    await expect(readCachedProviderSnapshot(tempDir)).resolves.toEqual({
      source: 'cached',
      generatedAt: '2026-03-24T12:00:00.000Z',
      detectedProviders: ['claude'],
      enabledProviders: ['claude'],
      installedButDisabledProviders: ['grok'],
      configuredButUnavailableProviders: [],
    });
  });

  it('returns an unavailable provider snapshot when cached files are missing', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);

    await expect(readCachedProviderSnapshot(tempDir)).resolves.toEqual({
      source: 'unavailable',
      detectedProviders: [],
      enabledProviders: [],
      installedButDisabledProviders: [],
      configuredButUnavailableProviders: [],
    });
  });

  it('salvages valid provider entries when cached snapshot files contain malformed entries', async () => {
    const tempDir = createTempDir();
    tempDirs.push(tempDir);
    const automatosxDir = join(tempDir, '.automatosx');
    mkdirSync(automatosxDir, { recursive: true });

    await writeFile(join(automatosxDir, 'environment.json'), `${JSON.stringify({
      generatedAt: '2026-03-24T12:00:00.000Z',
      providers: [
        { providerId: 'claude', cli: 'claude', installed: true },
        { providerId: 42, cli: 'broken', installed: true },
        'bad-entry',
      ],
    }, null, 2)}\n`, 'utf8');
    await writeFile(join(automatosxDir, 'providers.json'), `${JSON.stringify({
      providers: [
        { providerId: 'claude', enabled: true, installed: true },
        { providerId: 'grok', enabled: false, installed: true },
        { providerId: 'gemini', enabled: 'yes', installed: true },
        null,
      ],
    }, null, 2)}\n`, 'utf8');

    await expect(readCachedProviderSnapshot(tempDir)).resolves.toEqual({
      source: 'cached',
      generatedAt: '2026-03-24T12:00:00.000Z',
      detectedProviders: ['claude'],
      enabledProviders: ['claude'],
      installedButDisabledProviders: ['grok', 'gemini'],
      configuredButUnavailableProviders: [],
    });
  });

  it('resolves monitor config from workspace config with sane defaults', () => {
    expect(resolveMonitorConfig(undefined)).toEqual({
      portMin: 3000,
      portMax: 3999,
      autoOpen: true,
    });

    expect(resolveMonitorConfig({
      monitor: {
        portMin: 4100,
        portMax: 4000,
        autoOpen: false,
      },
    })).toEqual({
      portMin: 4000,
      portMax: 4100,
      autoOpen: false,
    });
  });

  it('builds compatibility monitor api responses', () => {
    const state = createMonitorState();

    const health = createMonitorApiResponse('/api/health', state);
    const status = createMonitorApiResponse('/api/status', state);
    const providers = createMonitorApiResponse('/api/providers', state);
    const governance = createMonitorApiResponse('/api/governance', state);
    const fullState = createMonitorApiResponse('/api/state', state);

    expect(health.statusCode).toBe(200);
    expect(JSON.parse(health.body)).toMatchObject({
      success: true,
      data: { status: 'ok' },
    });
    expect(status.statusCode).toBe(200);
    expect(JSON.parse(status.body)).toMatchObject({
      success: true,
      data: {
        sessions: { active: 1 },
        runtime: { defaultProvider: 'claude' },
      },
    });
    expect(providers.statusCode).toBe(200);
    expect(JSON.parse(providers.body)).toMatchObject({
      success: true,
      data: {
        source: 'cached',
        detectedProviders: ['claude'],
      },
    });
    expect(governance.statusCode).toBe(200);
    expect(JSON.parse(governance.body)).toMatchObject({
      success: true,
      data: {
        blockedCount: 0,
        deniedImportedSkills: {
          deniedCount: 0,
        },
      },
    });
    expect(RuntimeGovernanceAggregateSchema.parse(JSON.parse(governance.body).data)).toMatchObject({
      blockedCount: 0,
      deniedImportedSkills: {
        deniedCount: 0,
      },
    });
    expect(JSON.parse(fullState.body)).toMatchObject({
      governance: {
        blockedCount: 0,
        deniedImportedSkills: {
          deniedCount: 0,
        },
      },
    });
  });
});
