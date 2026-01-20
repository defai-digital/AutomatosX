/**
 * Web Dashboard HTML Generator
 *
 * Creates a single-page React application for the monitoring dashboard.
 * Uses React via CDN and inline styles for zero-build deployment.
 *
 * Phase 4: Added live updates indicator, history view, active processes
 */

/**
 * Generate the dashboard HTML
 */
export function createDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AutomatosX Monitor</title>
  <script>
    window.cdnLoadErrors = [];
    window.onerror = function(msg, url, line) {
      document.getElementById('root').innerHTML =
        '<div style="padding:24px;color:#f85149;background:#161b22;min-height:100vh;">' +
        '<h1>Script Error</h1><pre>' + msg + '\\nLine: ' + line + '</pre></div>';
    };
  </script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin
    onerror="cdnLoadErrors.push('React failed to load from CDN')"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin
    onerror="cdnLoadErrors.push('ReactDOM failed to load from CDN')"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js" crossorigin
    onerror="cdnLoadErrors.push('Babel failed to load from CDN')"></script>
  <script>
    // Check if CDN scripts loaded
    setTimeout(function() {
      if (window.cdnLoadErrors.length > 0 || typeof React === 'undefined' || typeof Babel === 'undefined') {
        var errors = window.cdnLoadErrors.join(', ') || 'Unknown CDN load error';
        if (typeof React === 'undefined') errors += ' React not defined.';
        if (typeof ReactDOM === 'undefined') errors += ' ReactDOM not defined.';
        if (typeof Babel === 'undefined') errors += ' Babel not defined.';
        document.getElementById('root').innerHTML =
          '<div style="padding:24px;color:#f85149;background:#161b22;min-height:100vh;">' +
          '<h1>CDN Load Error</h1>' +
          '<p>Failed to load required scripts from unpkg.com CDN.</p>' +
          '<p style="color:#8b949e;">' + errors + '</p>' +
          '<p style="margin-top:16px;color:#8b949e;">This may be due to:</p>' +
          '<ul style="color:#8b949e;margin-left:20px;">' +
          '<li>Network connectivity issues</li>' +
          '<li>Firewall blocking unpkg.com</li>' +
          '<li>Ad blocker interfering</li>' +
          '</ul></div>';
      }
    }, 3000);
  </script>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --border-color: #30363d;
      --text-primary: #e6edf3;
      --text-secondary: #8b949e;
      --text-muted: #6e7681;
      --accent-green: #3fb950;
      --accent-red: #f85149;
      --accent-yellow: #d29922;
      --accent-blue: #58a6ff;
      --accent-purple: #a371f7;
      --accent-cyan: #39c5cf;
      --accent-orange: #f0883e;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      min-height: 100vh;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 24px;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .header h1 {
      font-size: 24px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-status {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    /* Live indicator */
    .live-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      background: rgba(63, 185, 80, 0.1);
      border: 1px solid rgba(63, 185, 80, 0.3);
      border-radius: 20px;
      font-size: 12px;
      color: var(--accent-green);
      font-weight: 500;
    }

    .live-dot {
      width: 8px;
      height: 8px;
      background: var(--accent-green);
      border-radius: 50%;
      animation: live-pulse 1.5s ease-in-out infinite;
    }

    @keyframes live-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(1.2); }
    }

    .refresh-countdown {
      font-size: 11px;
      color: var(--text-muted);
      font-family: monospace;
    }

    .nav-tabs {
      display: flex;
      gap: 4px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 0;
    }

    .nav-tab {
      padding: 8px 16px;
      background: transparent;
      border: none;
      color: var(--text-secondary);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: all 0.2s;
    }

    .nav-tab:hover {
      color: var(--text-primary);
    }

    .nav-tab.active {
      color: var(--accent-blue);
      border-bottom-color: var(--accent-blue);
    }

    .nav-tab .tab-badge {
      background: var(--bg-tertiary);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 11px;
      margin-left: 6px;
    }

    .nav-tab.active .tab-badge {
      background: rgba(88, 166, 255, 0.2);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
    }

    .status-badge.healthy {
      background: rgba(63, 185, 80, 0.15);
      color: var(--accent-green);
    }

    .status-badge.degraded {
      background: rgba(210, 153, 34, 0.15);
      color: var(--accent-yellow);
    }

    .status-badge.unhealthy {
      background: rgba(248, 81, 73, 0.15);
      color: var(--accent-red);
    }

    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .status-dot.healthy { background: var(--accent-green); }
    .status-dot.degraded { background: var(--accent-yellow); }
    .status-dot.unhealthy { background: var(--accent-red); }

    /* Metrics row */
    .metrics-row {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }

    .metric-value {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .metric-label {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-change {
      font-size: 11px;
      margin-top: 4px;
    }

    .metric-change.up { color: var(--accent-green); }
    .metric-change.down { color: var(--accent-red); }

    /* Active processes section */
    .active-processes {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .active-processes-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .active-processes-title {
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .active-count {
      background: var(--accent-blue);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
    }

    .process-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .process-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-left: 3px solid var(--accent-blue);
    }

    .process-item.running {
      border-left-color: var(--accent-green);
      animation: process-glow 2s ease-in-out infinite;
    }

    @keyframes process-glow {
      0%, 100% { background: var(--bg-tertiary); }
      50% { background: rgba(63, 185, 80, 0.1); }
    }

    .process-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }

    .process-details {
      flex: 1;
    }

    .process-name {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .process-meta {
      font-size: 12px;
      color: var(--text-muted);
    }

    .process-duration {
      font-family: monospace;
      font-size: 13px;
      color: var(--accent-cyan);
    }

    .no-processes {
      text-align: center;
      padding: 24px;
      color: var(--text-muted);
      font-size: 13px;
    }

    /* Grid layout */
    .grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
    }

    .grid-3 {
      grid-template-columns: repeat(3, 1fr);
    }

    /* Card styles */
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
    }

    .card-badge {
      font-size: 12px;
      color: var(--text-muted);
    }

    /* Provider list */
    .provider-list {
      padding: 8px;
    }

    .provider-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 4px;
    }

    .provider-item:hover {
      background: var(--bg-tertiary);
    }

    .provider-name {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .provider-icon {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .provider-icon.available { background: var(--accent-green); }
    .provider-icon.unavailable { background: var(--accent-red); }

    .provider-latency {
      font-size: 12px;
      font-family: monospace;
    }

    .provider-latency.fast { color: var(--accent-green); }
    .provider-latency.slow { color: var(--accent-red); }

    /* Agent list */
    .agent-list {
      padding: 8px;
    }

    .agent-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 4px;
    }

    .agent-item:hover {
      background: var(--bg-tertiary);
    }

    .agent-name {
      font-size: 13px;
    }

    /* Trace list */
    .trace-list {
      padding: 8px;
    }

    .trace-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
    }

    .trace-item:hover {
      background: var(--bg-tertiary);
    }

    .trace-name {
      font-size: 13px;
      font-family: monospace;
    }

    .trace-status {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .trace-status-icon {
      font-size: 12px;
    }

    .trace-status-icon.success { color: var(--accent-green); }
    .trace-status-icon.running { color: var(--accent-blue); animation: blink 1s infinite; }
    .trace-status-icon.failure { color: var(--accent-red); }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Workflow list */
    .workflow-list {
      padding: 8px;
    }

    .workflow-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      border-radius: 4px;
      cursor: pointer;
    }

    .workflow-item:hover {
      background: var(--bg-tertiary);
    }

    .workflow-name {
      font-size: 13px;
    }

    /* History styles */
    .history-controls {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .history-search {
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
    }

    .history-search:focus {
      outline: none;
      border-color: var(--accent-blue);
    }

    .history-filter {
      padding: 8px 12px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      font-size: 14px;
      cursor: pointer;
    }

    .refresh-button {
      padding: 8px 16px;
      background: var(--accent-blue);
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s, opacity 0.2s;
    }

    .refresh-button:hover:not(:disabled) {
      background: var(--accent-blue-hover, #2563eb);
    }

    .refresh-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .history-table {
      width: 100%;
      border-collapse: collapse;
    }

    .history-table th,
    .history-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }

    .history-table th {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
      font-weight: 500;
    }

    .history-table tbody tr {
      cursor: pointer;
      transition: background 0.2s;
    }

    .history-table tbody tr:hover {
      background: var(--bg-tertiary);
    }

    .history-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }

    .history-status.success {
      background: rgba(63, 185, 80, 0.15);
      color: var(--accent-green);
    }

    .history-status.failure {
      background: rgba(248, 81, 73, 0.15);
      color: var(--accent-red);
    }

    .history-status.running {
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-blue);
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 32px;
      color: var(--text-muted);
    }

    /* Progress bar */
    .progress-bar {
      height: 4px;
      background: var(--bg-tertiary);
      border-radius: 2px;
      overflow: hidden;
      margin-top: 12px;
    }

    .progress-fill {
      height: 100%;
      border-radius: 2px;
      transition: width 0.3s;
    }

    .progress-fill.green { background: var(--accent-green); }
    .progress-fill.yellow { background: var(--accent-yellow); }
    .progress-fill.red { background: var(--accent-red); }

    /* Timeline styles - react-native-timeline-listview inspired */
    .timeline-container {
      padding: 16px 16px 16px 24px;
      position: relative;
    }

    .timeline-event {
      display: flex;
      position: relative;
      padding-bottom: 24px;
      min-height: 80px;
    }

    .timeline-event:last-child {
      padding-bottom: 0;
    }

    /* Vertical connecting line */
    .timeline-event::before {
      content: '';
      position: absolute;
      left: 15px;
      top: 32px;
      bottom: 0;
      width: 2px;
      background: linear-gradient(to bottom, var(--border-color), var(--border-color) 60%, transparent);
    }

    .timeline-event:last-child::before {
      display: none;
    }

    /* Time column on the left */
    .timeline-time-col {
      width: 70px;
      flex-shrink: 0;
      text-align: right;
      padding-right: 20px;
      padding-top: 6px;
    }

    .timeline-time {
      font-size: 11px;
      color: var(--text-muted);
      font-family: monospace;
      line-height: 1.2;
    }

    .timeline-date {
      font-size: 10px;
      color: var(--text-muted);
      opacity: 0.7;
    }

    /* Dot/circle in the middle */
    .timeline-dot-wrapper {
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .timeline-dot {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 3px solid var(--bg-primary);
      box-shadow: 0 0 0 2px var(--border-color);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .timeline-event:hover .timeline-dot {
      transform: scale(1.1);
      box-shadow: 0 0 0 3px var(--border-color), 0 4px 12px rgba(0,0,0,0.3);
    }

    .timeline-dot.run {
      background: rgba(88, 166, 255, 0.2);
      color: var(--accent-blue);
      box-shadow: 0 0 0 2px var(--accent-blue);
    }
    .timeline-dot.step {
      background: rgba(163, 113, 247, 0.2);
      color: var(--accent-purple);
      box-shadow: 0 0 0 2px var(--accent-purple);
    }
    .timeline-dot.tool {
      background: rgba(57, 197, 207, 0.2);
      color: var(--accent-cyan);
      box-shadow: 0 0 0 2px var(--accent-cyan);
    }
    .timeline-dot.decision {
      background: rgba(240, 136, 62, 0.2);
      color: var(--accent-orange);
      box-shadow: 0 0 0 2px var(--accent-orange);
    }
    .timeline-dot.discussion {
      background: rgba(210, 153, 34, 0.2);
      color: var(--accent-yellow);
      box-shadow: 0 0 0 2px var(--accent-yellow);
    }
    .timeline-dot.memory {
      background: rgba(63, 185, 80, 0.2);
      color: var(--accent-green);
      box-shadow: 0 0 0 2px var(--accent-green);
    }
    .timeline-dot.error {
      background: rgba(248, 81, 73, 0.2);
      color: var(--accent-red);
      box-shadow: 0 0 0 2px var(--accent-red);
    }

    /* Connecting line color matches dot */
    .timeline-event.run::before { background: linear-gradient(to bottom, var(--accent-blue), var(--border-color)); }
    .timeline-event.step::before { background: linear-gradient(to bottom, var(--accent-purple), var(--border-color)); }
    .timeline-event.tool::before { background: linear-gradient(to bottom, var(--accent-cyan), var(--border-color)); }
    .timeline-event.decision::before { background: linear-gradient(to bottom, var(--accent-orange), var(--border-color)); }
    .timeline-event.discussion::before { background: linear-gradient(to bottom, var(--accent-yellow), var(--border-color)); }
    .timeline-event.memory::before { background: linear-gradient(to bottom, var(--accent-green), var(--border-color)); }
    .timeline-event.error::before { background: linear-gradient(to bottom, var(--accent-red), var(--border-color)); }

    /* Content on the right */
    .timeline-content {
      flex: 1;
      padding-left: 16px;
      padding-top: 4px;
    }

    .timeline-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
    }

    .timeline-type {
      font-weight: 600;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .timeline-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .timeline-title-main {
      font-weight: 600;
      font-size: 14px;
    }

    .timeline-title-sub {
      font-size: 12px;
      color: var(--text-secondary);
    }

    .timeline-details {
      font-size: 13px;
      color: var(--text-secondary);
      padding: 8px 12px;
      background: var(--bg-tertiary);
      border-radius: 6px;
      border-left: 3px solid var(--border-color);
      margin-top: 8px;
    }

    .timeline-event.run .timeline-details { border-left-color: var(--accent-blue); }
    .timeline-event.step .timeline-details { border-left-color: var(--accent-purple); }
    .timeline-event.tool .timeline-details { border-left-color: var(--accent-cyan); }
    .timeline-event.decision .timeline-details { border-left-color: var(--accent-orange); }
    .timeline-event.discussion .timeline-details { border-left-color: var(--accent-yellow); }
    .timeline-event.memory .timeline-details { border-left-color: var(--accent-green); }
    .timeline-event.error .timeline-details { border-left-color: var(--accent-red); }

    .timeline-duration {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      background: var(--bg-tertiary);
      border-radius: 12px;
      font-size: 11px;
      font-family: monospace;
      color: var(--text-secondary);
    }

    .timeline-duration::before {
      content: '⏱';
      font-size: 10px;
    }

    .timeline-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .timeline-status.success {
      background: rgba(63, 185, 80, 0.15);
      color: var(--accent-green);
    }

    .timeline-status.failure {
      background: rgba(248, 81, 73, 0.15);
      color: var(--accent-red);
    }

    .timeline-status.running {
      background: rgba(88, 166, 255, 0.15);
      color: var(--accent-blue);
    }

    .timeline-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .timeline-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      background: var(--bg-tertiary);
      border-radius: 4px;
      font-size: 11px;
      color: var(--text-muted);
    }

    .timeline-tag-label {
      opacity: 0.7;
    }

    /* DAG styles */
    .dag-container {
      padding: 24px;
      background: var(--bg-tertiary);
      border-radius: 8px;
      min-height: 300px;
    }

    .dag-node {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background: var(--bg-secondary);
      border: 2px solid var(--border-color);
      border-radius: 8px;
      margin-bottom: 8px;
      position: relative;
    }

    .dag-node.prompt { border-color: var(--accent-blue); }
    .dag-node.tool { border-color: var(--accent-cyan); }
    .dag-node.conditional { border-color: var(--accent-orange); }
    .dag-node.loop { border-color: var(--accent-purple); }
    .dag-node.parallel { border-color: var(--accent-green); }
    .dag-node.discuss { border-color: var(--accent-yellow); }
    .dag-node.delegate { border-color: var(--accent-red); }

    .dag-node-icon {
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
    }

    .dag-node.prompt .dag-node-icon { background: rgba(88, 166, 255, 0.2); }
    .dag-node.tool .dag-node-icon { background: rgba(57, 197, 207, 0.2); }
    .dag-node.conditional .dag-node-icon { background: rgba(240, 136, 62, 0.2); }
    .dag-node.loop .dag-node-icon { background: rgba(163, 113, 247, 0.2); }
    .dag-node.parallel .dag-node-icon { background: rgba(63, 185, 80, 0.2); }
    .dag-node.discuss .dag-node-icon { background: rgba(210, 153, 34, 0.2); }
    .dag-node.delegate .dag-node-icon { background: rgba(248, 81, 73, 0.2); }

    .dag-node-content {
      flex: 1;
      min-width: 0;
    }

    .dag-node-name {
      font-weight: 600;
      margin-bottom: 2px;
    }

    .dag-node-type {
      font-size: 12px;
      color: var(--text-muted);
      text-transform: uppercase;
    }

    .dag-connector {
      width: 2px;
      height: 24px;
      background: var(--border-color);
      margin: 0 auto;
      position: relative;
    }

    .dag-connector::after {
      content: '\\25BC';
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      color: var(--border-color);
      font-size: 10px;
    }

    .back-button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      color: var(--text-primary);
      cursor: pointer;
      font-size: 14px;
      margin-bottom: 16px;
      transition: background 0.2s;
    }

    .back-button:hover {
      background: var(--border-color);
    }

    .detail-header {
      margin-bottom: 24px;
    }

    .detail-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    .detail-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .version {
      font-size: 12px;
      color: var(--text-muted);
      font-family: monospace;
    }

    @media (max-width: 1200px) {
      .metrics-row {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 768px) {
      .metrics-row {
        grid-template-columns: repeat(2, 1fr);
      }
      .grid {
        grid-template-columns: 1fr;
      }
    }

    /* Provider Usage Histogram */
    .histogram-container {
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .histogram-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .histogram-title {
      font-size: 14px;
      font-weight: 600;
    }

    .histogram-subtitle {
      font-size: 12px;
      color: var(--text-muted);
    }

    .histogram-chart {
      display: flex;
      align-items: flex-end;
      gap: 8px;
      height: 120px;
      padding: 8px 0;
    }

    .histogram-bar-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      height: 100%;
    }

    .histogram-bar-wrapper {
      flex: 1;
      width: 100%;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
    }

    .histogram-bar {
      width: 100%;
      border-radius: 4px 4px 0 0;
      transition: height 0.3s ease;
      min-height: 4px;
      position: relative;
    }

    .histogram-bar:hover {
      filter: brightness(1.2);
    }

    .histogram-bar-tooltip {
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      white-space: nowrap;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.2s;
    }

    .histogram-bar:hover .histogram-bar-tooltip {
      opacity: 1;
    }

    .histogram-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 8px;
      text-align: center;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .histogram-count {
      font-size: 10px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .histogram-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid var(--border-color);
    }

    .histogram-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text-secondary);
    }

    .histogram-legend-dot {
      width: 10px;
      height: 10px;
      border-radius: 2px;
    }

    /* Pagination */
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-top: 1px solid var(--border-color);
      background: var(--bg-secondary);
    }

    .pagination-info {
      font-size: 13px;
      color: var(--text-muted);
    }

    .pagination-controls {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .pagination-button {
      padding: 6px 12px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-primary);
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s, border-color 0.2s;
    }

    .pagination-button:hover:not(:disabled) {
      background: var(--border-color);
      border-color: var(--text-muted);
    }

    .pagination-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pagination-pages {
      display: flex;
      gap: 4px;
    }

    .pagination-page {
      padding: 6px 10px;
      background: var(--bg-tertiary);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .pagination-page:hover {
      background: var(--border-color);
    }

    .pagination-page.active {
      background: var(--accent-blue);
      border-color: var(--accent-blue);
      color: white;
    }

    .pagination-ellipsis {
      padding: 6px 8px;
      color: var(--text-muted);
    }

    /* ===== Accessibility Improvements ===== */

    /* Skip link for keyboard navigation */
    .skip-link {
      position: absolute;
      top: -50px;
      left: 16px;
      background: var(--accent-blue);
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 1000;
      font-weight: 600;
      text-decoration: none;
      transition: top 0.2s ease;
    }

    .skip-link:focus {
      top: 16px;
    }

    /* Focus indicators */
    :focus {
      outline: none;
    }

    :focus-visible {
      outline: 2px solid var(--accent-blue);
      outline-offset: 2px;
    }

    .nav-tab:focus-visible {
      outline-offset: -2px;
      border-radius: 4px 4px 0 0;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: 2px solid var(--accent-blue);
      outline-offset: 2px;
    }

    /* Tabular numbers for metrics alignment */
    .metric-value,
    .pagination-info,
    .refresh-countdown {
      font-variant-numeric: tabular-nums;
    }

    /* ===== Skeleton Loading States ===== */

    .skeleton {
      background: linear-gradient(
        90deg,
        var(--bg-tertiary) 25%,
        var(--border-color) 50%,
        var(--bg-tertiary) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .skeleton-text {
      height: 1em;
      width: 100%;
    }

    .skeleton-card {
      height: 120px;
      width: 100%;
    }

    .skeleton-row {
      display: flex;
      gap: 12px;
      padding: 12px;
      align-items: center;
    }

    .skeleton-row .skeleton {
      flex: 1;
      height: 16px;
    }

    .skeleton-row .skeleton:first-child {
      flex: 0 0 80px;
    }

    .skeleton-row .skeleton:last-child {
      flex: 0 0 60px;
    }

    /* ===== Empty States ===== */

    .empty-state {
      text-align: center;
      padding: 48px 24px;
      color: var(--text-muted);
    }

    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-state-title {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    .empty-state-description {
      font-size: 14px;
      margin-bottom: 16px;
      max-width: 400px;
      margin-left: auto;
      margin-right: auto;
    }

    .empty-state-action {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: var(--accent-blue);
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    .empty-state-action:hover {
      background: #4c9aff;
    }

    /* Table empty state (for use within tables) */
    .table-empty-state {
      padding: 16px;
    }

    /* ===== Mobile Responsiveness ===== */

    @media (max-width: 768px) {
      .container {
        padding: 16px;
      }

      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
      }

      .header h1 {
        font-size: 20px;
      }

      .nav-tabs {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        margin-left: -16px;
        margin-right: -16px;
        padding-left: 16px;
        padding-right: 16px;
      }

      .nav-tabs::-webkit-scrollbar {
        display: none;
      }

      .nav-tab {
        white-space: nowrap;
        flex-shrink: 0;
      }

      .metrics-row {
        grid-template-columns: repeat(2, 1fr);
      }

      .grid {
        grid-template-columns: 1fr !important;
      }

      .history-controls {
        flex-direction: column;
        gap: 8px;
      }

      .history-search,
      .history-filter {
        width: 100%;
      }

      /* Transform tables to cards on mobile */
      .history-table thead {
        display: none;
      }

      .history-table tbody {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .history-table tr {
        display: flex;
        flex-direction: column;
        padding: 16px;
        background: var(--bg-tertiary);
        border-radius: 8px;
        border: 1px solid var(--border-color);
        gap: 8px;
      }

      .history-table td {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0;
        border: none;
      }

      .history-table td::before {
        content: attr(data-label);
        font-weight: 600;
        color: var(--text-muted);
        font-size: 12px;
        text-transform: uppercase;
      }

      .pagination {
        flex-direction: column;
        gap: 12px;
      }

      .pagination-controls {
        justify-content: center;
      }

      /* Conversation mobile styles */
      .conversation-message .message-avatar {
        display: none;
      }

      .conversation-message .message-container {
        flex-direction: column;
      }

      .conversation-message .message-bubble {
        max-width: 100% !important;
        padding: 12px !important;
      }

      .conversation-message[data-author="user"] .message-bubble {
        border-left-width: 4px;
      }

      .conversation-message[data-author="ai"] .message-bubble {
        border-left-width: 4px;
      }

      .conversation-message .metadata-badges {
        opacity: 1 !important;
      }

      .conversation-message .message-bubble {
        padding: 16px !important;
      }
    }

    /* Remove border from last conversation message */
    .conversation-message:last-child {
      border-bottom: none !important;
      margin-bottom: 0 !important;
      padding-bottom: 0 !important;
    }

    @media (max-width: 480px) {
      .metrics-row {
        grid-template-columns: 1fr;
      }

      .histogram-chart {
        min-height: 120px;
      }

      .histogram-legend {
        flex-wrap: wrap;
        gap: 8px;
      }
    }

    /* ===== Micro-interactions ===== */

    .card {
      transition: border-color 0.2s ease;
    }

    .card:hover {
      border-color: var(--border-color);
    }

    .trace-row,
    .history-table tr {
      transition: background-color 0.15s ease;
    }

    /* New trace animation */
    @keyframes slide-in {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .trace-row--new {
      animation: slide-in 0.3s ease-out;
    }

    /* Button hover states */
    .pagination-button:not(:disabled):hover,
    .pagination-page:not(.active):hover {
      background: var(--border-color);
      transform: translateY(-1px);
    }

    .pagination-button:active,
    .pagination-page:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to main content</a>
  <div id="root">
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;color:#8b949e;">
      <div style="text-align:center;">
        <div style="font-size:24px;margin-bottom:16px;">Loading Dashboard...</div>
        <div style="font-size:14px;">If this message persists, check browser console for errors.</div>
      </div>
    </div>
  </div>
  <noscript>
    <div style="padding:24px;color:#f85149;background:#0d1117;min-height:100vh;">
      JavaScript is required to run the AutomatosX Dashboard.
    </div>
  </noscript>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useCallback, useRef } = React;

    // Format duration in human readable form
    function formatDuration(ms) {
      if (ms < 1000) return \`\${ms}ms\`;
      if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
      if (ms < 3600000) return \`\${Math.floor(ms / 60000)}m \${Math.floor((ms % 60000) / 1000)}s\`;
      return \`\${Math.floor(ms / 3600000)}h \${Math.floor((ms % 3600000) / 60000)}m\`;
    }

    // Format relative time
    function formatRelativeTime(timestamp) {
      const now = Date.now();
      const diff = now - new Date(timestamp).getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return \`\${Math.floor(diff / 60000)}m ago\`;
      if (diff < 86400000) return \`\${Math.floor(diff / 3600000)}h ago\`;
      return new Date(timestamp).toLocaleDateString();
    }

    // Status icon component
    function StatusIcon({ status }) {
      const icons = {
        success: '\\u2713',
        running: '\\u25cf',
        failure: '\\u2717',
      };
      return <span className={\`trace-status-icon \${status}\`}>{icons[status] || '\\u25cb'}</span>;
    }

    // Get event type category for styling
    function getEventCategory(type) {
      if (type.startsWith('run.')) return 'run';
      if (type.startsWith('step.')) return 'step';
      if (type.startsWith('tool.')) return 'tool';
      if (type.startsWith('decision.')) return 'decision';
      if (type.startsWith('discussion.')) return 'discussion';
      if (type.startsWith('memory.')) return 'memory';
      if (type === 'error') return 'error';
      return 'step';
    }

    // Get icon for event type
    function getEventIcon(type) {
      const icons = {
        'run.start': '\\u25B6',
        'run.end': '\\u25A0',
        'step.start': '\\u2192',
        'step.execute': '\\u2699',
        'step.end': '\\u2713',
        'tool.invoke': '\\u2692',
        'tool.result': '\\u2713',
        'decision.routing': '\\u2194',
        // Discussion events (Phase 2)
        'discussion.start': '\\u25AC',
        'discussion.round': '\\u21BB',     // ↻ Round indicator
        'discussion.provider': '\\u25C6',  // ◆ Provider response
        'discussion.consensus': '\\u2726', // ✦ Consensus reached
        'discussion.end': '\\u2713',
        // Workflow/Agent step events
        'workflow.start': '\\u25B6',
        'workflow.step': '\\u2699',        // ⚙ Step execution
        'workflow.end': '\\u25A0',
        'memory.write': '\\u270E',
        'memory.read': '\\u25B7',
        'error': '\\u26A0',
      };
      return icons[type] || '\\u25CF';
    }

    // Get icon for step type
    function getStepIcon(type) {
      const icons = {
        prompt: '\\u25AC',
        tool: '\\u2692',
        conditional: '\\u2753',
        loop: '\\u21BA',
        parallel: '\\u22EF',
        discuss: '\\u2726',
        delegate: '\\u21AA',
      };
      return icons[type] || '\\u25CF';
    }

    // Skeleton loading component
    function Skeleton({ variant = 'text', width, height, style = {} }) {
      const baseStyles = {
        text: { height: height || '1em', width: width || '100%' },
        rect: { height: height || '80px', width: width || '100%' },
        circle: { height: height || '40px', width: width || '40px', borderRadius: '50%' },
      };

      return (
        <div
          className="skeleton"
          style={{ ...baseStyles[variant], ...style }}
          role="status"
          aria-label="Loading"
        />
      );
    }

    // Empty state component with icon and CTA
    function EmptyState({ icon, title, description, actionLabel, onAction }) {
      return (
        <div className="empty-state" role="status">
          <div className="empty-state-icon">{icon}</div>
          <div className="empty-state-title">{title}</div>
          <div className="empty-state-description">{description}</div>
          {actionLabel && onAction && (
            <button className="empty-state-action" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      );
    }

    // Dashboard skeleton for initial loading
    function DashboardSkeleton() {
      return (
        <div className="container" aria-busy="true" aria-live="polite">
          <div className="header" style={{ marginBottom: '16px' }}>
            <Skeleton variant="text" width="200px" height="32px" />
            <Skeleton variant="text" width="120px" height="24px" />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} variant="rect" width="100px" height="36px" style={{ borderRadius: '4px' }} />
            ))}
          </div>

          <div className="metrics-row">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="metric-card">
                <Skeleton variant="text" width="60px" height="32px" style={{ margin: '0 auto 8px' }} />
                <Skeleton variant="text" width="100px" height="14px" style={{ margin: '0 auto' }} />
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: '16px' }}>
            <Skeleton variant="rect" height="200px" />
          </div>

          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            <div className="card">
              <Skeleton variant="text" width="120px" height="20px" style={{ marginBottom: '16px' }} />
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton-row">
                  <Skeleton variant="text" width="80px" />
                  <Skeleton variant="text" />
                  <Skeleton variant="text" width="60px" />
                </div>
              ))}
            </div>
            <div className="card">
              <Skeleton variant="text" width="120px" height="20px" style={{ marginBottom: '16px' }} />
              <Skeleton variant="rect" height="100px" />
            </div>
          </div>
        </div>
      );
    }

    // Live indicator component
    function LiveIndicator({ lastUpdate, refreshInterval }) {
      const [countdown, setCountdown] = useState(refreshInterval / 1000);

      useEffect(() => {
        const timer = setInterval(() => {
          const elapsed = Date.now() - lastUpdate;
          const remaining = Math.max(0, Math.ceil((refreshInterval - elapsed) / 1000));
          setCountdown(remaining);
        }, 100);
        return () => clearInterval(timer);
      }, [lastUpdate, refreshInterval]);

      return (
        <div className="live-indicator">
          <span className="live-dot"></span>
          <span>LIVE</span>
          <span className="refresh-countdown">({countdown}s)</span>
        </div>
      );
    }

    // Active processes component
    function ActiveProcesses({ traces, sessions }) {
      const runningTraces = traces.filter(t => t.status === 'running');
      const activeSessions = sessions.filter(s => s.status === 'active');
      const totalActive = runningTraces.length + activeSessions.length;

      if (totalActive === 0) {
        return (
          <div className="active-processes">
            <div className="active-processes-header">
              <span className="active-processes-title">
                {'\\u25B6'} Active Processes
                <span className="active-count">0</span>
              </span>
            </div>
            <div className="no-processes">
              No active processes. Start a workflow or agent to see activity here.
            </div>
          </div>
        );
      }

      return (
        <div className="active-processes">
          <div className="active-processes-header">
            <span className="active-processes-title">
              {'\\u25B6'} Active Processes
              <span className="active-count">{totalActive}</span>
            </span>
          </div>
          <div className="process-list">
            {runningTraces.map(trace => (
              <div key={trace.traceId} className="process-item running">
                <div className="process-icon">{'\\u21BB'}</div>
                <div className="process-details">
                  <div className="process-name">{trace.name || \`Trace \${trace.traceId.slice(0, 8)}\`}</div>
                  <div className="process-meta">
                    {trace.eventCount} events {'\\u2022'} Started {formatRelativeTime(trace.startTime)}
                  </div>
                </div>
                <div className="process-duration">
                  {formatDuration(Date.now() - new Date(trace.startTime).getTime())}
                </div>
              </div>
            ))}
            {activeSessions.map(session => (
              <div key={session.sessionId} className="process-item running">
                <div className="process-icon">{'\\u2261'}</div>
                <div className="process-details">
                  <div className="process-name">{session.task || \`Session \${session.sessionId.slice(0, 8)}\`}</div>
                  <div className="process-meta">
                    {session.participantCount} participants {'\\u2022'} {session.initiator}
                  </div>
                </div>
                <div className="process-duration">
                  {formatRelativeTime(session.createdAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Timeline component for trace detail - improved design with grouped events
    function TraceTimeline({ timeline }) {
      const [expandedEvents, setExpandedEvents] = useState({});

      if (!timeline || timeline.length === 0) {
        return <div className="empty-state">No events recorded</div>;
      }

      // Toggle event expansion
      const toggleExpand = (eventId) => {
        setExpandedEvents(prev => ({
          ...prev,
          [eventId]: !prev[eventId]
        }));
      };

      // Get first event timestamp for relative time calculation
      const firstTimestamp = new Date(timeline[0].timestamp).getTime();

      // Helper to format relative time
      const formatRelativeTime = (timestamp) => {
        const elapsed = new Date(timestamp).getTime() - firstTimestamp;
        if (elapsed < 1000) return '+0s';
        if (elapsed < 60000) return \`+\${(elapsed / 1000).toFixed(1)}s\`;
        if (elapsed < 3600000) return \`+\${(elapsed / 60000).toFixed(1)}m\`;
        return \`+\${(elapsed / 3600000).toFixed(1)}h\`;
      };

      // Helper to format duration nicely
      const formatDuration = (ms) => {
        if (!ms) return null;
        if (ms < 1000) return \`\${ms}ms\`;
        if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
        return \`\${(ms / 60000).toFixed(1)}m\`;
      };

      // Group paired events (start/end)
      const groupedEvents = [];
      const processedIds = new Set();

      timeline.forEach((event, index) => {
        if (processedIds.has(event.eventId)) return;

        const type = event.type;
        const isStartEvent = type.endsWith('.start');

        if (isStartEvent) {
          // Find matching end event
          const baseType = type.replace('.start', '');
          const endEvent = timeline.find((e, i) =>
            i > index &&
            e.type === \`\${baseType}.end\` &&
            !processedIds.has(e.eventId)
          );

          if (endEvent) {
            processedIds.add(event.eventId);
            processedIds.add(endEvent.eventId);
            groupedEvents.push({
              type: 'paired',
              startEvent: event,
              endEvent: endEvent,
              baseType,
              duration: endEvent.durationMs || (new Date(endEvent.timestamp).getTime() - new Date(event.timestamp).getTime())
            });
          } else {
            // No matching end - show as running
            processedIds.add(event.eventId);
            groupedEvents.push({
              type: 'running',
              event: event,
              baseType
            });
          }
        } else if (!type.endsWith('.end')) {
          // Standalone event (not start/end pair)
          processedIds.add(event.eventId);
          groupedEvents.push({
            type: 'standalone',
            event: event
          });
        }
      });

      // Helper to get event title
      const getEventTitle = (baseType, event) => {
        if (baseType === 'run' || event?.type?.startsWith('run.')) return 'Execution';
        if (baseType === 'step' || event?.type?.startsWith('step.')) return 'Step';
        if (baseType === 'workflow' || event?.type?.startsWith('workflow.')) return 'Workflow';
        if (baseType === 'discussion' || event?.type?.startsWith('discussion.')) return 'Discussion';
        if (baseType === 'tool' || event?.type?.startsWith('tool.')) return 'Tool Call';
        if (baseType === 'memory' || event?.type?.startsWith('memory.')) return 'Memory';
        if (baseType === 'decision' || event?.type?.startsWith('decision.')) return 'Decision';
        return baseType || event?.type || 'Event';
      };

      // Helper to get context info
      const getContextInfo = (event) => {
        const ctx = event?.context || {};
        const payload = event?.payload || {};
        const type = event?.type || '';
        const parts = [];

        if (ctx.provider || ctx.providerId) parts.push(ctx.provider || ctx.providerId);
        if (ctx.agentId || payload.agentId) parts.push(ctx.agentId || payload.agentId);
        if (payload.pattern) parts.push(payload.pattern);
        if (payload.providers && Array.isArray(payload.providers)) {
          parts.push(\`\${payload.providers.length} providers\`);
        }
        if (payload.stepName) parts.push(payload.stepName);

        // Phase 2: Discussion-specific context info
        if (type === 'discussion.round' && payload.roundNumber !== undefined) {
          parts.push(\`Round \${payload.roundNumber}\`);
          if (payload.responseCount !== undefined) parts.push(\`\${payload.responseCount} responses\`);
        }
        if (type === 'discussion.provider' && payload.providerId) {
          if (!parts.includes(payload.providerId)) parts.push(payload.providerId);
          if (payload.success === false) parts.push('failed');
        }
        if (type === 'discussion.consensus') {
          if (payload.method) parts.push(payload.method);
          if (payload.confidence !== undefined) parts.push(\`\${(payload.confidence * 100).toFixed(0)}% confidence\`);
        }

        return parts.length > 0 ? parts.join(' • ') : null;
      };

      // Helper to get status from end event
      const getStatus = (endEvent) => {
        if (!endEvent) return 'running';
        if (endEvent.status) return endEvent.status;
        if (endEvent.payload?.success === true) return 'success';
        if (endEvent.payload?.success === false) return 'failure';
        return 'success';
      };

      // Render expanded details
      const renderDetails = (startEvent, endEvent, eventType) => {
        const payload = { ...(startEvent?.payload || {}), ...(endEvent?.payload || {}) };
        const context = { ...(startEvent?.context || {}), ...(endEvent?.context || {}) };
        const type = eventType || startEvent?.type || endEvent?.type || '';

        const detailItems = [];

        // Add important payload fields
        if (payload.topic) detailItems.push({ label: 'Topic', value: payload.topic.substring(0, 200) + (payload.topic.length > 200 ? '...' : '') });
        if (payload.pattern) detailItems.push({ label: 'Pattern', value: payload.pattern });
        if (payload.roundCount) detailItems.push({ label: 'Rounds', value: payload.roundCount });
        if (payload.providers) detailItems.push({ label: 'Providers', value: Array.isArray(payload.providers) ? payload.providers.join(', ') : payload.providers });
        if (context.provider) detailItems.push({ label: 'Provider', value: context.provider });
        if (context.model) detailItems.push({ label: 'Model', value: context.model });
        if (payload.command) detailItems.push({ label: 'Command', value: payload.command });

        // Phase 2: Discussion-specific event details
        // discussion.round event details
        if (payload.roundNumber) detailItems.push({ label: 'Round', value: \`#\${payload.roundNumber}\` });
        if (payload.responseCount !== undefined) detailItems.push({ label: 'Responses', value: payload.responseCount });
        if (payload.participatingProviders && Array.isArray(payload.participatingProviders)) {
          detailItems.push({ label: 'Participating', value: payload.participatingProviders.join(', ') });
        }
        if (payload.failedProviders && Array.isArray(payload.failedProviders) && payload.failedProviders.length > 0) {
          detailItems.push({ label: 'Failed', value: payload.failedProviders.join(', '), isError: true });
        }

        // discussion.provider event details
        if (payload.providerId && !context.providerId) detailItems.push({ label: 'Provider', value: payload.providerId });
        if (context.providerId) detailItems.push({ label: 'Provider', value: context.providerId });
        if (payload.tokenCount !== undefined) detailItems.push({ label: 'Tokens', value: payload.tokenCount.toLocaleString() });
        if (payload.role) detailItems.push({ label: 'Role', value: payload.role });

        // discussion.consensus event details
        if (payload.method) detailItems.push({ label: 'Method', value: payload.method });
        if (payload.confidence !== undefined) detailItems.push({ label: 'Confidence', value: \`\${(payload.confidence * 100).toFixed(0)}%\` });
        if (payload.winner) detailItems.push({ label: 'Winner', value: payload.winner });
        if (payload.votes && typeof payload.votes === 'object') {
          const voteStr = Object.entries(payload.votes).map(([k, v]) => \`\${k}: \${v}\`).join(', ');
          detailItems.push({ label: 'Votes', value: voteStr });
        }

        // workflow.step event details (Agent execution steps)
        if (type === 'workflow.step') {
          if (payload.stepId) detailItems.push({ label: 'Step', value: payload.stepId });
          if (payload.stepIndex !== undefined) detailItems.push({ label: 'Index', value: \`#\${payload.stepIndex + 1}\` });
          if (payload.provider) detailItems.push({ label: 'Provider', value: payload.provider });
          if (context.tokenUsage) {
            const usage = context.tokenUsage;
            if (usage.total) detailItems.push({ label: 'Tokens', value: usage.total.toLocaleString() });
            else if (usage.input || usage.output) {
              detailItems.push({ label: 'Tokens', value: \`\${(usage.input || 0).toLocaleString()} in / \${(usage.output || 0).toLocaleString()} out\` });
            }
          }
        }

        // Agent-specific details (from enriched run.end payload)
        if (payload.agentDisplayName) detailItems.push({ label: 'Agent', value: payload.agentDisplayName });
        if (payload.inputTask && !payload.topic) {
          const taskPreview = String(payload.inputTask).substring(0, 150);
          detailItems.push({ label: 'Task', value: taskPreview + (payload.inputTask.length > 150 ? '...' : '') });
        }
        if (payload.tokenUsage && typeof payload.tokenUsage === 'object') {
          const usage = payload.tokenUsage;
          if (usage.total) detailItems.push({ label: 'Tokens', value: usage.total.toLocaleString() });
          else if (usage.input || usage.output) {
            detailItems.push({ label: 'Tokens', value: \`\${(usage.input || 0).toLocaleString()} in / \${(usage.output || 0).toLocaleString()} out\` });
          }
        }

        // Research-specific details
        if (payload.tool?.startsWith('research')) {
          if (payload.query) {
            const queryPreview = String(payload.query).substring(0, 150);
            detailItems.push({ label: 'Query', value: queryPreview + (payload.query.length > 150 ? '...' : '') });
          }
          if (payload.sourceCount !== undefined) detailItems.push({ label: 'Sources', value: payload.sourceCount });
          if (payload.confidence !== undefined) detailItems.push({ label: 'Confidence', value: \`\${(payload.confidence * 100).toFixed(0)}%\` });
          if (payload.url) detailItems.push({ label: 'URL', value: payload.url });
          if (payload.title) detailItems.push({ label: 'Title', value: payload.title });
          if (payload.reliability) detailItems.push({ label: 'Reliability', value: payload.reliability });
          if (payload.contentLength) detailItems.push({ label: 'Content', value: \`\${payload.contentLength.toLocaleString()} chars\` });
        }

        // Review-specific details
        if (payload.tool?.startsWith('review')) {
          if (payload.focus) detailItems.push({ label: 'Focus', value: payload.focus });
          if (payload.summary?.verdict) detailItems.push({ label: 'Verdict', value: payload.summary.verdict });
          if (payload.summary?.healthScore !== undefined) {
            detailItems.push({ label: 'Health', value: \`\${(payload.summary.healthScore * 100).toFixed(0)}%\` });
          }
          if (payload.summary?.bySeverity) {
            const sev = payload.summary.bySeverity;
            const parts = [];
            if (sev.critical) parts.push(\`\${sev.critical} critical\`);
            if (sev.warning) parts.push(\`\${sev.warning} warning\`);
            if (sev.suggestion) parts.push(\`\${sev.suggestion} suggestion\`);
            if (sev.note) parts.push(\`\${sev.note} note\`);
            if (parts.length > 0) detailItems.push({ label: 'Issues', value: parts.join(', ') });
          }
          if (payload.filesReviewedCount !== undefined) detailItems.push({ label: 'Files', value: payload.filesReviewedCount });
          if (payload.linesAnalyzed !== undefined) detailItems.push({ label: 'Lines', value: payload.linesAnalyzed.toLocaleString() });
          if (payload.providerId) detailItems.push({ label: 'Provider', value: payload.providerId });
        }

        if (payload.error) detailItems.push({ label: 'Error', value: typeof payload.error === 'object' ? payload.error.message : payload.error, isError: true });

        if (detailItems.length === 0) return null;

        return (
          <div style={{
            marginTop: 8,
            padding: '10px 12px',
            background: 'var(--bg-tertiary)',
            borderRadius: 6,
            fontSize: 12
          }}>
            {detailItems.map((item, idx) => (
              <div key={idx} style={{
                display: 'flex',
                marginBottom: idx < detailItems.length - 1 ? 6 : 0,
                color: item.isError ? 'var(--accent-red)' : 'inherit'
              }}>
                <span style={{ color: 'var(--text-muted)', minWidth: 80, flexShrink: 0 }}>{item.label}:</span>
                <span style={{ color: item.isError ? 'var(--accent-red)' : 'var(--text-secondary)', wordBreak: 'break-word' }}>{item.value}</span>
              </div>
            ))}
          </div>
        );
      };

      return (
        <div className="timeline-container">
          {/* Summary bar */}
          <div style={{
            display: 'flex',
            gap: 16,
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            flexWrap: 'wrap'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{groupedEvents.length}</strong> events
            </span>
            {timeline.length > 0 && timeline[timeline.length - 1].timestamp && (
              <span style={{ color: 'var(--text-muted)' }}>
                Total: <strong style={{ color: 'var(--text-primary)' }}>
                  {formatDuration(new Date(timeline[timeline.length - 1].timestamp).getTime() - firstTimestamp) || '< 1s'}
                </strong>
              </span>
            )}
            <span style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--accent-green)' }}>●</span> {groupedEvents.filter(g => g.type === 'paired' && getStatus(g.endEvent) === 'success').length} success
            </span>
            {groupedEvents.filter(g => g.type === 'paired' && getStatus(g.endEvent) === 'failure').length > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-red)' }}>●</span> {groupedEvents.filter(g => g.type === 'paired' && getStatus(g.endEvent) === 'failure').length} failed
              </span>
            )}
            {groupedEvents.filter(g => g.type === 'running').length > 0 && (
              <span style={{ color: 'var(--text-muted)' }}>
                <span style={{ color: 'var(--accent-blue)' }}>●</span> {groupedEvents.filter(g => g.type === 'running').length} running
              </span>
            )}
          </div>

          {/* Event list */}
          {groupedEvents.map((group, index) => {
            const isPaired = group.type === 'paired';
            const isRunning = group.type === 'running';
            const event = isPaired ? group.startEvent : (isRunning ? group.event : group.event);
            const endEvent = isPaired ? group.endEvent : null;
            const eventId = event.eventId || index;
            const isExpanded = expandedEvents[eventId];

            const baseType = isPaired || isRunning ? group.baseType : getEventCategory(event.type);
            const title = getEventTitle(baseType, event);
            const contextInfo = getContextInfo(event) || getContextInfo(endEvent);
            const status = isPaired ? getStatus(endEvent) : (isRunning ? 'running' : getStatus(event));
            const duration = isPaired ? group.duration : event.durationMs;
            const hasDetails = event.context || event.payload || (endEvent && (endEvent.context || endEvent.payload));

            const statusColors = {
              success: 'var(--accent-green)',
              failure: 'var(--accent-red)',
              running: 'var(--accent-blue)'
            };

            const statusIcons = {
              success: '\\u2713',
              failure: '\\u2717',
              running: '\\u25CF'
            };

            return (
              <div
                key={eventId}
                className={\`timeline-event \${baseType}\`}
                onClick={() => hasDetails && toggleExpand(eventId)}
                style={{ cursor: hasDetails ? 'pointer' : 'default' }}
              >
                <div className="timeline-dot-wrapper">
                  <div
                    className={\`timeline-dot \${baseType}\`}
                    style={{
                      borderColor: statusColors[status],
                      boxShadow: \`0 0 0 2px \${statusColors[status]}40\`
                    }}
                  >
                    {getEventIcon(event.type)}
                  </div>
                </div>
                <div className="timeline-content" style={{ paddingBottom: 4 }}>
                  <div className="timeline-header">
                    <div className="timeline-title">
                      <span className="timeline-title-main" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {title}
                        <span style={{
                          color: statusColors[status],
                          fontSize: 11,
                          fontWeight: 500
                        }}>
                          {statusIcons[status]} {status === 'running' ? 'In Progress' : status}
                        </span>
                      </span>
                      {contextInfo && (
                        <span className="timeline-title-sub" style={{ marginTop: 2 }}>{contextInfo}</span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div className="timeline-time">{formatRelativeTime(event.timestamp)}</div>
                      {duration && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {formatDuration(duration)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expandable details */}
                  {hasDetails && (
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 4
                    }}>
                      {isExpanded ? '\\u25BC Hide details' : '\\u25B6 Show details'}
                    </div>
                  )}

                  {isExpanded && renderDetails(event, endEvent, baseType)}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // Workflow DAG component
    function WorkflowDAG({ dag }) {
      if (!dag || !dag.nodes || dag.nodes.length === 0) {
        return <div className="empty-state">No workflow steps defined</div>;
      }

      return (
        <div className="dag-container">
          {dag.nodes.map((node, index) => (
            <React.Fragment key={node.id}>
              <div className={\`dag-node \${node.type}\`}>
                <div className="dag-node-icon">
                  {getStepIcon(node.type)}
                </div>
                <div className="dag-node-content">
                  <div className="dag-node-name">{node.name}</div>
                  <div className="dag-node-type">{node.type}</div>
                </div>
              </div>
              {index < dag.nodes.length - 1 && (
                <div className="dag-connector"></div>
              )}
            </React.Fragment>
          ))}
        </div>
      );
    }

    // Discussion Insights component (Phase 3)
    // Shows provider participation chart and round timeline for discussion traces
    function DiscussionInsights({ trace }) {
      // Extract discussion events from timeline
      const providerEvents = (trace.timeline || []).filter(e => e.type === 'discussion.provider');
      const roundEvents = (trace.timeline || []).filter(e => e.type === 'discussion.round');
      const consensusEvents = (trace.timeline || []).filter(e => e.type === 'discussion.consensus');

      // Build provider stats
      const providerStats = {};
      providerEvents.forEach(event => {
        const providerId = event.payload?.providerId || event.context?.providerId || 'unknown';
        if (!providerStats[providerId]) {
          providerStats[providerId] = { success: 0, failure: 0, totalDuration: 0, totalTokens: 0, rounds: [] };
        }
        if (event.status === 'success' || event.payload?.success) {
          providerStats[providerId].success++;
        } else {
          providerStats[providerId].failure++;
        }
        providerStats[providerId].totalDuration += event.durationMs || event.payload?.durationMs || 0;
        providerStats[providerId].totalTokens += event.payload?.tokenCount || 0;
        const roundNum = event.payload?.roundNumber || 0;
        if (!providerStats[providerId].rounds.includes(roundNum)) {
          providerStats[providerId].rounds.push(roundNum);
        }
      });

      const providers = Object.keys(providerStats);
      const maxResponses = Math.max(...providers.map(p => providerStats[p].success + providerStats[p].failure), 1);

      // Build round data for timeline
      const rounds = roundEvents.map(event => ({
        roundNumber: event.payload?.roundNumber || 0,
        totalRounds: event.payload?.totalRounds,
        providers: event.payload?.participatingProviders || [],
        failedProviders: event.payload?.failedProviders || [],
        responseCount: event.payload?.responseCount || 0,
        durationMs: event.durationMs || event.payload?.durationMs || 0,
        timestamp: event.timestamp,
      })).sort((a, b) => a.roundNumber - b.roundNumber);

      // Get consensus info
      const consensus = consensusEvents.length > 0 ? {
        method: consensusEvents[0].payload?.consensusMethod,
        confidence: consensusEvents[0].payload?.confidence,
        votes: consensusEvents[0].payload?.votes,
        winner: consensusEvents[0].payload?.winner,
        durationMs: consensusEvents[0].durationMs || consensusEvents[0].payload?.durationMs || 0,
      } : null;

      // Get discussion config from trace input
      const config = {
        pattern: trace.input?.pattern || 'synthesis',
        consensus: trace.input?.consensus || 'synthesis',
        rounds: trace.input?.rounds || 1,
        providers: trace.input?.providers || [],
      };

      if (providers.length === 0 && rounds.length === 0) {
        return null; // No discussion data to show
      }

      const formatDuration = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return \`\${ms}ms\`;
        return \`\${(ms / 1000).toFixed(1)}s\`;
      };

      // Provider colors for charts
      const providerColors = {
        'claude': '#e8b4a0',
        'gemini': '#a0c4e8',
        'grok': '#c4a0e8',
        'codex': '#a0e8b4',
        'opencode': '#e8d4a0',
        'default': '#b0b0b0',
      };

      const getProviderColor = (provider) => {
        const lowered = provider.toLowerCase();
        return providerColors[lowered] || providerColors['default'];
      };

      return (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Discussion Insights</span>
            <span className="card-badge">{providers.length} providers • {rounds.length} rounds</span>
          </div>

          {/* Discussion Overview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 16,
            padding: 16,
            borderBottom: '1px solid var(--border-color)',
          }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Pattern</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{config.pattern}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Consensus</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{config.consensus}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Total Rounds</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{rounds.length || config.rounds}</div>
            </div>
            {consensus && consensus.confidence !== undefined && (
              <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Confidence</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-green)' }}>
                  {(consensus.confidence * 100).toFixed(0)}%
                </div>
              </div>
            )}
          </div>

          {/* Provider Participation Chart */}
          {providers.length > 0 && (
            <div style={{ padding: 16, borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                Provider Participation
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {providers.map(provider => {
                  const stats = providerStats[provider];
                  const total = stats.success + stats.failure;
                  const successRate = total > 0 ? (stats.success / total * 100) : 0;
                  const barWidth = (total / maxResponses) * 100;

                  return (
                    <div key={provider} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Provider name */}
                      <div style={{
                        width: 80,
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--text-primary)',
                        textTransform: 'capitalize',
                      }}>
                        {provider}
                      </div>

                      {/* Bar chart */}
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          flex: 1,
                          height: 24,
                          background: 'var(--bg-tertiary)',
                          borderRadius: 4,
                          overflow: 'hidden',
                          position: 'relative',
                        }}>
                          {/* Success bar */}
                          <div style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            height: '100%',
                            width: \`\${barWidth * (successRate / 100)}%\`,
                            background: getProviderColor(provider),
                            opacity: 0.9,
                            transition: 'width 0.3s ease',
                          }} />
                          {/* Failure bar */}
                          <div style={{
                            position: 'absolute',
                            left: \`\${barWidth * (successRate / 100)}%\`,
                            top: 0,
                            height: '100%',
                            width: \`\${barWidth * ((100 - successRate) / 100)}%\`,
                            background: 'var(--accent-red)',
                            opacity: 0.4,
                            transition: 'width 0.3s ease',
                          }} />
                          {/* Count label */}
                          <div style={{
                            position: 'absolute',
                            left: 8,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            fontSize: 11,
                            fontWeight: 600,
                            color: barWidth > 20 ? 'var(--text-primary)' : 'var(--text-muted)',
                          }}>
                            {stats.success}{stats.failure > 0 && \` / \${stats.failure} failed\`}
                          </div>
                        </div>

                        {/* Stats */}
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          minWidth: 100,
                        }}>
                          {formatDuration(stats.totalDuration)}
                          {stats.totalTokens > 0 && \` • \${stats.totalTokens} tok\`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Round Timeline */}
          {rounds.length > 0 && (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>
                Round Timeline
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8 }}>
                {rounds.map((round, idx) => {
                  const hasFailures = round.failedProviders && round.failedProviders.length > 0;
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: '0 0 auto',
                        minWidth: 160,
                        padding: 12,
                        background: 'var(--bg-tertiary)',
                        borderRadius: 8,
                        border: hasFailures ? '1px solid rgba(248, 81, 73, 0.3)' : '1px solid var(--border-color)',
                      }}
                    >
                      {/* Round header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}>
                        <span style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}>
                          Round {round.roundNumber}
                        </span>
                        <span style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          background: 'var(--bg-secondary)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}>
                          {formatDuration(round.durationMs)}
                        </span>
                      </div>

                      {/* Provider chips */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {round.providers.map(p => (
                          <span
                            key={p}
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: getProviderColor(p),
                              color: '#1a1a1a',
                              fontWeight: 500,
                            }}
                          >
                            {p}
                          </span>
                        ))}
                        {round.failedProviders.map(p => (
                          <span
                            key={\`fail-\${p}\`}
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(248, 81, 73, 0.2)',
                              color: 'var(--accent-red)',
                              fontWeight: 500,
                              textDecoration: 'line-through',
                            }}
                          >
                            {p}
                          </span>
                        ))}
                      </div>

                      {/* Response count */}
                      {round.responseCount > 0 && (
                        <div style={{
                          marginTop: 8,
                          fontSize: 11,
                          color: 'var(--text-muted)',
                        }}>
                          {round.responseCount} response{round.responseCount !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Consensus card */}
                {consensus && (
                  <div
                    style={{
                      flex: '0 0 auto',
                      minWidth: 160,
                      padding: 12,
                      background: 'rgba(63, 185, 80, 0.1)',
                      borderRadius: 8,
                      border: '1px solid rgba(63, 185, 80, 0.3)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--accent-green)',
                      }}>
                        ✦ Consensus
                      </span>
                      <span style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        background: 'var(--bg-secondary)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        {formatDuration(consensus.durationMs)}
                      </span>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Method: <strong>{consensus.method || 'synthesis'}</strong>
                    </div>

                    {consensus.confidence !== undefined && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Confidence: <strong>{(consensus.confidence * 100).toFixed(0)}%</strong>
                      </div>
                    )}

                    {consensus.winner && (
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        Winner: <strong>{consensus.winner}</strong>
                      </div>
                    )}

                    {consensus.votes && Object.keys(consensus.votes).length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {Object.entries(consensus.votes).map(([option, count]) => (
                          <span
                            key={option}
                            style={{
                              fontSize: 10,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'var(--bg-secondary)',
                              color: 'var(--text-muted)',
                            }}
                          >
                            {option}: {count}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // Trace detail view
    function TraceDetail({ traceId, onBack }) {
      const [trace, setTrace] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [activeProviderTab, setActiveProviderTab] = useState('');

      useEffect(() => {
        async function fetchTrace() {
          try {
            const response = await fetch(\`/api/traces/\${traceId}\`);
            const result = await response.json();
            if (result.success) {
              setTrace(result.data);
            } else {
              setError(result.error || 'Failed to fetch trace');
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
        fetchTrace();
        // Auto-refresh for running traces
        const interval = setInterval(fetchTrace, 2000);
        return () => clearInterval(interval);
      }, [traceId]);

      // Build conversation pairs grouped by provider
      const buildConversationGroups = (traceData) => {
        if (!traceData) return [];
        const groups = [];

        // For 'call' command: single input/output pair
        if (traceData.commandType === 'call') {
          const providerName = traceData.provider || 'Provider';
          groups.push({
            provider: providerName,
            model: traceData.model,
            exchanges: [{
              input: traceData.input?.prompt,
              output: traceData.output?.response,
              latencyMs: traceData.output?.latencyMs,
              usage: traceData.output?.usage
            }]
          });
        }
        // For 'discuss' command: topic as input, responses grouped by provider with multi-round support
        else if (traceData.commandType === 'discuss') {
          // Get the discussion topic
          const topic = traceData.input?.topic;

          // Use providerConversations for real prompt/response content (preferred)
          // Falls back to output.responses if providerConversations not available
          if (traceData.providerConversations && traceData.providerConversations.length > 0) {
            // Group by provider
            const providerMap = {};
            traceData.providerConversations.forEach(conv => {
              if (!providerMap[conv.provider]) {
                providerMap[conv.provider] = [];
              }
              providerMap[conv.provider].push(conv);
            });

            // Build exchanges for each provider
            Object.entries(providerMap).forEach(([provider, conversations]) => {
              const exchanges = [];
              // Sort by round then timestamp
              const sorted = conversations.sort((a, b) => {
                if (a.round !== b.round) return a.round - b.round;
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
              });

              sorted.forEach((conv, idx) => {
                // Add the actual prompt
                if (conv.prompt) {
                  exchanges.push({
                    input: conv.prompt,
                    output: null,
                    roundLabel: \`Ask \${conv.round}\`
                  });
                }
                // Add the response
                if (conv.content) {
                  exchanges.push({
                    input: null,
                    output: conv.content,
                    latencyMs: conv.durationMs,
                    roundLabel: \`Reply \${conv.round}\`
                  });
                }
              });

              if (exchanges.length > 0) {
                groups.push({ provider, exchanges });
              }
            });
          }
          // Fallback: use output.responses (legacy format)
          else {
            const responses = traceData.output?.responses;
            if (responses && typeof responses === 'object') {
              Object.entries(responses).forEach(([provider, providerResponses]) => {
                const exchanges = [];

                // Handle both array (multi-round) and string (single response) formats
                const responseArray = Array.isArray(providerResponses)
                  ? providerResponses
                  : [providerResponses];

                responseArray.forEach((response, roundIndex) => {
                  const roundNum = roundIndex + 1;

                  // Add the prompt/ask for this round
                  if (roundNum === 1) {
                    // Round 1: The original topic
                    exchanges.push({
                      input: topic || 'Discussion topic',
                      output: null,
                      roundLabel: \`Ask \${roundNum}\`
                    });
                  } else {
                    // Rounds 2+: Cross-discussion prompt
                    exchanges.push({
                      input: \`Round \${roundNum}: Respond to other providers' perspectives from the previous round.\`,
                      output: null,
                      roundLabel: \`Ask \${roundNum}\`
                    });
                  }

                  // Add the response/reply for this round
                  if (response) {
                    exchanges.push({
                      input: null,
                      output: response,
                      roundLabel: \`Reply \${roundNum}\`
                    });
                  }
                });

                groups.push({
                  provider: provider,
                  exchanges
                });
              });
            }
          }

          // Show synthesis/consensus if available
          const synthesisText = traceData.output?.synthesis;
          const consensusData = traceData.output?.consensus;

          if (synthesisText || consensusData) {
            // Build consensus metadata line
            let metadataLine = '';
            if (consensusData && typeof consensusData === 'object') {
              const parts = [];
              if (consensusData.method) parts.push(\`Method: \${consensusData.method}\`);
              if (consensusData.synthesizer) parts.push(\`Synthesizer: \${consensusData.synthesizer}\`);
              if (consensusData.agreementScore !== undefined) {
                parts.push(\`Agreement: \${(consensusData.agreementScore * 100).toFixed(0)}%\`);
              }
              if (parts.length > 0) metadataLine = parts.join(' • ');
            }

            // Use synthesis text, or fall back to metadata description
            const displayText = synthesisText || (metadataLine ? \`[\${metadataLine}]\` : 'Consensus reached');

            groups.push({
              provider: 'Consensus',
              consensusMetadata: metadataLine,
              exchanges: [{
                input: 'Final synthesis of all perspectives',
                output: displayText,
                roundLabel: 'Synthesis'
              }]
            });
          }
        }
        // For 'agent' command: task as initial input, then workflow steps
        else if (traceData.commandType === 'agent') {
          // Get trace-level provider as fallback (from run.end finalProvider)
          const traceProvider = traceData.provider || traceData.output?.finalProvider;

          // Initial task - show agent name and provider
          const task = traceData.input?.task;
          if (task) {
            const taskContent = typeof task === 'object' ? task.task || JSON.stringify(task) : task;
            const agentHeader = traceProvider
              ? \`Agent: \${traceData.input?.agentId || 'unknown'} (via \${traceProvider})\`
              : \`Agent: \${traceData.input?.agentId || 'unknown'}\`;
            groups.push({
              provider: agentHeader,
              exchanges: [{ input: taskContent, output: null }]
            });
          }

          // Use agentStepConversations for real LLM content (preferred, from workflow.step events)
          if (traceData.agentStepConversations && traceData.agentStepConversations.length > 0) {
            traceData.agentStepConversations.forEach((step, idx) => {
              // Use step provider, fallback to trace-level provider, then 'unknown'
              const stepProvider = step.provider || traceProvider || 'unknown';
              const exchanges = [];

              // Add response content if available
              if (step.content) {
                exchanges.push({
                  input: null,
                  output: step.content,
                  latencyMs: step.durationMs,
                  success: step.success,
                  error: step.error,
                  tokenCount: step.tokenCount,
                  roundLabel: \`Step \${step.stepIndex + 1}\`
                });
              }

              if (exchanges.length > 0) {
                groups.push({
                  provider: stepProvider,
                  stepId: step.stepId || \`Step \${idx + 1}\`,
                  exchanges
                });
              }
            });
          }
          // Fallback: use workflowSteps (legacy format without LLM content)
          else if (traceData.workflowSteps && traceData.workflowSteps.length > 0) {
            traceData.workflowSteps.forEach((step, idx) => {
              // Use step provider, fallback to trace-level provider, then 'unknown'
              const stepProvider = step.provider || traceProvider || 'unknown';
              const exchanges = [];

              // Add prompt if available
              if (step.prompt) {
                exchanges.push({ input: step.prompt, output: null });
              }

              // Add response/output if available
              const stepOutput = step.response || step.output;
              if (stepOutput) {
                const outputContent = typeof stepOutput === 'object'
                  ? (stepOutput.content || JSON.stringify(stepOutput, null, 2))
                  : stepOutput;
                exchanges.push({
                  input: null,
                  output: outputContent,
                  latencyMs: step.latencyMs || step.durationMs,
                  success: step.success,
                  error: step.error
                });
              }

              if (exchanges.length > 0) {
                groups.push({
                  provider: stepProvider,
                  stepId: step.stepId || \`Step \${idx + 1}\`,
                  model: step.model,
                  exchanges
                });
              }
            });
          }

          // Final result (or use finalContent from run.end payload)
          const result = traceData.output?.result;
          const finalContent = traceData.output?.finalContent;
          const displayResult = result || finalContent;
          if (displayResult) {
            const resultContent = typeof displayResult === 'object'
              ? (displayResult.content || JSON.stringify(displayResult, null, 2))
              : displayResult;
            groups.push({
              provider: 'Final Result',
              exchanges: [{ input: null, output: resultContent }]
            });
          }
        }
        // For 'review' command: show review summary and findings
        else if (traceData.commandType === 'review' || traceData.workflowId?.startsWith('review')) {
          const output = traceData.output || {};
          const input = traceData.input || {};
          const summary = output.summary;
          const comments = output.comments || [];
          const filesReviewed = output.filesReviewed || [];
          // Get provider from output or top-level trace data
          const reviewProvider = output.providerId || traceData.provider;

          // Review parameters
          const paths = input.paths || [];
          const focus = input.focus || 'all';
          const pathsText = Array.isArray(paths) ? paths.join(', ') : paths;

          // Show provider in the header if available
          const headerLabel = reviewProvider
            ? \`Code Review (\${focus}) via \${reviewProvider}\`
            : \`Code Review (\${focus})\`;

          groups.push({
            provider: headerLabel,
            exchanges: [{
              input: \`Review \${pathsText}\`,
              output: null
            }]
          });

          // Summary section
          if (summary) {
            const severityLine = summary.bySeverity
              ? \`Critical: \${summary.bySeverity.critical || 0}, Warning: \${summary.bySeverity.warning || 0}, Suggestion: \${summary.bySeverity.suggestion || 0}, Note: \${summary.bySeverity.note || 0}\`
              : '';
            const summaryText = [
              \`**Verdict**: \${summary.verdict || 'N/A'}\`,
              \`**Health Score**: \${summary.healthScore !== undefined ? (summary.healthScore * 100).toFixed(0) + '%' : 'N/A'}\`,
              severityLine ? \`**Issues**: \${severityLine}\` : '',
              \`**Files Reviewed**: \${output.filesReviewedCount || filesReviewed.length}\`,
              \`**Lines Analyzed**: \${output.linesAnalyzed?.toLocaleString() || 'N/A'}\`,
            ].filter(Boolean).join('\\n');

            groups.push({
              provider: 'Summary',
              exchanges: [{ input: null, output: summaryText }]
            });
          }

          // Issues found
          if (comments.length > 0) {
            const issuesText = comments.map((c, idx) => {
              const severityIcon = c.severity === 'critical' ? '🔴' :
                                   c.severity === 'warning' ? '🟠' :
                                   c.severity === 'suggestion' ? '🟡' : '🔵';
              const location = c.file ? \`\${c.file}\${c.line ? ':' + c.line : ''}\` : '';
              return [
                \`### \${severityIcon} \${c.title || 'Issue ' + (idx + 1)}\`,
                location ? \`**Location**: \${location}\` : '',
                c.category ? \`**Category**: \${c.category}\` : '',
                c.body ? \`\\n\${c.body}\` : '',
                c.suggestion ? \`\\n**Suggestion**: \${c.suggestion}\` : '',
                c.confidence ? \`\\n*Confidence: \${(c.confidence * 100).toFixed(0)}%*\` : '',
              ].filter(Boolean).join('\\n');
            }).join('\\n\\n---\\n\\n');

            groups.push({
              provider: \`Issues Found (\${output.commentCount || comments.length})\`,
              exchanges: [{ input: null, output: issuesText }]
            });
          } else if (output.commentCount === 0) {
            groups.push({
              provider: 'Result',
              exchanges: [{ input: null, output: '✅ No issues found! Code looks good.' }]
            });
          }

          // Files reviewed
          if (filesReviewed.length > 0 && filesReviewed.length <= 20) {
            const filesText = filesReviewed.map((f, idx) => \`\${idx + 1}. \${f}\`).join('\\n');
            groups.push({
              provider: 'Files Reviewed',
              exchanges: [{ input: null, output: filesText }]
            });
          }
        }
        // For 'research' command: query as input, sources and synthesis as output
        else if (traceData.commandType === 'research' || traceData.workflowId?.startsWith('research')) {
          const output = traceData.output || {};
          const query = output.query || traceData.input?.query;
          const sources = output.sources || [];
          const synthesis = output.synthesis;
          const confidence = output.confidence;
          const codeExamples = output.codeExamples || [];

          // Research query
          if (query) {
            groups.push({
              provider: 'Research Query',
              exchanges: [{ input: query, output: null }]
            });
          }

          // Sources found
          if (sources.length > 0) {
            const sourcesText = sources.map((s, idx) => {
              const reliability = s.reliability ? \` [\${s.reliability}]\` : '';
              const relevance = s.relevanceScore ? \` (relevance: \${(s.relevanceScore * 100).toFixed(0)}%)\` : '';
              return \`\${idx + 1}. **\${s.title || 'Untitled'}**\${reliability}\${relevance}\\n   \${s.url || 'No URL'}\\n   \${s.snippet ? s.snippet.substring(0, 200) + (s.snippet.length > 200 ? '...' : '') : ''}\`;
            }).join('\\n\\n');

            groups.push({
              provider: \`Sources (\${sources.length})\`,
              exchanges: [{ input: null, output: sourcesText }]
            });
          }

          // Code examples
          if (codeExamples.length > 0) {
            const codeText = codeExamples.map((code, idx) => {
              const lang = code.language || 'code';
              const content = typeof code === 'string' ? code : (code.content || code.code || JSON.stringify(code));
              return \`**Example \${idx + 1}** (\${lang}):\\n\\\`\\\`\\\`\${lang}\\n\${content}\\n\\\`\\\`\\\`\`;
            }).join('\\n\\n');

            groups.push({
              provider: \`Code Examples (\${codeExamples.length})\`,
              exchanges: [{ input: null, output: codeText }]
            });
          }

          // Synthesis result
          if (synthesis) {
            const confidenceText = confidence !== undefined ? \` (Confidence: \${(confidence * 100).toFixed(0)}%)\` : '';
            groups.push({
              provider: 'Synthesis' + confidenceText,
              exchanges: [{ input: 'Synthesized answer from all sources', output: synthesis }]
            });
          }
        }

        return groups;
      };

      const conversationGroups = buildConversationGroups(trace);

      // Group conversations by provider for tabbed view
      const providerGroups = {};
      conversationGroups.forEach(group => {
        const providerKey = group.provider;
        if (!providerGroups[providerKey]) {
          providerGroups[providerKey] = {
            provider: providerKey,
            model: group.model,
            conversations: []
          };
        }
        // Build ask/reply pairs with round labels
        group.exchanges.forEach(exchange => {
          if (exchange.input) {
            providerGroups[providerKey].conversations.push({
              type: 'ask',
              content: exchange.input,
              latencyMs: exchange.latencyMs,
              usage: exchange.usage,
              roundLabel: exchange.roundLabel  // Pass custom round label
            });
          }
          if (exchange.output) {
            providerGroups[providerKey].conversations.push({
              type: 'reply',
              content: exchange.output,
              latencyMs: exchange.latencyMs,
              usage: exchange.usage,
              error: exchange.error,
              roundLabel: exchange.roundLabel  // Pass custom round label
            });
          }
        });
      });

      const providerKeys = Object.keys(providerGroups);

      // Determine active tab - use first provider if current tab is invalid
      const effectiveActiveTab = (activeProviderTab && providerKeys.includes(activeProviderTab))
        ? activeProviderTab
        : (providerKeys[0] || '');

      // Loading state
      if (loading) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Dashboard
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              Loading trace...
            </div>
          </div>
        );
      }

      // Error state
      if (error) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Dashboard
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: 'var(--accent-red)' }}>{error}</div>
            </div>
          </div>
        );
      }

      // Code block component with syntax highlighting style and copy
      const CodeBlock = ({ code, language }) => {
        const [copied, setCopied] = useState(false);

        const copyCode = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        return (
          <div style={{
            margin: '12px 0',
            borderRadius: '8px',
            overflow: 'hidden',
            background: '#1e1e1e',
            border: '1px solid #333',
          }}>
            {/* Code header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              background: '#2d2d2d',
              borderBottom: '1px solid #333',
            }}>
              <span style={{
                fontSize: '11px',
                color: '#888',
                fontFamily: 'monospace',
                textTransform: 'lowercase',
              }}>
                {language || 'code'}
              </span>
              <button
                onClick={copyCode}
                style={{
                  background: copied ? 'rgba(63, 185, 80, 0.2)' : 'transparent',
                  border: 'none',
                  color: copied ? '#3fb950' : '#888',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy code'}
              </button>
            </div>
            {/* Code content */}
            <pre style={{
              margin: 0,
              padding: '12px 16px',
              overflowX: 'auto',
              fontSize: '13px',
              lineHeight: '1.5',
              color: '#d4d4d4',
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            }}>
              <code>{code}</code>
            </pre>
          </div>
        );
      };

      // Parse content and extract code blocks
      const parseContent = (content) => {
        const parts = [];
        const codeBlockRegex = /\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g;
        let lastIndex = 0;
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
          // Add text before code block
          if (match.index > lastIndex) {
            parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
          }
          // Add code block
          parts.push({ type: 'code', language: match[1] || 'code', content: match[2].trim() });
          lastIndex = match.index + match[0].length;
        }

        // Add remaining text
        if (lastIndex < content.length) {
          parts.push({ type: 'text', content: content.slice(lastIndex) });
        }

        return parts.length > 0 ? parts : [{ type: 'text', content }];
      };

      // Conversation item component - chat bubble style with improvements
      const ConversationItem = ({ item, index }) => {
        const isAsk = item.type === 'ask';
        const label = item.roundLabel || (isAsk ? \`Prompt \${index + 1}\` : \`Response \${index + 1}\`);
        const rawContent = typeof item.content === 'object'
          ? JSON.stringify(item.content, null, 2)
          : String(item.content);

        const contentLength = rawContent.length;
        const isLongContent = contentLength > 1500;
        // Start expanded - user clicked to see the trace, show full content by default
        const [isExpanded, setIsExpanded] = useState(true);
        const [copied, setCopied] = useState(false);
        const [showMeta, setShowMeta] = useState(false);

        const displayContent = !isExpanded && isLongContent
          ? rawContent.substring(0, 1200) + '\\n\\n...'
          : rawContent;

        const contentParts = parseContent(displayContent);

        const copyToClipboard = (e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(rawContent);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        };

        const formatLatency = (ms) => {
          if (ms < 1000) return \`\${ms}ms\`;
          return \`\${(ms / 1000).toFixed(1)}s\`;
        };

        return (
          <article
            className="conversation-message"
            aria-label={\`\${isAsk ? 'User' : 'AI'} message\`}
            data-author={isAsk ? 'user' : 'ai'}
            onMouseEnter={() => setShowMeta(true)}
            onMouseLeave={() => setShowMeta(false)}
            style={{
              marginBottom: '32px',
              paddingBottom: '24px',
              borderBottom: '1px solid var(--border-color)',
            }}
          >
            <div className="message-container" style={{
              display: 'flex',
              gap: '16px',
            }}>
              {/* Avatar - hidden on mobile via CSS class */}
              <div className="message-avatar" style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: isAsk ? 'rgba(88, 166, 255, 0.2)' : 'rgba(63, 185, 80, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0,
                border: isAsk ? '2px solid rgba(88, 166, 255, 0.3)' : '2px solid rgba(63, 185, 80, 0.3)',
              }}>
                {isAsk ? '👤' : '🤖'}
              </div>

              {/* Message content */}
              <div className="message-content" style={{ flex: 1, minWidth: 0 }}>
                {/* Header with label and metadata */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '12px',
                  flexWrap: 'wrap',
                }}>
                  <span style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: isAsk ? 'var(--accent-blue)' : 'var(--accent-green)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {isAsk ? '📤 ' : '📥 '}{label}
                  </span>

                  {/* Metadata badges - hidden by default, show on hover */}
                  <div className="metadata-badges" style={{
                    display: 'flex',
                    gap: '6px',
                    opacity: showMeta ? 1 : 0,
                    transition: 'opacity 0.2s ease',
                  }}>
                    {item.latencyMs && (
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-tertiary)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}>
                        ⏱ {formatLatency(item.latencyMs)}
                      </span>
                    )}
                    {item.usage && (
                      <span style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        background: 'var(--bg-tertiary)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                      }}>
                        {item.usage.inputTokens || 0} → {item.usage.outputTokens || 0} tokens
                      </span>
                    )}
                  </div>
                </div>

                {/* Message bubble */}
                <div
                  className="message-bubble"
                  style={{
                    background: isAsk ? 'rgba(88, 166, 255, 0.08)' : 'rgba(63, 185, 80, 0.04)',
                    border: isAsk ? '1px solid rgba(88, 166, 255, 0.2)' : '1px solid rgba(63, 185, 80, 0.15)',
                    borderLeft: \`5px solid \${isAsk ? 'var(--accent-blue)' : 'var(--accent-green)'}\`,
                    padding: '20px 24px',
                    borderRadius: '4px 12px 12px 4px',
                    maxWidth: '100%',
                    boxShadow: isAsk ? '0 2px 8px rgba(88, 166, 255, 0.08)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {/* Rendered content with code blocks */}
                  <div style={{
                    fontSize: '15px',
                    lineHeight: '1.8',
                    color: 'var(--text-primary)',
                    letterSpacing: '0.01em',
                  }}>
                    {contentParts.map((part, idx) => {
                      if (part.type === 'code') {
                        return <CodeBlock key={idx} code={part.content} language={part.language} />;
                      }
                      return (
                        <div key={idx} style={{
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          marginBottom: idx < contentParts.length - 1 ? '12px' : 0,
                        }}>
                          {part.content}
                        </div>
                      );
                    })}
                  </div>

                  {/* Collapse option for long content */}
                  {isLongContent && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      style={{
                        display: 'block',
                        width: '100%',
                        marginTop: '12px',
                        padding: '8px',
                        background: isExpanded ? 'transparent' : 'var(--bg-secondary)',
                        border: '1px dashed var(--border-color)',
                        borderRadius: '6px',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isExpanded
                        ? \`▲ Collapse (\${Math.round(contentLength / 1000)}k chars)\`
                        : \`▼ Expand full response (\${Math.round(contentLength / 1000)}k chars)\`}
                    </button>
                  )}

                  {/* Action bar */}
                  <div style={{
                    display: 'flex',
                    gap: '8px',
                    marginTop: '12px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    alignItems: 'center',
                  }}>
                    <button
                      onClick={copyToClipboard}
                      aria-label="Copy message"
                      style={{
                        background: copied ? 'rgba(63, 185, 80, 0.15)' : 'var(--bg-secondary)',
                        border: copied ? '1px solid var(--accent-green)' : '1px solid var(--border-color)',
                        color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                        minHeight: '32px',
                      }}
                    >
                      {copied ? '✓ Copied' : '📋 Copy all'}
                    </button>

                    <span style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}>
                      {contentLength.toLocaleString()} chars
                    </span>
                  </div>
                </div>

                {/* Error message */}
                {item.error && (
                  <div
                    role="alert"
                    style={{
                      marginTop: '12px',
                      padding: '12px 16px',
                      background: 'rgba(248, 81, 73, 0.1)',
                      border: '1px solid rgba(248, 81, 73, 0.3)',
                      borderRadius: '8px',
                      color: 'var(--accent-red)',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>⚠️</span>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: '4px' }}>Error</div>
                      <div>{typeof item.error === 'object' ? item.error.message : item.error}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        );
      };

      return (
        <div>
          <button className="back-button" onClick={onBack}>
            {'\\u2190'} Back to Dashboard
          </button>
          <div className="detail-header">
            <div className="detail-title">
              {trace.name || \`Trace \${trace.traceId.slice(0, 8)}\`}
              <span className={\`status-badge \${trace.status}\`} style={{ marginLeft: 12, fontSize: 14 }}>
                {trace.status === 'running' && <span className="live-dot" style={{ marginRight: 6 }}></span>}
                {trace.status}
              </span>
            </div>
            <div className="detail-meta">
              <span>Started: {new Date(trace.startTime).toLocaleString()}</span>
              {trace.endTime && <span>Ended: {new Date(trace.endTime).toLocaleString()}</span>}
              <span>Events: {trace.summary?.eventCount || trace.eventCount}</span>
              {trace.durationMs && <span>Duration: {trace.durationMs}ms</span>}
              {trace.commandType && <span>Type: {trace.commandType}</span>}
              {/* Provider info - prominently displayed */}
              {trace.provider && (
                <span style={{
                  background: 'var(--accent-blue)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}>
                  Provider: {trace.provider}
                </span>
              )}
              {trace.model && <span>Model: {trace.model}</span>}
              {/* For discuss: show providers list */}
              {trace.commandType === 'discuss' && trace.input?.providers && Array.isArray(trace.input.providers) && (
                <span style={{
                  background: 'var(--accent-purple)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}>
                  Providers: {trace.input.providers.join(', ')}
                </span>
              )}
            </div>
          </div>

          {/* Provider Sub-tabs for Conversations */}
          {providerKeys.length > 0 && (
            <div className="card" style={{ marginBottom: 16, border: '2px solid var(--accent-purple)', borderRadius: '12px' }}>
              <div className="card-header" style={{ borderBottom: 'none', paddingBottom: 0, background: 'rgba(163, 113, 247, 0.08)' }}>
                <span className="card-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💬 Conversations
                </span>
                <span className="card-badge" style={{ background: 'var(--accent-purple)', color: 'white' }}>
                  {providerKeys.length} provider{providerKeys.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Provider tabs */}
              <div style={{
                display: 'flex',
                gap: '8px',
                padding: '12px 16px',
                overflowX: 'auto',
                background: 'var(--bg-tertiary)',
                borderBottom: '2px solid var(--border-color)',
              }}>
                {providerKeys.map(providerKey => {
                  const group = providerGroups[providerKey];
                  const askCount = group.conversations.filter(c => c.type === 'ask').length;
                  const replyCount = group.conversations.filter(c => c.type === 'reply').length;
                  const isActive = effectiveActiveTab === providerKey;

                  return (
                    <button
                      key={providerKey}
                      onClick={() => setActiveProviderTab(providerKey)}
                      style={{
                        padding: '10px 16px',
                        background: isActive ? 'var(--accent-blue)' : 'var(--bg-secondary)',
                        border: isActive ? '2px solid var(--accent-blue)' : '2px solid var(--border-color)',
                        borderRadius: '8px',
                        color: isActive ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s ease',
                        boxShadow: isActive ? '0 2px 8px rgba(88, 166, 255, 0.3)' : 'none',
                      }}
                    >
                      <span style={{
                        background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'var(--bg-tertiary)',
                        color: isActive ? 'white' : 'var(--text-primary)',
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        {providerKey}
                      </span>
                      <span style={{
                        fontSize: 12,
                        color: isActive ? 'rgba(255, 255, 255, 0.9)' : 'var(--text-muted)',
                        background: isActive ? 'rgba(255, 255, 255, 0.15)' : 'var(--bg-tertiary)',
                        padding: '3px 8px',
                        borderRadius: 4,
                      }}>
                        {askCount > 0 && \`\${askCount} ask\`}
                        {askCount > 0 && replyCount > 0 && ' · '}
                        {replyCount > 0 && \`\${replyCount} reply\`}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active provider content */}
              {effectiveActiveTab && providerGroups[effectiveActiveTab] && (
                <section
                  aria-label="Chat History"
                  role="log"
                  style={{
                    padding: '24px',
                    background: 'var(--bg-secondary)',
                    borderRadius: '0 0 8px 8px',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                  }}
                >
                  {providerGroups[effectiveActiveTab].model && (
                    <div style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      marginBottom: 16,
                      padding: '8px 12px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: 6,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}>
                      <span style={{ opacity: 0.7 }}>🧠</span>
                      <span>Model: <strong>{providerGroups[effectiveActiveTab].model}</strong></span>
                    </div>
                  )}

                  {/* Render conversations as ask/reply pairs */}
                  {(() => {
                    const conversations = providerGroups[effectiveActiveTab].conversations;
                    let askIndex = 0;
                    let replyIndex = 0;

                    return conversations.map((item, idx) => {
                      const currentIndex = item.type === 'ask' ? askIndex++ : replyIndex++;
                      return (
                        <ConversationItem
                          key={\`\${item.type}-\${idx}\`}
                          item={item}
                          index={currentIndex}
                        />
                      );
                    });
                  })()}

                  {providerGroups[effectiveActiveTab].conversations.length === 0 && (
                    <div style={{
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '64px 32px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '12px',
                      border: '2px dashed var(--border-color)',
                    }}>
                      <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>💬</div>
                      <div style={{ fontSize: '16px', fontWeight: 500 }}>No conversation data available</div>
                      <div style={{ fontSize: '13px', marginTop: '8px', opacity: 0.7 }}>
                        Conversation history will appear here when available
                      </div>
                    </div>
                  )}
                </section>
              )}
            </div>
          )}

          {/* Show raw input/output if no conversation groups were built */}
          {providerKeys.length === 0 && (
            <>
              {trace.input && Object.keys(trace.input).length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <span className="card-title">Input</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <pre style={{
                      background: 'var(--bg-tertiary)',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      maxHeight: 300
                    }}>
                      {JSON.stringify(trace.input, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              {trace.output && Object.keys(trace.output).length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-header">
                    <span className="card-title">Output</span>
                  </div>
                  <div style={{ padding: 16 }}>
                    <pre style={{
                      background: 'var(--bg-tertiary)',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                      overflow: 'auto',
                      maxHeight: 300
                    }}>
                      {JSON.stringify(trace.output, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Discussion-specific insights (Phase 3) */}
          {trace.commandType === 'discuss' && trace.timeline && trace.timeline.length > 0 && (
            <DiscussionInsights trace={trace} />
          )}

          <div className="card">
            <div className="card-header">
              <span className="card-title">Event Timeline</span>
              {trace.status === 'running' && (
                <span style={{ fontSize: 12, color: 'var(--accent-green)' }}>{'\\u21BB'} Auto-refreshing</span>
              )}
            </div>
            <TraceTimeline timeline={trace.timeline} />
          </div>
        </div>
      );
    }

    // Workflow detail view
    function WorkflowDetail({ workflowId, onBack }) {
      const [workflow, setWorkflow] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        async function fetchWorkflow() {
          try {
            const response = await fetch(\`/api/workflows/\${workflowId}\`);
            const result = await response.json();
            if (result.success) {
              setWorkflow(result.data);
            } else {
              setError(result.error || 'Failed to fetch workflow');
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
        fetchWorkflow();
      }, [workflowId]);

      if (loading) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Workflows
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              Loading workflow...
            </div>
          </div>
        );
      }

      if (error) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Workflows
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: 'var(--accent-red)' }}>{error}</div>
            </div>
          </div>
        );
      }

      const formatDuration = (ms) => {
        if (!ms) return '-';
        if (ms < 1000) return \`\${ms}ms\`;
        if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
        return \`\${(ms / 60000).toFixed(1)}m\`;
      };

      const formatTime = (isoString) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleString();
      };

      const getStepTypeIcon = (type) => {
        switch (type) {
          case 'prompt': return '💬';
          case 'tool': return '🔧';
          case 'conditional': return '🔀';
          case 'loop': return '🔄';
          case 'parallel': return '⚡';
          case 'delegate': return '👥';
          default: return '📋';
        }
      };

      const getStatusColor = (status) => {
        switch (status) {
          case 'success': return 'var(--accent-green)';
          case 'failure': return 'var(--accent-red)';
          case 'running': return 'var(--accent-blue)';
          default: return 'var(--text-muted)';
        }
      };

      return (
        <div>
          <button className="back-button" onClick={onBack}>
            {'\\u2190'} Back to Workflows
          </button>
          <div className="detail-header">
            <div className="detail-title">{workflow.name || workflow.workflowId}</div>
            <div className="detail-meta">
              <span>ID: {workflow.workflowId}</span>
              <span>Version: {workflow.version}</span>
              <span>Steps: {(workflow.steps && workflow.steps.length) || 0}</span>
              {workflow.executionCount > 0 && (
                <span>Executions: {workflow.executionCount}</span>
              )}
            </div>
            {workflow.description && (
              <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>{workflow.description}</p>
            )}
          </div>

          {/* Metadata section */}
          {workflow.metadata && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Metadata</span>
              </div>
              <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {workflow.metadata.category && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Category</span>
                    <div style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{workflow.metadata.category}</div>
                  </div>
                )}
                {workflow.metadata.tags && workflow.metadata.tags.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Tags</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {workflow.metadata.tags.map((tag, i) => (
                        <span key={i} style={{
                          background: 'var(--bg-tertiary)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          color: 'var(--text-secondary)'
                        }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                {workflow.metadata.requiredAbilities && workflow.metadata.requiredAbilities.length > 0 && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Required Abilities</span>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                      {workflow.metadata.requiredAbilities.map((ability, i) => (
                        <span key={i} style={{
                          background: 'rgba(163, 113, 247, 0.15)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 11,
                          color: 'var(--accent-purple)'
                        }}>{ability}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Workflow Steps with details */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Workflow Steps ({workflow.steps?.length || 0})</span>
            </div>
            <div style={{ padding: '8px 0' }}>
              {workflow.steps && workflow.steps.map((step, index) => (
                <div key={step.stepId} style={{
                  padding: '12px 16px',
                  borderBottom: index < workflow.steps.length - 1 ? '1px solid var(--border-color)' : 'none'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      flexShrink: 0
                    }}>
                      {getStepTypeIcon(step.type)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 500 }}>{step.name}</span>
                        <span style={{
                          background: 'var(--bg-tertiary)',
                          padding: '2px 6px',
                          borderRadius: 4,
                          fontSize: 10,
                          color: 'var(--text-muted)',
                          textTransform: 'uppercase'
                        }}>{step.type}</span>
                        {step.timeout && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            ⏱ {formatDuration(step.timeout)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                        {step.stepId}
                      </div>
                      {/* Step configuration details */}
                      {step.config && (
                        <div style={{
                          marginTop: 8,
                          padding: 10,
                          background: 'var(--bg-primary)',
                          borderRadius: 6,
                          fontSize: 12
                        }}>
                          {step.config.agentId && (
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Agent: </span>
                              <span style={{ color: 'var(--accent-blue)' }}>{step.config.agentId}</span>
                            </div>
                          )}
                          {step.config.tool && (
                            <div style={{ marginBottom: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Tool: </span>
                              <span style={{ color: 'var(--accent-green)' }}>{step.config.tool}</span>
                            </div>
                          )}
                          {step.config.prompt && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Prompt: </span>
                              <pre style={{
                                margin: '4px 0 0 0',
                                padding: 8,
                                background: 'var(--bg-secondary)',
                                borderRadius: 4,
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 150,
                                overflow: 'auto'
                              }}>{step.config.prompt}</pre>
                            </div>
                          )}
                          {step.config.args && Object.keys(step.config.args).length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <span style={{ color: 'var(--text-muted)' }}>Args: </span>
                              <code style={{
                                fontSize: 11,
                                color: 'var(--text-secondary)',
                                background: 'var(--bg-secondary)',
                                padding: '2px 4px',
                                borderRadius: 2
                              }}>{JSON.stringify(step.config.args)}</code>
                            </div>
                          )}
                        </div>
                      )}
                      {/* Dependencies */}
                      {step.dependencies && step.dependencies.length > 0 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                          Depends on: {step.dependencies.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Executions */}
          {workflow.recentExecutions && workflow.recentExecutions.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Recent Executions ({workflow.executionCount})</span>
              </div>
              <div style={{ padding: '8px 0' }}>
                {workflow.recentExecutions.map((exec, index) => (
                  <div key={exec.traceId} style={{
                    padding: '10px 16px',
                    borderBottom: index < workflow.recentExecutions.length - 1 ? '1px solid var(--border-color)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getStatusColor(exec.status)
                      }}></span>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                        {exec.traceId.slice(0, 8)}
                      </span>
                      <span style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: exec.status === 'success' ? 'rgba(63, 185, 80, 0.15)' :
                                   exec.status === 'failure' ? 'rgba(248, 81, 73, 0.15)' : 'var(--bg-tertiary)',
                        color: getStatusColor(exec.status)
                      }}>{exec.status}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>{formatDuration(exec.durationMs)}</span>
                      <span>{formatTime(exec.startTime)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visual DAG */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Workflow DAG</span>
            </div>
            <WorkflowDAG dag={workflow.dag} />
          </div>
        </div>
      );
    }

    // History view with pagination
    function HistoryView({ traces, onSelectTrace }) {
      const [filter, setFilter] = useState('all');
      const [search, setSearch] = useState('');
      const [currentPage, setCurrentPage] = useState(0);
      const pageSize = 20;

      // Provider colors matching the Provider Usage histogram
      const providerColors = {
        claude: { bg: 'rgba(255, 145, 77, 0.15)', color: 'var(--accent-orange)' },
        grok: { bg: 'rgba(163, 113, 247, 0.15)', color: 'var(--accent-purple)' },
        gemini: { bg: 'rgba(88, 166, 255, 0.15)', color: 'var(--accent-blue)' },
        codex: { bg: 'rgba(63, 185, 80, 0.15)', color: 'var(--accent-green)' },
        opencode: { bg: 'rgba(63, 185, 185, 0.15)', color: 'var(--accent-cyan)' },
        antigravity: { bg: 'rgba(255, 200, 77, 0.15)', color: '#ffc84d' },
        cursor: { bg: 'rgba(88, 166, 255, 0.15)', color: 'var(--accent-blue)' },
        'local-llm': { bg: 'rgba(163, 163, 163, 0.15)', color: 'var(--text-secondary)' },
      };

      const getProviderStyle = (provider) => {
        const lowerProvider = provider?.toLowerCase() || '';
        return providerColors[lowerProvider] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
      };

      const filteredTraces = traces.filter(trace => {
        if (filter !== 'all' && trace.status !== filter) return false;
        if (search && !trace.traceId.toLowerCase().includes(search.toLowerCase()) &&
            !(trace.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      // Reset to first page when filter/search changes
      useEffect(() => {
        setCurrentPage(0);
      }, [filter, search]);

      const totalPages = Math.ceil(filteredTraces.length / pageSize);
      const paginatedTraces = filteredTraces.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
      );

      // Generate page numbers to show
      const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
          // Show all pages if not too many
          for (let i = 0; i < totalPages; i++) {
            pages.push(i);
          }
        } else {
          // Show first, last, and pages around current
          pages.push(0);

          let start = Math.max(1, currentPage - 1);
          let end = Math.min(totalPages - 2, currentPage + 1);

          // Adjust if at the edges
          if (currentPage <= 2) {
            end = Math.min(maxVisible - 1, totalPages - 2);
          }
          if (currentPage >= totalPages - 3) {
            start = Math.max(1, totalPages - maxVisible);
          }

          if (start > 1) pages.push('...');
          for (let i = start; i <= end; i++) {
            pages.push(i);
          }
          if (end < totalPages - 2) pages.push('...');

          if (totalPages > 1) pages.push(totalPages - 1);
        }

        return pages;
      };

      return (
        <div>
          <div className="history-controls">
            <input
              type="text"
              className="history-search"
              placeholder="Search traces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="history-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All Status ({traces.length})</option>
              <option value="success">Success ({traces.filter(t => t.status === 'success').length})</option>
              <option value="failure">Failure ({traces.filter(t => t.status === 'failure').length})</option>
              <option value="running">Running ({traces.filter(t => t.status === 'running').length})</option>
            </select>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Providers</th>
                  <th>Status</th>
                  <th>Events</th>
                  <th>Duration</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTraces.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                      <div className="table-empty-state">
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>No traces found</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {filter === 'all'
                            ? 'Run an agent or workflow to see execution traces here'
                            : 'Try changing the status filter to see more results'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedTraces.map(trace => (
                    <tr key={trace.traceId} onClick={() => onSelectTrace(trace.traceId)}>
                      <td style={{ fontFamily: 'monospace' }} title={trace.traceId}>{trace.name || trace.traceId.slice(0, 12) + '...'}</td>
                      <td>
                        {trace.providers && trace.providers.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {trace.providers.slice(0, 3).map(provider => {
                              const style = getProviderStyle(provider);
                              return (
                                <span
                                  key={provider}
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    background: style.bg,
                                    color: style.color,
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    border: \`1px solid \${style.color}30\`,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {provider}
                                </span>
                              );
                            })}
                            {trace.providers.length > 3 && (
                              <span style={{
                                padding: '2px 6px',
                                color: 'var(--text-muted)',
                                fontSize: '10px',
                              }}>
                                +{trace.providers.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>-</span>
                        )}
                      </td>
                      <td>
                        <span className={\`history-status \${trace.status}\`}>
                          <StatusIcon status={trace.status} />
                          {trace.status}
                        </span>
                      </td>
                      <td>{trace.eventCount}</td>
                      <td style={{ fontFamily: 'monospace' }}>
                        {trace.durationMs ? formatDuration(trace.durationMs) : '-'}
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {formatRelativeTime(trace.startTime)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {filteredTraces.length > pageSize && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredTraces.length)} of {filteredTraces.length}
                </div>
                <div className="pagination-controls">
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(0)}
                    disabled={currentPage === 0}
                  >
                    {'\\u00AB'}
                  </button>
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                  >
                    {'\\u2039'}
                  </button>
                  <div className="pagination-pages">
                    {getPageNumbers().map((page, index) =>
                      page === '...' ? (
                        <span key={\`ellipsis-\${index}\`} className="pagination-ellipsis">...</span>
                      ) : (
                        <button
                          key={page}
                          className={\`pagination-page \${currentPage === page ? 'active' : ''}\`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page + 1}
                        </button>
                      )
                    )}
                  </div>
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage >= totalPages - 1}
                  >
                    {'\\u203A'}
                  </button>
                  <button
                    className="pagination-button"
                    onClick={() => setCurrentPage(totalPages - 1)}
                    disabled={currentPage >= totalPages - 1}
                  >
                    {'\\u00BB'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Full-page Providers view
    function ProvidersView({ providers: initialProviders }) {
      const [filter, setFilter] = useState('all');
      const [search, setSearch] = useState('');
      const [refreshing, setRefreshing] = useState(false);
      const [providers, setProviders] = useState(initialProviders);
      const [lastRefresh, setLastRefresh] = useState(null);

      const handleRefresh = async () => {
        setRefreshing(true);
        try {
          const response = await fetch('/api/providers/refresh', { method: 'POST' });
          const result = await response.json();
          if (result.success && result.data?.providers) {
            setProviders(result.data.providers);
            setLastRefresh(new Date().toLocaleTimeString());
          }
        } catch (err) {
          console.error('Failed to refresh providers:', err);
        } finally {
          setRefreshing(false);
        }
      };

      const filteredProviders = providers.filter(provider => {
        if (filter === 'available' && !provider.available) return false;
        if (filter === 'unavailable' && provider.available) return false;
        if (search && !provider.providerId.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      const availableCount = providers.filter(p => p.available).length;

      return (
        <div>
          <div className="history-controls">
            <input
              type="text"
              className="history-search"
              placeholder="Search providers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="history-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All ({providers.length})</option>
              <option value="available">Available ({availableCount})</option>
              <option value="unavailable">Unavailable ({providers.length - availableCount})</option>
            </select>
            <button
              className="refresh-button"
              onClick={handleRefresh}
              disabled={refreshing}
              title="Check provider health (sends test prompt to each provider)"
            >
              {refreshing ? '⏳ Checking...' : '🔄 Refresh Status'}
            </button>
            {lastRefresh && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                Last refresh: {lastRefresh}
              </span>
            )}
          </div>

          <div className="card">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Response Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredProviders.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                      <div className="table-empty-state">
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔌</div>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>No providers found</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {providerFilter === 'all'
                            ? 'Run ax setup to configure providers'
                            : 'Try changing the filter to see more results'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProviders.map(provider => (
                    <tr key={provider.providerId}>
                      <td>
                        <span className={\`provider-icon \${provider.available ? 'available' : 'unavailable'}\`}></span>
                        {provider.providerId}
                      </td>
                      <td>
                        <span className={\`history-status \${provider.available ? 'success' : 'failure'}\`}>
                          <StatusIcon status={provider.available ? 'success' : 'failure'} />
                          {provider.available ? 'online' : 'offline'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>
                        <span className={\`provider-latency \${
                          !provider.latencyMs ? '' :
                          provider.latencyMs < 5000 ? 'fast' : 'slow'
                        }\`}>
                          {provider.latencyMs ? \`\${provider.latencyMs}ms\` : '-'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // Full-page Agents view
    function AgentsView({ agents, onSelectAgent }) {
      const [filter, setFilter] = useState('all');
      const [search, setSearch] = useState('');
      const [currentPage, setCurrentPage] = useState(0);
      const pageSize = 15;

      const filteredAgents = agents.filter(agent => {
        if (filter === 'enabled' && !agent.enabled) return false;
        if (filter === 'disabled' && agent.enabled) return false;
        if (search && !(agent.agentId || '').toLowerCase().includes(search.toLowerCase()) &&
            !(agent.displayName || '').toLowerCase().includes(search.toLowerCase()) &&
            !(agent.description || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      // Reset page when filter/search changes
      useEffect(() => {
        setCurrentPage(0);
      }, [filter, search]);

      const enabledCount = agents.filter(a => a.enabled).length;
      const totalPages = Math.ceil(filteredAgents.length / pageSize);
      const paginatedAgents = filteredAgents.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
      );

      // Generate page numbers
      const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible + 2) {
          for (let i = 0; i < totalPages; i++) pages.push(i);
        } else {
          pages.push(0);
          let start = Math.max(1, currentPage - 1);
          let end = Math.min(totalPages - 2, currentPage + 1);
          if (currentPage <= 2) end = Math.min(maxVisible - 1, totalPages - 2);
          if (currentPage >= totalPages - 3) start = Math.max(1, totalPages - maxVisible);
          if (start > 1) pages.push('...');
          for (let i = start; i <= end; i++) pages.push(i);
          if (end < totalPages - 2) pages.push('...');
          if (totalPages > 1) pages.push(totalPages - 1);
        }
        return pages;
      };

      return (
        <div>
          <div className="history-controls">
            <input
              type="text"
              className="history-search"
              placeholder="Search agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="history-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All ({agents.length})</option>
              <option value="enabled">Enabled ({enabledCount})</option>
              <option value="disabled">Disabled ({agents.length - enabledCount})</option>
            </select>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Team</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAgents.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                      <div className="table-empty-state">
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🤖</div>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>No agents found</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {filter === 'all'
                            ? 'Register agents using ax_agent_register or the CLI'
                            : 'Try changing the filter to see more results'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedAgents.map(agent => (
                    <tr key={agent.agentId} onClick={() => onSelectAgent(agent.agentId)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong>{agent.displayName || agent.agentId}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {agent.agentId}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agent.description || '-'}
                      </td>
                      <td>
                        <span className={\`history-status \${agent.enabled ? 'success' : 'failure'}\`}>
                          <StatusIcon status={agent.enabled ? 'success' : 'failure'} />
                          {agent.enabled ? 'enabled' : 'disabled'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {agent.team || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {filteredAgents.length > pageSize && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredAgents.length)} of {filteredAgents.length}
                </div>
                <div className="pagination-controls">
                  <button className="pagination-button" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>{'\\u00AB'}</button>
                  <button className="pagination-button" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>{'\\u2039'}</button>
                  <div className="pagination-pages">
                    {getPageNumbers().map((page, index) =>
                      page === '...' ? (
                        <span key={\`ellipsis-\${index}\`} className="pagination-ellipsis">...</span>
                      ) : (
                        <button key={page} className={\`pagination-page \${currentPage === page ? 'active' : ''}\`} onClick={() => setCurrentPage(page)}>{page + 1}</button>
                      )
                    )}
                  </div>
                  <button className="pagination-button" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>{'\\u203A'}</button>
                  <button className="pagination-button" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>{'\\u00BB'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Full-page Workflows view
    function WorkflowsView({ workflows, onSelectWorkflow }) {
      const [search, setSearch] = useState('');
      const [currentPage, setCurrentPage] = useState(0);
      const pageSize = 15;

      const filteredWorkflows = workflows.filter(workflow => {
        if (search && !(workflow.workflowId || '').toLowerCase().includes(search.toLowerCase()) &&
            !(workflow.name || '').toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

      // Reset page when search changes
      useEffect(() => {
        setCurrentPage(0);
      }, [search]);

      const totalPages = Math.ceil(filteredWorkflows.length / pageSize);
      const paginatedWorkflows = filteredWorkflows.slice(
        currentPage * pageSize,
        (currentPage + 1) * pageSize
      );

      // Generate page numbers
      const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible + 2) {
          for (let i = 0; i < totalPages; i++) pages.push(i);
        } else {
          pages.push(0);
          let start = Math.max(1, currentPage - 1);
          let end = Math.min(totalPages - 2, currentPage + 1);
          if (currentPage <= 2) end = Math.min(maxVisible - 1, totalPages - 2);
          if (currentPage >= totalPages - 3) start = Math.max(1, totalPages - maxVisible);
          if (start > 1) pages.push('...');
          for (let i = start; i <= end; i++) pages.push(i);
          if (end < totalPages - 2) pages.push('...');
          if (totalPages > 1) pages.push(totalPages - 1);
        }
        return pages;
      };

      return (
        <div>
          <div className="history-controls">
            <input
              type="text"
              className="history-search"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px' }}>
              {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? 's' : ''} found
            </span>
          </div>

          <div className="card" style={{ overflow: 'hidden' }}>
            <table className="history-table">
              <thead>
                <tr>
                  <th>Workflow</th>
                  <th>Version</th>
                  <th>Steps</th>
                </tr>
              </thead>
              <tbody>
                {paginatedWorkflows.length === 0 ? (
                  <tr>
                    <td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      {workflows.length === 0 ? 'No workflows found. Create workflow files in ./workflows/ or examples/workflows/ directory.' : 'No matching workflows'}
                    </td>
                  </tr>
                ) : (
                  paginatedWorkflows.map(workflow => (
                    <tr key={workflow.workflowId} onClick={() => onSelectWorkflow(workflow.workflowId)} style={{ cursor: 'pointer' }}>
                      <td>
                        <strong>{workflow.name || workflow.workflowId}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {workflow.workflowId}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {workflow.version || '-'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {workflow.stepCount || 0} step{(workflow.stepCount || 0) !== 1 ? 's' : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {filteredWorkflows.length > pageSize && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, filteredWorkflows.length)} of {filteredWorkflows.length}
                </div>
                <div className="pagination-controls">
                  <button className="pagination-button" onClick={() => setCurrentPage(0)} disabled={currentPage === 0}>{'\\u00AB'}</button>
                  <button className="pagination-button" onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage === 0}>{'\\u2039'}</button>
                  <div className="pagination-pages">
                    {getPageNumbers().map((page, index) =>
                      page === '...' ? (
                        <span key={\`ellipsis-\${index}\`} className="pagination-ellipsis">...</span>
                      ) : (
                        <button key={page} className={\`pagination-page \${currentPage === page ? 'active' : ''}\`} onClick={() => setCurrentPage(page)}>{page + 1}</button>
                      )
                    )}
                  </div>
                  <button className="pagination-button" onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))} disabled={currentPage >= totalPages - 1}>{'\\u203A'}</button>
                  <button className="pagination-button" onClick={() => setCurrentPage(totalPages - 1)} disabled={currentPage >= totalPages - 1}>{'\\u00BB'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Provider Usage Histogram - shows last 200 calls by provider
    function ProviderUsageHistogram({ traces }) {
      // Provider colors for consistent visualization
      const providerColors = {
        claude: 'var(--accent-orange)',
        grok: 'var(--accent-purple)',
        gemini: 'var(--accent-blue)',
        codex: 'var(--accent-green)',
        opencode: 'var(--accent-cyan)',
        default: 'var(--text-muted)',
      };

      // Extract provider usage from traces (last 200)
      const recentTraces = traces.slice(0, 200);
      const providerCounts = {};

      recentTraces.forEach(trace => {
        // Get providers from trace.providers field (populated by API)
        let providers = [];

        if (trace.providers && Array.isArray(trace.providers)) {
          providers = trace.providers;
        }
        // Fallback: extract provider from name if not in providers field
        else if (trace.name) {
          const knownProviders = ['claude', 'grok', 'gemini', 'codex', 'opencode'];
          for (const p of knownProviders) {
            if (trace.name.toLowerCase().includes(p)) {
              providers = [p];
              break;
            }
          }
        }

        providers.forEach(provider => {
          if (provider) {
            providerCounts[provider] = (providerCounts[provider] || 0) + 1;
          }
        });
      });

      const providers = Object.entries(providerCounts)
        .sort((a, b) => b[1] - a[1]); // Sort by count descending

      const maxCount = Math.max(...providers.map(([, count]) => count), 1);
      const totalCalls = providers.reduce((sum, [, count]) => sum + count, 0);

      if (providers.length === 0) {
        return (
          <div className="histogram-container">
            <div className="histogram-header">
              <div>
                <div className="histogram-title">Provider Usage (Last 200 Records)</div>
                <div className="histogram-subtitle">No data available</div>
              </div>
            </div>
            <div className="empty-state" style={{ padding: '24px 0' }}>
              No provider usage data available
            </div>
          </div>
        );
      }

      return (
        <div className="histogram-container">
          <div className="histogram-header">
            <div>
              <div className="histogram-title">Provider Usage (Last 200 Records)</div>
              <div className="histogram-subtitle">
                {totalCalls} provider calls across {recentTraces.length} traces
              </div>
            </div>
          </div>

          <div className="histogram-chart">
            {providers.map(([provider, count]) => {
              const heightPercent = (count / maxCount) * 100;
              const color = providerColors[provider] || providerColors.default;
              const percentage = ((count / totalCalls) * 100).toFixed(1);

              return (
                <div key={provider} className="histogram-bar-container">
                  <div className="histogram-bar-wrapper">
                    <div
                      className="histogram-bar"
                      style={{
                        height: \`\${heightPercent}%\`,
                        background: color,
                      }}
                    >
                      <div className="histogram-bar-tooltip">
                        {provider}: {count} calls ({percentage}%)
                      </div>
                    </div>
                  </div>
                  <div className="histogram-label">{provider}</div>
                  <div className="histogram-count">{count}</div>
                </div>
              );
            })}
          </div>

          <div className="histogram-legend">
            {providers.map(([provider, count]) => {
              const color = providerColors[provider] || providerColors.default;
              const percentage = ((count / totalCalls) * 100).toFixed(1);
              return (
                <div key={provider} className="histogram-legend-item">
                  <div className="histogram-legend-dot" style={{ background: color }}></div>
                  <span>{provider}: {count} ({percentage}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    // Provider card component
    function ProviderCard({ providers }) {
      return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Providers</span>
            <span className="card-badge">{providers.filter(p => p.available).length}/{providers.length}</span>
          </div>
          <div className="provider-list">
            {providers.length === 0 ? (
              <EmptyState
                icon="🔌"
                title="No providers configured"
                description="Set up AI providers to get started"
                actionLabel="Run ax setup"
              />
            ) : (
              providers.map(provider => (
                <div key={provider.providerId} className="provider-item">
                  <div className="provider-name">
                    <span className={\`provider-icon \${provider.available ? 'available' : 'unavailable'}\`}></span>
                    {provider.providerId}
                  </div>
                  <span className={\`provider-latency \${
                    !provider.latencyMs ? '' :
                    provider.latencyMs < 5000 ? 'fast' : 'slow'
                  }\`}>
                    {provider.latencyMs ? \`\${provider.latencyMs}ms\` : '-'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // Agent detail component
    function AgentDetail({ agentId, onBack }) {
      const [agent, setAgent] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);

      useEffect(() => {
        async function fetchAgent() {
          try {
            const response = await fetch(\`/api/agents/\${agentId}\`);
            const result = await response.json();
            if (result.success) {
              setAgent(result.data);
            } else {
              setError(result.error || 'Failed to fetch agent');
            }
          } catch (err) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
        fetchAgent();
      }, [agentId]);

      if (loading) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Dashboard
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              Loading agent...
            </div>
          </div>
        );
      }

      if (error) {
        return (
          <div>
            <button className="back-button" onClick={onBack}>
              {'\\u2190'} Back to Dashboard
            </button>
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: 'var(--accent-red)' }}>{error}</div>
            </div>
          </div>
        );
      }

      // Step type icons
      const stepTypeIcons = {
        prompt: '\\u{1F4AC}',
        tool: '\\u{1F527}',
        conditional: '\\u{2753}',
        loop: '\\u{1F504}',
        parallel: '\\u{2194}',
        delegate: '\\u{1F465}',
      };

      // Step type colors
      const stepTypeColors = {
        prompt: 'var(--accent-blue)',
        tool: 'var(--accent-cyan)',
        conditional: 'var(--accent-orange)',
        loop: 'var(--accent-purple)',
        parallel: 'var(--accent-yellow)',
        delegate: 'var(--accent-green)',
      };

      return (
        <div>
          <button className="back-button" onClick={onBack}>
            {'\\u2190'} Back to Dashboard
          </button>

          {/* Agent Header */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)' }}>
                  {agent.displayName || agent.agentId}
                </h2>
                <p style={{ margin: 0, color: 'var(--text-secondary)', maxWidth: 600 }}>
                  {agent.description}
                </p>
              </div>
              <div style={{
                padding: '4px 12px',
                borderRadius: 12,
                background: agent.enabled ? 'rgba(63, 185, 80, 0.2)' : 'rgba(139, 148, 158, 0.2)',
                color: agent.enabled ? 'var(--accent-green)' : 'var(--text-muted)',
                fontSize: 13,
                fontWeight: 500,
              }}>
                {agent.enabled ? 'Active' : 'Disabled'}
              </div>
            </div>

            {/* Metadata */}
            <div style={{ display: 'flex', gap: 24, marginTop: 16, flexWrap: 'wrap' }}>
              {agent.team && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Team</span>
                  <div style={{ color: 'var(--text-primary)' }}>{agent.team}</div>
                </div>
              )}
              {agent.version && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Version</span>
                  <div style={{ color: 'var(--text-primary)' }}>{agent.version}</div>
                </div>
              )}
              {agent.role && (
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Role</span>
                  <div style={{ color: 'var(--text-primary)' }}>{agent.role}</div>
                </div>
              )}
              {agent.stats && (
                <>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Executions</span>
                    <div style={{ color: 'var(--text-primary)' }}>{agent.stats.executionCount}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Success Rate</span>
                    <div style={{ color: agent.stats.successRate >= 0.8 ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
                      {Math.round(agent.stats.successRate * 100)}%
                    </div>
                  </div>
                  {agent.stats.avgDurationMs > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Avg Duration</span>
                      <div style={{ color: 'var(--text-primary)' }}>{agent.stats.avgDurationMs}ms</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Capabilities and Tags */}
          {(agent.capabilities?.length > 0 || agent.tags?.length > 0) && (
            <div className="card" style={{ marginBottom: 16 }}>
              {agent.capabilities?.length > 0 && (
                <div style={{ marginBottom: agent.tags?.length > 0 ? 16 : 0 }}>
                  <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14, color: 'var(--text-secondary)' }}>Capabilities</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {agent.capabilities.map((cap, idx) => (
                      <span key={idx} style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: 'rgba(88, 166, 255, 0.15)',
                        color: 'var(--accent-blue)',
                        fontSize: 12,
                      }}>
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {agent.tags?.length > 0 && (
                <div>
                  <h3 style={{ margin: 0, marginBottom: 8, fontSize: 14, color: 'var(--text-secondary)' }}>Tags</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {agent.tags.map((tag, idx) => (
                      <span key={idx} style={{
                        padding: '4px 10px',
                        borderRadius: 12,
                        background: 'rgba(139, 148, 158, 0.15)',
                        color: 'var(--text-muted)',
                        fontSize: 12,
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Workflow Steps */}
          {agent.workflow?.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ margin: 0, marginBottom: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
                Workflow ({agent.workflow.length} steps)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {agent.workflow.map((step, idx) => (
                  <div key={step.stepId} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: 12,
                    background: 'var(--bg-tertiary)',
                    borderRadius: 8,
                    borderLeft: \`3px solid \${stepTypeColors[step.type] || 'var(--text-muted)'}\`,
                  }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--bg-secondary)',
                      borderRadius: '50%',
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 16 }}>{stepTypeIcons[step.type] || '\\u{2022}'}</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{step.name}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 10,
                          background: \`\${stepTypeColors[step.type] || 'var(--text-muted)'}20\`,
                          color: stepTypeColors[step.type] || 'var(--text-muted)',
                          fontSize: 11,
                          textTransform: 'uppercase',
                        }}>
                          {step.type}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                        ID: {step.stepId}
                        {step.dependencies?.length > 0 && (
                          <span> | Depends on: {step.dependencies.join(', ')}</span>
                        )}
                        {step.condition && (
                          <span> | Condition: {step.condition}</span>
                        )}
                      </div>
                      {step.config && Object.keys(step.config).length > 0 && (
                        <details style={{ marginTop: 8 }}>
                          <summary style={{ cursor: 'pointer', color: 'var(--accent-blue)', fontSize: 12 }}>
                            View Configuration
                          </summary>
                          <pre style={{
                            marginTop: 8,
                            padding: 8,
                            background: 'var(--bg-primary)',
                            borderRadius: 4,
                            fontSize: 11,
                            overflow: 'auto',
                            maxHeight: 200,
                          }}>
                            {JSON.stringify(step.config, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System Prompt */}
          {agent.systemPrompt && (
            <div className="card">
              <h3 style={{ margin: 0, marginBottom: 12, fontSize: 14, color: 'var(--text-secondary)' }}>System Prompt</h3>
              <pre style={{
                margin: 0,
                padding: 12,
                background: 'var(--bg-tertiary)',
                borderRadius: 6,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 300,
                overflow: 'auto',
                color: 'var(--text-primary)',
              }}>
                {agent.systemPrompt}
              </pre>
            </div>
          )}
        </div>
      );
    }

    // Agents card component with pagination
    function AgentsCard({ agents, onSelectAgent }) {
      const [page, setPage] = useState(0);
      const pageSize = 10;
      const totalPages = Math.ceil(agents.length / pageSize);
      const enabled = agents.filter(a => a.enabled).length;
      const paginatedAgents = agents.slice(page * pageSize, (page + 1) * pageSize);

      return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Agents</span>
            <span className="card-badge">{agents.length} total, {enabled} enabled</span>
          </div>
          <div className="agent-list">
            {agents.length === 0 ? (
              <EmptyState
                icon="🤖"
                title="No agents registered"
                description="Create agents to automate complex workflows"
                actionLabel="View documentation"
              />
            ) : (
              paginatedAgents.map(agent => (
                <div
                  key={agent.agentId}
                  className="agent-item"
                  onClick={() => onSelectAgent(agent.agentId)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="agent-name" title={agent.description}>
                    {agent.displayName || agent.agentId}
                  </span>
                  <span style={{ color: agent.enabled ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                    {agent.enabled ? 'active' : 'disabled'}
                  </span>
                </div>
              ))
            )}
          </div>
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              borderTop: '1px solid var(--border-color)',
              marginTop: 8,
            }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{
                  padding: '4px 8px',
                  background: page === 0 ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
                  color: page === 0 ? 'var(--text-muted)' : 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: page === 0 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                {'\\u2190'} Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Page {page + 1} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={{
                  padding: '4px 8px',
                  background: page >= totalPages - 1 ? 'var(--bg-tertiary)' : 'var(--accent-blue)',
                  color: page >= totalPages - 1 ? 'var(--text-muted)' : 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Next {'\\u2192'}
              </button>
            </div>
          )}
        </div>
      );
    }

    // Traces card component (clickable)
    function TracesCard({ traces, onSelectTrace }) {
      // Provider colors matching the Provider Usage histogram
      const providerColors = {
        claude: { bg: 'rgba(255, 145, 77, 0.15)', color: 'var(--accent-orange)' },
        grok: { bg: 'rgba(163, 113, 247, 0.15)', color: 'var(--accent-purple)' },
        gemini: { bg: 'rgba(88, 166, 255, 0.15)', color: 'var(--accent-blue)' },
        codex: { bg: 'rgba(63, 185, 80, 0.15)', color: 'var(--accent-green)' },
        opencode: { bg: 'rgba(63, 185, 185, 0.15)', color: 'var(--accent-cyan)' },
        antigravity: { bg: 'rgba(255, 200, 77, 0.15)', color: '#ffc84d' },
        cursor: { bg: 'rgba(88, 166, 255, 0.15)', color: 'var(--accent-blue)' },
        'local-llm': { bg: 'rgba(163, 163, 163, 0.15)', color: 'var(--text-secondary)' },
      };

      const getProviderStyle = (provider) => {
        const lowerProvider = provider?.toLowerCase() || '';
        const colors = providerColors[lowerProvider] || { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
        return colors;
      };

      const formatDuration = (ms) => {
        if (!ms) return null;
        if (ms < 1000) return \`\${Math.round(ms)}ms\`;
        if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
        return \`\${(ms / 60000).toFixed(1)}m\`;
      };

      const formatRelativeTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return \`\${diffMins}m ago\`;
        if (diffHours < 24) return \`\${diffHours}h ago\`;
        return \`\${diffDays}d ago\`;
      };

      const getCommandIcon = (command) => {
        if (!command) return '▶';
        if (command.includes('discuss')) return '💬';
        if (command.includes('agent')) return '🤖';
        if (command.includes('workflow')) return '⚙';
        if (command.includes('call')) return '📞';
        return '▶';
      };

      const getStatusColor = (status) => {
        switch (status) {
          case 'success': return 'var(--accent-green)';
          case 'failure': return 'var(--accent-red)';
          case 'running': return 'var(--accent-blue)';
          default: return 'var(--text-muted)';
        }
      };

      const getStatusBg = (status) => {
        switch (status) {
          case 'success': return 'rgba(63, 185, 80, 0.1)';
          case 'failure': return 'rgba(248, 81, 73, 0.1)';
          case 'running': return 'rgba(88, 166, 255, 0.1)';
          default: return 'var(--bg-tertiary)';
        }
      };

      const truncateName = (name, maxLen = 45) => {
        if (!name) return 'Unknown';
        if (name.length <= maxLen) return name;
        return name.substring(0, maxLen) + '...';
      };

      return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Traces</span>
            <span className="card-badge">{traces.length} total</span>
          </div>
          <div className="trace-list" style={{ padding: '8px' }}>
            {traces.length === 0 ? (
              <EmptyState
                icon="\\u26A1"
                title="No traces yet"
                description="Run a command like 'ax discuss' or 'ax agent run' to see execution traces here."
              />
            ) : (
              traces.slice(0, 8).map(trace => (
                <div
                  key={trace.traceId}
                  onClick={() => onSelectTrace(trace.traceId)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px',
                    marginBottom: '8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                    borderLeft: \`3px solid \${getStatusColor(trace.status)}\`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'var(--bg-secondary)';
                    e.currentTarget.style.transform = 'translateX(2px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  {/* Icon */}
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: getStatusBg(trace.status),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px',
                    flexShrink: 0,
                  }}>
                    {getCommandIcon(trace.command)}
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Name row */}
                    <div style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text-primary)',
                      marginBottom: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }} title={trace.name || trace.traceId}>
                      {truncateName(trace.name) || trace.traceId.slice(0, 12)}
                    </div>

                    {/* Meta row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}>
                      {/* Status badge */}
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: getStatusBg(trace.status),
                        color: getStatusColor(trace.status),
                        fontWeight: 500,
                        fontSize: '10px',
                        textTransform: 'uppercase',
                      }}>
                        {trace.status === 'running' && (
                          <span style={{ animation: 'blink 1s infinite' }}>●</span>
                        )}
                        {trace.status}
                      </span>

                      {/* Duration */}
                      {trace.durationMs && (
                        <span style={{ fontFamily: 'monospace' }}>
                          {formatDuration(trace.durationMs)}
                        </span>
                      )}

                      {/* Time */}
                      <span>{formatRelativeTime(trace.startTime)}</span>

                      {/* Event count */}
                      <span style={{ marginLeft: 'auto' }}>
                        {trace.eventCount} events
                      </span>
                    </div>

                    {/* Providers row - colored bubbles */}
                    {trace.providers && trace.providers.length > 0 && (
                      <div style={{
                        display: 'flex',
                        gap: '4px',
                        marginTop: '6px',
                        flexWrap: 'wrap',
                      }}>
                        {trace.providers.slice(0, 4).map(provider => {
                          const style = getProviderStyle(provider);
                          return (
                            <span
                              key={provider}
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                background: style.bg,
                                color: style.color,
                                fontSize: '10px',
                                fontWeight: 600,
                                border: \`1px solid \${style.color}30\`,
                              }}
                            >
                              {provider}
                            </span>
                          );
                        })}
                        {trace.providers.length > 4 && (
                          <span style={{
                            padding: '2px 6px',
                            color: 'var(--text-muted)',
                            fontSize: '10px',
                          }}>
                            +{trace.providers.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // Workflows card component
    function WorkflowsCard({ workflows, onSelectWorkflow }) {
      return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Workflows</span>
            <span className="card-badge">{workflows.length} total</span>
          </div>
          <div className="workflow-list">
            {workflows.length === 0 ? (
              <EmptyState
                icon="\\u2699"
                title="No workflows found"
                description="Create workflow YAML files in the workflows/ directory to see them here."
              />
            ) : (
              workflows.slice(0, 10).map(workflow => (
                <div
                  key={workflow.workflowId}
                  className="workflow-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectWorkflow(workflow.workflowId)}
                >
                  <div className="workflow-name">{workflow.name}</div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {workflow.stepCount} steps
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    // Execution Stats card component
    function ExecutionStatsCard({ traces }) {
      // Calculate stats from last 200 traces (matching histogram)
      const recentTraces = traces.slice(0, 200);
      const totalExecutions = recentTraces.length;

      const successfulTraces = recentTraces.filter(t => t.status === 'success');
      const failedTraces = recentTraces.filter(t => t.status === 'failure');
      const runningTraces = recentTraces.filter(t => t.status === 'running');
      const successRate = totalExecutions > 0
        ? (successfulTraces.length / totalExecutions) * 100
        : 0;

      const tracesWithDuration = recentTraces.filter(t => t.durationMs && t.durationMs > 0);
      const avgDuration = tracesWithDuration.length > 0
        ? tracesWithDuration.reduce((sum, t) => sum + t.durationMs, 0) / tracesWithDuration.length
        : 0;

      // Count unique providers
      const providersSet = new Set();
      recentTraces.forEach(t => {
        if (t.providers && Array.isArray(t.providers)) {
          t.providers.forEach(p => providersSet.add(p));
        }
      });
      const providersUsed = providersSet.size;

      const formatDuration = (ms) => {
        if (ms < 1000) return \`\${Math.round(ms)}ms\`;
        if (ms < 60000) return \`\${(ms / 1000).toFixed(1)}s\`;
        return \`\${(ms / 60000).toFixed(1)}m\`;
      };

      const getSuccessColor = (rate) => {
        if (rate >= 90) return 'var(--accent-green)';
        if (rate >= 70) return 'var(--accent-yellow)';
        return 'var(--accent-red)';
      };

      const statBoxStyle = {
        background: 'var(--bg-tertiary)',
        borderRadius: '8px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      };

      const iconStyle = {
        width: '32px',
        height: '32px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        marginBottom: '4px',
      };

      return (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Execution Stats (Last 200 Records)</span>
            {runningTraces.length > 0 && (
              <span style={{
                background: 'var(--accent-blue)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 500,
              }}>
                {runningTraces.length} running
              </span>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginTop: '12px'
          }}>
            {/* Total Runs */}
            <div style={statBoxStyle}>
              <div style={{ ...iconStyle, background: 'rgba(88, 166, 255, 0.15)' }}>
                <span style={{ color: 'var(--accent-blue)' }}>▶</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
                {totalExecutions}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Runs</div>
            </div>

            {/* Success Rate */}
            <div style={statBoxStyle}>
              <div style={{ ...iconStyle, background: 'rgba(63, 185, 80, 0.15)' }}>
                <span style={{ color: 'var(--accent-green)' }}>✓</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: getSuccessColor(successRate), lineHeight: 1 }}>
                  {successRate.toFixed(0)}
                </span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>%</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Success Rate</div>
              <div style={{
                height: '4px',
                background: 'var(--bg-secondary)',
                borderRadius: '2px',
                overflow: 'hidden',
                marginTop: '4px'
              }}>
                <div style={{
                  height: '100%',
                  width: \`\${successRate}%\`,
                  background: getSuccessColor(successRate),
                  borderRadius: '2px',
                  transition: 'width 0.3s ease'
                }}></div>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                {successfulTraces.length} passed · {failedTraces.length} failed
              </div>
            </div>

            {/* Avg Duration */}
            <div style={statBoxStyle}>
              <div style={{ ...iconStyle, background: 'rgba(163, 113, 247, 0.15)' }}>
                <span style={{ color: 'var(--accent-purple)' }}>⏱</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-purple)', lineHeight: 1 }}>
                {formatDuration(avgDuration)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Avg Duration</div>
            </div>

            {/* Providers Used */}
            <div style={statBoxStyle}>
              <div style={{ ...iconStyle, background: 'rgba(56, 211, 159, 0.15)' }}>
                <span style={{ color: 'var(--accent-cyan)' }}>⚡</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-cyan)', lineHeight: 1 }}>
                {providersUsed}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Providers</div>
              {providersSet.size > 0 && (
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {Array.from(providersSet).slice(0, 3).join(', ')}
                  {providersSet.size > 3 ? \` +\${providersSet.size - 3}\` : ''}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Main Dashboard component
    function Dashboard() {
      const [view, setView] = useState('dashboard');
      const [selectedTraceId, setSelectedTraceId] = useState(null);
      const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
      const [selectedAgentId, setSelectedAgentId] = useState(null);
      const [data, setData] = useState(null);
      const [workflows, setWorkflows] = useState([]);
      const [error, setError] = useState(null);
      const [lastUpdate, setLastUpdate] = useState(Date.now());
      const refreshInterval = 5000; // 5 seconds

      const fetchData = useCallback(async () => {
        try {
          const [statusResponse, workflowsResponse] = await Promise.all([
            fetch('/api/status'),
            fetch('/api/workflows'),
          ]);
          const statusResult = await statusResponse.json();
          const workflowsResult = await workflowsResponse.json();

          if (statusResult.success) {
            setData(statusResult.data);
            setLastUpdate(Date.now());
            setError(null);
          } else {
            setError(statusResult.error || 'Failed to fetch data');
          }

          if (workflowsResult.success) {
            setWorkflows(workflowsResult.data || []);
          }
        } catch (err) {
          setError(err.message);
        }
      }, []);

      useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, refreshInterval);
        return () => clearInterval(interval);
      }, [fetchData]);

      // Handle trace selection
      const handleSelectTrace = (traceId) => {
        setSelectedTraceId(traceId);
        setView('trace-detail');
      };

      // Handle workflow selection
      const handleSelectWorkflow = (workflowId) => {
        setSelectedWorkflowId(workflowId);
        setView('workflow-detail');
      };

      // Handle agent selection
      const handleSelectAgent = (agentId) => {
        setSelectedAgentId(agentId);
        setView('agent-detail');
      };

      // Render agent detail
      if (view === 'agent-detail' && selectedAgentId) {
        return (
          <div className="container">
            <AgentDetail
              agentId={selectedAgentId}
              onBack={() => {
                setSelectedAgentId(null);
                setView('dashboard');
              }}
            />
          </div>
        );
      }

      // Render trace detail
      if (view === 'trace-detail' && selectedTraceId) {
        return (
          <div className="container">
            <TraceDetail
              traceId={selectedTraceId}
              onBack={() => {
                setSelectedTraceId(null);
                setView('dashboard');
              }}
            />
          </div>
        );
      }

      // Render workflow detail
      if (view === 'workflow-detail' && selectedWorkflowId) {
        return (
          <div className="container">
            <WorkflowDetail
              workflowId={selectedWorkflowId}
              onBack={() => {
                setSelectedWorkflowId(null);
                setView('workflows');
              }}
            />
          </div>
        );
      }

      if (error) {
        return (
          <div className="container">
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: 'var(--accent-red)', marginBottom: '16px' }}>{'\\u26A0'} Error</div>
              <div>{error}</div>
            </div>
          </div>
        );
      }

      if (!data) {
        return <DashboardSkeleton />;
      }

      const runningCount = (data.traces || []).filter(t => t.status === 'running').length;
      const historyCount = (data.traces || []).length;

      return (
        <div className="container">
          <div className="header">
            <h1>
              <span>{'\\u2630'}</span>
              AutomatosX Monitor
            </h1>
            <div className="header-status">
              <LiveIndicator lastUpdate={lastUpdate} refreshInterval={refreshInterval} />
              <span className={\`status-badge \${data.status}\`}>
                <span className={\`status-dot \${data.status}\`}></span>
                {data.status.toUpperCase()}
              </span>
              <span className="version">v{data.version}</span>
            </div>
          </div>

          <nav className="nav-tabs" role="tablist" aria-label="Dashboard navigation" onKeyDown={(e) => {
            const tabs = ['dashboard', 'history', 'workflows', 'providers', 'agents'];
            const currentIndex = tabs.indexOf(view);
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              setView(tabs[(currentIndex + 1) % tabs.length]);
            } else if (e.key === 'ArrowLeft') {
              e.preventDefault();
              setView(tabs[(currentIndex - 1 + tabs.length) % tabs.length]);
            } else if (e.key === 'Home') {
              e.preventDefault();
              setView(tabs[0]);
            } else if (e.key === 'End') {
              e.preventDefault();
              setView(tabs[tabs.length - 1]);
            }
          }}>
            <button
              role="tab"
              aria-selected={view === 'dashboard'}
              aria-controls="panel-dashboard"
              tabIndex={view === 'dashboard' ? 0 : -1}
              className={\`nav-tab \${view === 'dashboard' ? 'active' : ''}\`}
              onClick={() => setView('dashboard')}
            >
              Dashboard
              {runningCount > 0 && <span className="tab-badge">{runningCount} running</span>}
            </button>
            <button
              role="tab"
              aria-selected={view === 'history'}
              aria-controls="panel-history"
              tabIndex={view === 'history' ? 0 : -1}
              className={\`nav-tab \${view === 'history' ? 'active' : ''}\`}
              onClick={() => setView('history')}
            >
              History
              <span className="tab-badge">{historyCount}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === 'workflows'}
              aria-controls="panel-workflows"
              tabIndex={view === 'workflows' ? 0 : -1}
              className={\`nav-tab \${view === 'workflows' ? 'active' : ''}\`}
              onClick={() => setView('workflows')}
            >
              Workflows
              <span className="tab-badge">{workflows.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === 'providers'}
              aria-controls="panel-providers"
              tabIndex={view === 'providers' ? 0 : -1}
              className={\`nav-tab \${view === 'providers' ? 'active' : ''}\`}
              onClick={() => setView('providers')}
            >
              Providers
              <span className="tab-badge">{(data.providers || []).filter(p => p.available).length}/{(data.providers || []).length}</span>
            </button>
            <button
              role="tab"
              aria-selected={view === 'agents'}
              aria-controls="panel-agents"
              tabIndex={view === 'agents' ? 0 : -1}
              className={\`nav-tab \${view === 'agents' ? 'active' : ''}\`}
              onClick={() => setView('agents')}
            >
              Agents
              <span className="tab-badge">{(data.agents || []).filter(a => a.enabled).length}</span>
            </button>
          </nav>

          <main id="main-content" aria-label="Dashboard content">
          {view === 'dashboard' && (
            <section role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
              <ActiveProcesses
                traces={data.traces || []}
                sessions={data.sessions || []}
              />

              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--accent-blue)' }}>
                    {(data.providers || []).filter(p => p.available).length}
                  </div>
                  <div className="metric-label">Providers Online</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--accent-purple)' }}>
                    {(data.metrics && data.metrics.activeSessions) || 0}
                  </div>
                  <div className="metric-label">Active Sessions</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--accent-green)' }}>
                    {(data.metrics && data.metrics.activeAgents) || 0}
                  </div>
                  <div className="metric-label">Enabled Agents</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
                    {(data.traces || []).filter(t => t.status === 'success').length}
                  </div>
                  <div className="metric-label">Successful Runs</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value" style={{ color: 'var(--text-primary)' }}>
                    {data.uptime}
                  </div>
                  <div className="metric-label">Uptime</div>
                </div>
              </div>

              <ProviderUsageHistogram traces={data.traces || []} />

              <ExecutionStatsCard traces={data.traces || []} />

              <TracesCard traces={data.traces || []} onSelectTrace={handleSelectTrace} />
            </section>
          )}

          {view === 'history' && (
            <section role="tabpanel" id="panel-history" aria-labelledby="tab-history">
              <HistoryView
                traces={data.traces || []}
                onSelectTrace={handleSelectTrace}
              />
            </section>
          )}

          {view === 'workflows' && (
            <section role="tabpanel" id="panel-workflows" aria-labelledby="tab-workflows">
              <WorkflowsView workflows={workflows} onSelectWorkflow={handleSelectWorkflow} />
            </section>
          )}

          {view === 'providers' && (
            <section role="tabpanel" id="panel-providers" aria-labelledby="tab-providers">
              <ProvidersView providers={data.providers || []} />
            </section>
          )}

          {view === 'agents' && (
            <section role="tabpanel" id="panel-agents" aria-labelledby="tab-agents">
              <AgentsView agents={data.agents || []} onSelectAgent={handleSelectAgent} />
            </section>
          )}
          </main>
        </div>
      );
    }

    // Error boundary for catching React errors
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }

      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }

      componentDidCatch(error, errorInfo) {
        console.error('React Error:', error, errorInfo);
      }

      render() {
        if (this.state.hasError) {
          return (
            <div style={{ padding: 24, color: '#f85149', background: '#161b22', minHeight: '100vh' }}>
              <h1>Dashboard Error</h1>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>
          );
        }
        return this.props.children;
      }
    }

    // Render the app with error boundary
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        <ErrorBoundary>
          <Dashboard />
        </ErrorBoundary>
      );
      console.log('Dashboard rendered successfully');
    } catch (err) {
      console.error('Failed to render dashboard:', err);
      document.getElementById('root').innerHTML =
        '<div style="padding:24px;color:#f85149">Failed to render: ' + err.message + '</div>';
    }
  </script>
</body>
</html>`;
}
