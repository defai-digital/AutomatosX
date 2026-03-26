import { MONITOR_DASHBOARD_SCRIPT_OVERVIEW } from './monitor-dashboard-script-overview.js';
import { MONITOR_DASHBOARD_SCRIPT_SHARED } from './monitor-dashboard-script-shared.js';
import { MONITOR_DASHBOARD_SCRIPT_TABS } from './monitor-dashboard-script-tabs.js';

export const MONITOR_DASHBOARD_SCRIPT_SECTIONS = [
  MONITOR_DASHBOARD_SCRIPT_SHARED,
  MONITOR_DASHBOARD_SCRIPT_OVERVIEW,
  MONITOR_DASHBOARD_SCRIPT_TABS,
].join('\n');
