import { MONITOR_DASHBOARD_SCRIPT_DETAILS } from './monitor-dashboard-script-details.js';
import { MONITOR_DASHBOARD_SCRIPT_RUNTIME } from './monitor-dashboard-script-runtime.js';
import { MONITOR_DASHBOARD_SCRIPT_SECTIONS } from './monitor-dashboard-script-sections.js';

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", '&#39;');
}

export function buildDashboardScriptTag(
  serializedState: string,
  serializedWorkflowPrimaryExamples: string,
): string {
  return `<script>
    const initialState = ${serializedState};
    const workflowPrimaryExamples = ${serializedWorkflowPrimaryExamples};
${MONITOR_DASHBOARD_SCRIPT_SECTIONS}
${MONITOR_DASHBOARD_SCRIPT_DETAILS}
${MONITOR_DASHBOARD_SCRIPT_RUNTIME}
</script>`;
}
