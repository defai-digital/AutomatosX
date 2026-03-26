export const MONITOR_DASHBOARD_SCRIPT_OVERVIEW = `
    /* ── Overview ───────────────────────────────────── */

    function renderFailedCallout(traces) {
      const failed = traces.filter(function(t) { return t.status === 'failed'; })
        .sort(function(a, b) { return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(); })
        .slice(0, 5);
      if (failed.length === 0) {
        return '<div class="healthy-callout">✓ All clear — no failed traces in the last ' + traces.length + ' runs.</div>';
      }
      let html = '<div class="failed-callout"><h2>⚠ Failed Executions <span style="font-size:11px;font-weight:400;color:var(--danger)">(' + failed.length + ')</span></h2><div class="stack">';
      for (const t of failed) {
        html += miniTraceRow(t);
      }
      html += '</div></div>';
      return html;
    }

    function renderRecentActivity(traces) {
      const recent = traces.slice()
        .sort(function(a, b) { return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(); })
        .slice(0, 6);
      return renderSection(
        'Recent Activity',
        renderStackOrEmpty(recent, miniTraceRow, workflowEmptyStateHint('overview')),
        {
          actionHtml: '<span class="view-all-link" data-tab="activity" onclick="switchTab(this.dataset.tab)">View all →</span>',
        },
      );
    }

    function renderRunningNow(state) {
      const runningTraces = Array.isArray(state.status.runningTraces) && state.status.runningTraces.length > 0
        ? state.status.runningTraces.slice(0, 6)
        : (state.traces || []).filter(function(trace) { return trace.status === 'running'; }).slice(0, 6);
      const activeSessions = Array.isArray(state.status.activeSessions) && state.status.activeSessions.length > 0
        ? state.status.activeSessions.slice(0, 6)
        : (state.sessions || []).filter(function(session) { return session.status === 'active'; }).slice(0, 6);

      const runningHtml = renderSection(
        'Running Now',
        renderStackOrEmpty(runningTraces, miniTraceRow, 'No workflows are currently running.'),
        {
          count: runningTraces.length,
          subcopy: 'Keep this panel open during long-running workflows. It refreshes automatically while runs are active.',
        },
      );

      const sessionHtml = renderSection(
        'Active Sessions',
        renderStackOrEmpty(activeSessions, sessionRow, 'No active sessions right now.'),
        {
          count: activeSessions.length,
          subcopy: 'Sessions group related work so you can see who is participating and what is still in-flight.',
        },
      );

      return '<div class="dual-grid">' + runningHtml + sessionHtml + '</div>';
    }

    function renderProviderUsage(traces) {
      const usage = buildProviderUsage(traces).slice(0, 6);
      let bodyHtml = '';
      if (usage.length === 0) {
        bodyHtml = renderEmptyStateHtml('No provider activity recorded in the current trace window.');
      } else {
        const maxCount = Math.max.apply(null, usage.map(function(entry) { return entry.count; }));
        bodyHtml = '<div class="provider-usage-list">';
        for (const entry of usage) {
          const width = maxCount > 0 ? Math.max(8, Math.round(entry.count / maxCount * 100)) : 0;
          const label = entry.failed > 0
            ? entry.count + ' traces · ' + entry.failed + ' failed'
            : entry.running > 0
              ? entry.count + ' traces · ' + entry.running + ' running'
              : entry.count + ' traces';
          bodyHtml += '<div class="provider-usage-row">'
            + '<div class="provider-usage-label">' + esc(entry.providerId) + '</div>'
            + '<div class="provider-usage-track"><div class="provider-usage-fill" style="width:' + width + '%"></div></div>'
            + '<div class="provider-usage-value">' + esc(label) + '</div>'
            + '</div>';
        }
        bodyHtml += '</div>';
      }
      return renderSection('Provider Usage', bodyHtml, {
        subcopy: 'Recent traces grouped by provider so operator issues are visible without drilling into each run.',
      });
    }

    function renderGovernanceOverview(state) {
      const aggregate = state && state.governance && typeof state.governance === 'object'
        ? state.governance
        : null;
      const latest = aggregate && aggregate.latest && typeof aggregate.latest === 'object'
        ? aggregate.latest
        : null;
      const blockedCount = aggregate && typeof aggregate.blockedCount === 'number'
        ? aggregate.blockedCount
        : 0;
      const deniedImportedSkills = aggregate && aggregate.deniedImportedSkills && typeof aggregate.deniedImportedSkills === 'object'
        ? aggregate.deniedImportedSkills
        : null;
      const deniedImportedSkillCount = deniedImportedSkills && typeof deniedImportedSkills.deniedCount === 'number'
        ? deniedImportedSkills.deniedCount
        : 0;
      const latestDeniedImportedSkill = deniedImportedSkills && deniedImportedSkills.latest && typeof deniedImportedSkills.latest === 'object'
        ? deniedImportedSkills.latest
        : null;
      const deniedInstalledBridges = state && state.deniedInstalledBridges && typeof state.deniedInstalledBridges === 'object'
        ? state.deniedInstalledBridges
        : null;
      const deniedInstalledBridgeCount = deniedInstalledBridges && typeof deniedInstalledBridges.deniedCount === 'number'
        ? deniedInstalledBridges.deniedCount
        : 0;
      const latestDeniedInstalledBridge = deniedInstalledBridges && deniedInstalledBridges.latest && typeof deniedInstalledBridges.latest === 'object'
        ? deniedInstalledBridges.latest
        : null;

      if (blockedCount === 0 && deniedImportedSkillCount === 0 && deniedInstalledBridgeCount === 0) {
        return '';
      }

      let bodyHtml = '';
      if (blockedCount > 0 && latest !== null && typeof latest.summary === 'string' && latest.summary.length > 0) {
        const toolName = typeof latest.toolName === 'string' && latest.toolName.length > 0 ? latest.toolName : 'n/a';
        const trustState = typeof latest.trustState === 'string' && latest.trustState.length > 0 ? latest.trustState : 'n/a';
        const requiredTrustStates = Array.isArray(latest.requiredTrustStates)
          ? latest.requiredTrustStates.filter(function(value) { return typeof value === 'string' && value.length > 0; })
          : [];
        bodyHtml += renderEscapedDetailBlock(latest.summary)
          + '<div class="columns"><div>'
          + kvRow('Latest trace', latest.traceId || 'n/a')
          + kvRow('Tool', toolName)
          + '</div><div>'
          + kvRow('Trust state', trustState)
          + kvRow('Required trust', requiredTrustStates.length > 0 ? requiredTrustStates.join(', ') : 'n/a')
          + '</div></div>';
      }

      if (deniedImportedSkillCount > 0 && latestDeniedImportedSkill !== null && typeof latestDeniedImportedSkill.summary === 'string' && latestDeniedImportedSkill.summary.length > 0) {
        bodyHtml += (bodyHtml.length > 0 ? '<div class="section-divider"></div>' : '')
          + renderEscapedDetailBlock(latestDeniedImportedSkill.summary)
          + '<div class="columns"><div>'
          + kvRow('Latest denied skill', latestDeniedImportedSkill.skillId || 'n/a')
          + kvRow('Path', latestDeniedImportedSkill.relativePath || 'n/a')
          + '</div><div>'
          + kvRow('Trust state', latestDeniedImportedSkill.trustState || 'n/a')
          + kvRow('Source', latestDeniedImportedSkill.sourceRef || 'n/a')
          + '</div></div>';
      }

      if (deniedInstalledBridgeCount > 0 && latestDeniedInstalledBridge !== null && typeof latestDeniedInstalledBridge.summary === 'string' && latestDeniedInstalledBridge.summary.length > 0) {
        bodyHtml += (bodyHtml.length > 0 ? '<div class="section-divider"></div>' : '')
          + renderEscapedDetailBlock(latestDeniedInstalledBridge.summary)
          + '<div class="columns"><div>'
          + kvRow('Latest denied bridge', latestDeniedInstalledBridge.bridgeId || 'n/a')
          + kvRow('Path', latestDeniedInstalledBridge.relativePath || 'n/a')
          + '</div><div>'
          + kvRow('Trust state', latestDeniedInstalledBridge.trustState || 'n/a')
          + kvRow('Source', latestDeniedInstalledBridge.sourceRef || 'n/a')
          + '</div></div>';
      }

      const totalCount = blockedCount + deniedImportedSkillCount + deniedInstalledBridgeCount;
      const hasTraceBlocks = blockedCount > 0;
      const hasDeniedSkills = deniedImportedSkillCount > 0;
      const hasDeniedBridges = deniedInstalledBridgeCount > 0;
      let subcopy = 'Recent traces blocked by runtime-governance. Open the failed run for step-level context and remediation details.';
      if (hasTraceBlocks && hasDeniedSkills && hasDeniedBridges) {
        subcopy = 'Recent traces blocked by runtime-governance, imported skills denied by workspace trust policy, and installed bridges that currently cannot execute.';
      } else if (hasTraceBlocks && hasDeniedSkills) {
        subcopy = 'Recent traces blocked by runtime-governance and imported skills currently denied by workspace trust policy.';
      } else if (hasTraceBlocks && hasDeniedBridges) {
        subcopy = 'Recent traces blocked by runtime-governance and installed bridges that currently cannot execute.';
      } else if (hasDeniedSkills && hasDeniedBridges) {
        subcopy = 'Imported skills and installed bridges currently denied by workspace trust policy.';
      } else if (hasDeniedSkills) {
        subcopy = 'Imported skills currently denied by workspace trust policy.';
      } else if (hasDeniedBridges) {
        subcopy = 'Installed bridges currently denied by workspace trust policy.';
      }

      return renderSection('Runtime Governance', bodyHtml, {
        count: totalCount,
        subcopy: subcopy,
      });
    }

    function renderOverview(state) {
      const runningCount = state.status.traces.running;
      const failedCount = state.status.traces.failed;
      const completedCount = state.status.traces.completed;
      const totalSparkline = renderSparkline(hourlyBuckets, 'total', 'spark-total');
      const failedSparkline = renderSparkline(hourlyBuckets, 'failed', 'spark-failed');
      const runningCard = '<div class="card' + (runningCount > 0 ? ' card-running' : '') + '">'
        + '<h2>Running Now</h2><div class="count' + (runningCount > 0 ? ' running-color' : '') + '">' + esc(runningCount) + '</div>'
        + '<div class="card-label">' + esc(state.status.sessions.active) + ' active sessions</div>'
        + totalSparkline + '</div>';
      const failedCard = '<div class="card' + (failedCount > 0 ? ' card-danger' : '') + '">'
        + '<h2>Failed</h2><div class="count' + (failedCount > 0 ? ' danger' : '') + '">' + esc(failedCount) + '</div>'
        + '<div class="card-label">' + esc(completedCount) + ' completed total</div>'
        + failedSparkline + '</div>';
      const agentNames = (state.agents || []).slice(0, 3).map(function(a) { return a.name || a.agentId; });
      const agentSubtext = agentNames.length > 0
        ? agentNames.map(function(n) { return esc(n); }).join(', ') + (state.agents.length > 3 ? ' +' + (state.agents.length - 3) + ' more' : '')
        : esc(state.workflows.length) + ' workflows available';
      const agentCard = '<div class="card"><h2>Agents</h2><div class="count">' + esc(state.agents.length) + '</div>'
        + '<div class="card-label">' + agentSubtext + '</div></div>';
      const providerCard = '<div class="card"><h2>Providers</h2><div class="count">' + esc(state.providers.enabledProviders.length) + '</div>'
        + '<div class="card-label">' + esc(state.providers.source === 'cached' ? 'snapshot cached' : 'snapshot unavailable')
        + ' · ' + esc(state.status.runtime.defaultProvider || 'no default') + '</div></div>';
      const cards = '<div class="grid">' + runningCard + failedCard + agentCard + providerCard + '</div>';

      const governance = renderGovernanceOverview(state);
      const callout = renderFailedCallout(state.traces || []);
      const runningNow = renderRunningNow(state);
      const recent = renderRecentActivity(state.traces || []);
      const providerUsage = renderProviderUsage(state.traces || []);

      const runtimeSection = '<div class="columns"><div class="section"><h2>Runtime</h2>'
        + kvRow('Execution mode', state.status.runtime.providerExecutionMode)
        + kvRow('Default provider', state.status.runtime.defaultProvider || 'n/a')
        + kvRow('Configured executors', (state.status.runtime.configuredExecutors || []).join(', ') || 'none')
        + '</div><div class="section"><h2>Providers</h2>'
        + kvRow('Detected', (state.providers.detectedProviders || []).join(', ') || 'none')
        + kvRow('Enabled', (state.providers.enabledProviders || []).join(', ') || 'none')
        + kvRow('Disabled', (state.providers.installedButDisabledProviders || []).join(', ') || 'none')
        + kvRow('Snapshot', state.providers.generatedAt ? timeAgo(state.providers.generatedAt) : 'unavailable')
        + '</div></div>';

      return cards + governance + callout + runningNow + recent + providerUsage + runtimeSection;
    }

    /* ── Sparklines ─────────────────────────────────── */

    let hourlyBuckets = null;
    let hourlyLoadedAt = 0;
    let hourlyLoading = false;

    function renderSparkline(buckets, field, cssClass) {
      if (!Array.isArray(buckets) || buckets.length === 0) return '';
      const vals = buckets.map(function(b) { return b[field] || 0; });
      const max = Math.max.apply(null, vals);
      if (max === 0) return '';
      let bars = '';
      for (var i = 0; i < vals.length; i++) {
        const h = Math.max(2, Math.round((vals[i] / max) * 28));
        const label = buckets[i].hour.slice(0, 13).replace('T', ' ') + 'h: ' + vals[i];
        bars += '<div class="spark-bar ' + cssClass + '" style="height:' + h + 'px" title="' + esc(label) + '"></div>';
      }
      return '<div class="sparkline" title="Last 24h">' + bars + '</div>';
    }

    async function loadHourlyMetrics() {
      const now = Date.now();
      if (hourlyLoading || (hourlyBuckets !== null && now - hourlyLoadedAt < 60000)) return;
      hourlyLoading = true;
      try {
        const res = await fetch('/api/metrics/hourly', { headers: { accept: 'application/json' } });
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          hourlyBuckets = json.data;
          hourlyLoadedAt = now;
          if (currentTab === 'overview' && currentDetail === null) render();
        }
      } catch {
        // sparklines are optional — fail silently
      } finally {
        hourlyLoading = false;
      }
    }
`;
