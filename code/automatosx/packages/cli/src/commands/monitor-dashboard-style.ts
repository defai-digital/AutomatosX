export const MONITOR_DASHBOARD_STYLES = `
    :root {
      --bg: #0d1117;
      --panel: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --muted: #8b949e;
      --accent: #58a6ff;
      --success: #3fb950;
      --warn: #d29922;
      --danger: #f85149;
      --running-glow: rgba(88,166,255,0.18);
      --failed-glow: rgba(248,81,73,0.12);
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: radial-gradient(circle at top, #111c2e 0%, var(--bg) 45%); color: var(--text); font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .container { max-width: 1400px; margin: 0 auto; padding: 24px; }

    /* Header */
    .header { display: flex; justify-content: space-between; gap: 16px; align-items: center; margin-bottom: 24px; border-bottom: 1px solid var(--border); padding-bottom: 20px; }
    h1 { margin: 0 0 4px; color: var(--accent); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; }
    .subtitle { color: var(--muted); font-size: 12px; }
    .toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); display: inline-block; animation: livepulse 2s ease-in-out infinite; }
    .live-dot.stale { background: var(--danger); animation: none; }
    @keyframes livepulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(0.8); } }
    .live-label { font-size: 12px; color: var(--muted); display: flex; align-items: center; gap: 6px; }
    .raw-link { font-size: 11px; color: var(--muted); text-decoration: none; border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; cursor: pointer; background: transparent; }
    .raw-link:hover { color: var(--text); border-color: var(--accent); }
    .refresh-btn { font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 5px 11px; cursor: pointer; background: transparent; display: inline-flex; align-items: center; gap: 5px; }
    .refresh-btn:hover { color: var(--text); border-color: var(--accent); }
    .refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .action-bar { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .action-btn { font-size: 12px; color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; cursor: pointer; background: transparent; display: inline-flex; align-items: center; gap: 5px; }
    .action-btn:hover { color: var(--text); border-color: var(--accent); }
    .action-btn.copied { color: var(--success); border-color: var(--success); }
    .toast { position: fixed; bottom: 24px; right: 24px; background: var(--panel); border: 1px solid var(--border); border-radius: 8px; padding: 10px 16px; font-size: 13px; color: var(--text); box-shadow: 0 4px 20px rgba(0,0,0,0.4); z-index: 999; opacity: 0; transition: opacity 0.2s; pointer-events: none; }
    .toast.show { opacity: 1; }

    /* Tabs */
    .tabs { display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap; }
    .tab { border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
    .tab:hover { color: var(--text); border-color: rgba(88,166,255,0.4); }
    .tab.active { background: var(--accent); color: #08111f; border-color: var(--accent); font-weight: 600; }

    /* Cards */
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 20px; }
    .card { background: linear-gradient(180deg, rgba(255,255,255,0.025), transparent), var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 16px 18px; }
    .card.card-danger { border-color: rgba(248,81,73,0.4); background: linear-gradient(180deg, rgba(248,81,73,0.05), transparent), var(--panel); }
    .card.card-running { border-color: rgba(88,166,255,0.35); }
    .card h2 { margin: 0 0 10px; color: var(--muted); font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }
    .count { font-size: 36px; font-weight: 700; margin-bottom: 4px; line-height: 1; }
    .count.danger { color: var(--danger); }
    .count.running-color { color: var(--accent); }
    .card-label { color: var(--muted); font-size: 12px; line-height: 1.5; }

    /* Sections */
    .section { background: linear-gradient(180deg, rgba(255,255,255,0.02), transparent), var(--panel); border: 1px solid var(--border); border-radius: 12px; padding: 18px; margin-bottom: 16px; }
    .section h2 { margin: 0 0 14px; color: var(--accent); font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .section-count { background: rgba(88,166,255,0.12); color: var(--accent); border-radius: 999px; padding: 1px 8px; font-size: 11px; font-weight: 600; }

    /* Failed callout */
    .failed-callout { background: linear-gradient(180deg, rgba(248,81,73,0.08), transparent), var(--panel); border: 1px solid rgba(248,81,73,0.4); border-radius: 12px; padding: 18px; margin-bottom: 20px; }
    .failed-callout h2 { margin: 0 0 14px; color: var(--danger); font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; display: flex; align-items: center; gap: 8px; }
    .healthy-callout { background: rgba(63,185,80,0.04); border: 1px solid rgba(63,185,80,0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px; color: var(--success); font-size: 13px; display: flex; align-items: center; gap: 10px; }

    /* Rows */
    .stack { display: grid; gap: 2px; }
    .row { display: flex; justify-content: space-between; gap: 12px; border-radius: 8px; padding: 10px 10px; align-items: center; }
    .row + .row { border-top: 1px solid rgba(255,255,255,0.04); }
    .row-main { flex: 1; min-width: 0; }
    .row-title { font-weight: 600; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .row-title.workflow-name { color: var(--text); }
    .row-sub { color: var(--muted); font-size: 12px; margin-top: 3px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .row-meta { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
    .duration-label { color: var(--muted); font-size: 12px; font-family: ui-monospace, monospace; min-width: 52px; text-align: right; }
    .time-ago { color: var(--muted); font-size: 11px; min-width: 52px; text-align: right; }
    .trace-id-short { font-family: ui-monospace, monospace; font-size: 11px; color: var(--muted); }

    /* Running row accent */
    .row-running { border-left: 3px solid var(--accent) !important; padding-left: 8px !important; background: var(--running-glow); }
    .row-failed { border-left: 3px solid var(--danger) !important; padding-left: 8px !important; background: var(--failed-glow); }

    /* Badges */
    .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 3px 9px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .badge.running, .badge.active { background: rgba(88,166,255,0.15); color: var(--accent); animation: badgepulse 2s ease-in-out infinite; }
    .badge.completed, .badge.healthy { background: rgba(63,185,80,0.12); color: var(--success); }
    .badge.failed, .badge.unhealthy { background: rgba(248,81,73,0.12); color: var(--danger); }
    .badge.warning { background: rgba(210,153,34,0.12); color: var(--warn); }
    @keyframes badgepulse { 0%,100% { opacity:1; } 50% { opacity:0.65; } }

    /* Filter bar */
    .filter-bar { display: flex; gap: 8px; align-items: center; margin-bottom: 14px; flex-wrap: wrap; }
    .filter-pill { border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 999px; padding: 5px 12px; cursor: pointer; font-size: 12px; }
    .filter-pill:hover { border-color: rgba(88,166,255,0.4); color: var(--text); }
    .filter-pill.active { background: rgba(88,166,255,0.15); color: var(--accent); border-color: rgba(88,166,255,0.5); font-weight: 600; }
    .filter-sep { color: var(--border); }
    select.filter-select { background: var(--panel); border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 5px 10px; font-size: 12px; cursor: pointer; }
    select.filter-select:focus { outline: none; border-color: var(--accent); }
    .search-input { min-width: 220px; background: rgba(255,255,255,0.02); border: 1px solid var(--border); color: var(--text); border-radius: 8px; padding: 7px 10px; font-size: 12px; }
    .search-input::placeholder { color: var(--muted); }
    .search-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(88,166,255,0.12); }
    .pagination-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
    .pagination-summary { color: var(--muted); font-size: 12px; }
    .pagination-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pagination-btn { border: 1px solid var(--border); background: transparent; color: var(--muted); border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 12px; }
    .pagination-btn:hover { color: var(--text); border-color: rgba(88,166,255,0.4); }
    .pagination-btn:disabled { cursor: default; opacity: 0.5; color: var(--muted); border-color: var(--border); }
    .pagination-label { color: var(--muted); font-size: 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

    /* Detail views */
    .back-btn { background: transparent; border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 6px 14px; cursor: pointer; font-size: 13px; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 6px; }
    .back-btn:hover { color: var(--text); border-color: var(--accent); }
    .detail-header { margin-bottom: 22px; }
    .detail-workflow { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
    .detail-traceid { font-family: ui-monospace, monospace; font-size: 13px; color: var(--muted); margin-bottom: 12px; word-break: break-all; }
    .detail-chips { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .chip { background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font-size: 12px; color: var(--muted); }
    .chip strong { color: var(--text); }
    .error-block { background: rgba(248,81,73,0.06); border: 1px solid rgba(248,81,73,0.4); border-radius: 10px; padding: 16px; margin-bottom: 18px; }
    .error-block h3 { margin: 0 0 10px; color: var(--danger); font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; }
    .error-message { font-family: ui-monospace, monospace; font-size: 13px; color: #ff8080; margin-bottom: 8px; }
    .error-detail { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); }

    /* Steps */
    .steps-list { display: grid; gap: 8px; margin-top: 12px; }
    .step-card { border: 1px solid var(--border); border-radius: 10px; padding: 12px 14px; }
    .step-card.step-failed { border-color: rgba(248,81,73,0.35); background: rgba(248,81,73,0.03); }
    .step-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .step-id { font-family: ui-monospace, monospace; font-weight: 600; font-size: 13px; }
    .step-right { display: flex; gap: 8px; align-items: center; }
    .step-dur { color: var(--muted); font-size: 12px; font-family: ui-monospace, monospace; }
    .retry-badge { background: rgba(210,153,34,0.15); color: var(--warn); border-radius: 999px; padding: 2px 7px; font-size: 11px; font-weight: 600; }
    .dur-bar-wrap { height: 4px; background: rgba(255,255,255,0.06); border-radius: 2px; margin-bottom: 8px; }
    .dur-bar { height: 4px; border-radius: 2px; min-width: 2px; }
    .dur-bar.success { background: var(--success); }
    .dur-bar.fail { background: var(--danger); }
    .gantt-wrap { margin-top: 14px; }
    .gantt-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; min-height: 28px; }
    .gantt-label { font-family: ui-monospace, monospace; font-size: 12px; color: var(--muted); width: 160px; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: right; }
    .gantt-track { flex: 1; position: relative; height: 20px; background: rgba(255,255,255,0.04); border-radius: 4px; }
    .gantt-bar { position: absolute; top: 3px; height: 14px; border-radius: 3px; min-width: 3px; }
    .gantt-bar.success { background: var(--success); opacity: 0.85; }
    .gantt-bar.fail { background: var(--danger); opacity: 0.85; }
    .gantt-bar.running { background: var(--accent); opacity: 0.85; animation: badgepulse 2s ease-in-out infinite; }
    .gantt-dur { font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; width: 56px; flex-shrink: 0; text-align: right; }
    .gantt-axis { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); margin: 4px 0 0 170px; padding-right: 66px; opacity: 0.6; }
    .step-error { margin-top: 8px; font-family: ui-monospace, monospace; font-size: 12px; color: #ff8080; background: rgba(248,81,73,0.06); border-radius: 6px; padding: 8px 10px; }

    /* Collapsible */
    .collapsible-toggle { background: transparent; border: none; color: var(--muted); cursor: pointer; font-size: 13px; padding: 0; display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
    .collapsible-toggle:hover { color: var(--text); }
    .collapsible-body { display: none; }
    .collapsible-body.open { display: block; }
    .detail-block { background: var(--bg); border: 1px solid rgba(255,255,255,0.07); border-radius: 8px; padding: 12px; font-size: 12px; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; max-height: 320px; overflow-y: auto; color: #c9d1d9; margin-top: 8px; }

    /* Misc */
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    pre { background: var(--bg); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px; overflow: auto; font-size: 12px; max-height: 600px; color: #c9d1d9; }
    .empty-state { color: var(--muted); font-size: 13px; padding: 24px 0; text-align: center; line-height: 1.6; }
    .empty-state code { font-family: ui-monospace, monospace; background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .clickable { cursor: pointer; }
    .clickable:hover { background: rgba(88,166,255,0.06) !important; }
    .kv-row { display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding: 8px 0; font-size: 13px; }
    .kv-row:last-child { border-bottom: 0; }
    .kv-key { color: var(--muted); }
    .kv-val { color: var(--text); font-family: ui-monospace, monospace; font-size: 12px; text-align: right; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .columns { display: grid; grid-template-columns: 2fr 1fr; gap: 16px; }
    .view-all-link { font-size: 12px; color: var(--accent); cursor: pointer; text-decoration: none; margin-left: auto; }
    .view-all-link:hover { text-decoration: underline; }
    .success-bar-wrap { height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; margin: 4px 0 10px; }
    .success-bar { height: 6px; border-radius: 3px; background: var(--success); }
    .participant-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 13px; }
    .participant-row:last-child { border-bottom: 0; }
    .role-chip { font-size: 11px; border-radius: 4px; padding: 2px 7px; font-weight: 600; }
    .role-chip.initiator { background: rgba(88,166,255,0.15); color: var(--accent); }
    .role-chip.collaborator { background: rgba(63,185,80,0.12); color: var(--success); }
    .role-chip.delegate { background: rgba(210,153,34,0.12); color: var(--warn); }
    /* Sparklines */
    .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 28px; margin-top: 8px; }
    .spark-bar { flex: 1; border-radius: 2px 2px 0 0; min-width: 3px; min-height: 2px; transition: opacity 0.15s; }
    .spark-bar:hover { opacity: 0.7; }
    .spark-total { background: rgba(88,166,255,0.5); }
    .spark-failed { background: rgba(248,81,73,0.7); }
    .dual-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .section-subcopy { color: var(--muted); font-size: 12px; margin: -4px 0 12px; line-height: 1.5; }
    .provider-usage-list { display: grid; gap: 10px; margin-top: 8px; }
    .provider-usage-row { display: grid; grid-template-columns: minmax(0, 140px) 1fr auto; gap: 10px; align-items: center; }
    .provider-usage-label { font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .provider-usage-track { height: 8px; background: rgba(255,255,255,0.06); border-radius: 999px; overflow: hidden; }
    .provider-usage-fill { height: 8px; border-radius: 999px; background: linear-gradient(90deg, rgba(88,166,255,0.75), rgba(63,185,80,0.7)); }
    .provider-usage-value { font-size: 11px; color: var(--muted); font-family: ui-monospace, monospace; min-width: 80px; text-align: right; }
    .running-summary { display: grid; gap: 16px; }
    .running-summary-copy { color: var(--muted); font-size: 12px; line-height: 1.5; margin-bottom: 12px; }
    @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } .header { flex-direction: column; align-items: stretch; } }
    @media (max-width: 900px) { .dual-grid { grid-template-columns: 1fr; } .search-input { min-width: 0; width: 100%; } }
`;
