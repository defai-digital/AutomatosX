import { MONITOR_DASHBOARD_SCRIPT_DETAIL_AGENT } from './monitor-dashboard-script-detail-agent.js';
import { MONITOR_DASHBOARD_SCRIPT_DETAIL_PROVIDER } from './monitor-dashboard-script-detail-provider.js';
import { MONITOR_DASHBOARD_SCRIPT_DETAIL_SESSION } from './monitor-dashboard-script-detail-session.js';
import { MONITOR_DASHBOARD_SCRIPT_DETAIL_TRACE } from './monitor-dashboard-script-detail-trace.js';
import { MONITOR_DASHBOARD_SCRIPT_DETAIL_WORKFLOW } from './monitor-dashboard-script-detail-workflow.js';

export const MONITOR_DASHBOARD_SCRIPT_DETAILS = `
    /* ── Detail Views ───────────────────────────────── */
${[
  MONITOR_DASHBOARD_SCRIPT_DETAIL_TRACE,
  MONITOR_DASHBOARD_SCRIPT_DETAIL_AGENT,
  MONITOR_DASHBOARD_SCRIPT_DETAIL_SESSION,
  MONITOR_DASHBOARD_SCRIPT_DETAIL_WORKFLOW,
  MONITOR_DASHBOARD_SCRIPT_DETAIL_PROVIDER,
].join('\n')}
`;
