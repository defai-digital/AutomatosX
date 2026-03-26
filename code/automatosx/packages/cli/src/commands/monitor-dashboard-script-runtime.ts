import { MONITOR_DASHBOARD_SCRIPT_ACTIONS } from './monitor-dashboard-script-actions.js';
import { MONITOR_DASHBOARD_SCRIPT_BOOT } from './monitor-dashboard-script-boot.js';
import { MONITOR_DASHBOARD_SCRIPT_NAVIGATION } from './monitor-dashboard-script-navigation.js';

export const MONITOR_DASHBOARD_SCRIPT_RUNTIME = [
  MONITOR_DASHBOARD_SCRIPT_ACTIONS,
  MONITOR_DASHBOARD_SCRIPT_NAVIGATION,
  MONITOR_DASHBOARD_SCRIPT_BOOT,
].join('\n');
