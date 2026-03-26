import { WORKFLOW_PRIMARY_EXAMPLES } from '../command-metadata.js';
import type { MonitorProviderSnapshot } from './monitor-types.js';
import { MONITOR_DASHBOARD_STYLES } from './monitor-dashboard-style.js';
import { buildDashboardScriptTag, escapeHtml } from './monitor-dashboard-script.js';

function serializeForInlineScript(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export { escapeHtml };

export function buildDashboardHtml(data: {
  status: {
    sessions: { total?: number; active: number; completed: number; failed: number };
    traces: { total?: number; running: number; completed: number; failed: number };
    runtime: { defaultProvider?: string; providerExecutionMode: string; configuredExecutors: string[] };
  };
  sessions: unknown[];
  traces: unknown[];
  agents: unknown[];
  workflows: unknown[];
  providers: MonitorProviderSnapshot;
}): string {
  const serializedState = serializeForInlineScript(data);
  const serializedWorkflowPrimaryExamples = serializeForInlineScript(WORKFLOW_PRIMARY_EXAMPLES);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutomatosX Monitor</title>
  <style>
${MONITOR_DASHBOARD_STYLES}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <h1>AutomatosX Monitor</h1>
        <div class="subtitle">Localhost only &middot; auto-refreshes every 10s</div>
      </div>
      <div class="toolbar">
        <span class="live-label"><span class="live-dot" id="live-dot"></span><span id="live-label-text">LIVE</span></span>
        <span class="live-label" style="margin-left:4px">Refresh in <span id="last-updated-rel">10s</span></span>
        <button class="refresh-btn" id="refresh-btn" onclick="manualRefresh()"><svg id="refresh-icon" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10.5 2A5 5 0 1 0 11 6.5"/><polyline points="10.5,0 10.5,2.5 8,2.5"/></svg>Refresh</button>
        <button class="raw-link" onclick="switchTab('raw')">raw</button>
      </div>
    </div>
    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="overview">Overview</button>
      <button class="tab" data-tab="activity">Runs</button>
      <button class="tab" data-tab="sessions">Sessions</button>
      <button class="tab" data-tab="agents">Agents</button>
      <button class="tab" data-tab="workflows">Workflows</button>
      <button class="tab" data-tab="providers">Providers</button>
    </div>
    <div id="app"></div>
  </div>
  <div class="toast" id="toast"></div>
${buildDashboardScriptTag(serializedState, serializedWorkflowPrimaryExamples)}
</body>
</html>`;
}
