export const MONITOR_DASHBOARD_SCRIPT_TABS = `
    /* ── Activity Tab ───────────────────────────────── */

    const ACTIVITY_PAGE_SIZE = 25;
    let activityFilter = 'all';
    let activityWorkflow = 'all';
    let activitySearch = '';
    let activityTimeWindow = '7d';
    let activityPage = 1;

    function renderActivity(state) {
      const traces = (state.traces || []).slice();

      // Sort: running first, then by startedAt desc. Coerce invalid/missing
      // timestamps to 0 so the comparator never returns NaN (NaN would make
      // sort order undefined and could scramble traces with bad timestamps).
      traces.sort(function(a, b) {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (b.status === 'running' && a.status !== 'running') return 1;
        const aTime = a && a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bTime = b && b.startedAt ? new Date(b.startedAt).getTime() : 0;
        const aValid = Number.isFinite(aTime) ? aTime : 0;
        const bValid = Number.isFinite(bTime) ? bTime : 0;
        return bValid - aValid;
      });

      // Time-windowed set feeds the workflow dropdown so users only see
      // workflows that actually have runs inside the current window (bug fix:
      // previously the dropdown was built from all traces and could list
      // workflows that then produced an empty result when selected).
      const withinWindow = traces.filter(function(t) {
        return withinTimeWindow(t.startedAt, activityTimeWindow);
      });
      const workflows = Array.from(
        new Set(withinWindow.map(function(t) { return t.workflowId; }).filter(Boolean)),
      ).sort();

      // Pre-filter by everything except status so filter-pill counts reflect
      // the runs each pill would actually show (bug fix: counts previously
      // ignored workflow/search/time filters and could display "All (30)"
      // while the list below rendered an empty state).
      const preStatusFiltered = withinWindow.filter(function(t) {
        const wfOk = activityWorkflow === 'all' || t.workflowId === activityWorkflow;
        const searchOk = matchesQuery(activitySearch, [
          t.workflowId,
          traceDisplayName(t),
          traceSummary(t),
          t.traceId,
          t.status,
          t.surface,
          metadataString(t.metadata, 'command'),
          ...(extractTraceProviders(t)),
        ]);
        return wfOk && searchOk;
      });
      const filtered = preStatusFiltered.filter(function(t) {
        return activityFilter === 'all' || t.status === activityFilter;
      });
      const totalPages = Math.max(1, Math.ceil(filtered.length / ACTIVITY_PAGE_SIZE));
      activityPage = Math.min(Math.max(1, activityPage), totalPages);
      const pageStartIndex = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
      const paged = filtered.slice(pageStartIndex, pageStartIndex + ACTIVITY_PAGE_SIZE);

      let filterBar = '<div class="filter-bar">'
        + ['all', 'running', 'failed', 'completed'].map(function(s) {
          const cnt = s === 'all'
            ? preStatusFiltered.length
            : preStatusFiltered.filter(function(t) { return t.status === s; }).length;
          return '<button class="filter-pill' + (activityFilter === s ? ' active' : '') + '" data-filter-value="' + esc(s) + '" onclick="setActivityFilter(this.dataset.filterValue)">'
            + (s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)) + ' (' + cnt + ')'
            + '</button>';
        }).join('')
        + '<input class="search-input" type="search" placeholder="Search trace id, workflow, provider" value="' + esc(activitySearch) + '" oninput="setActivitySearch(this.value)">'
        + '<select class="filter-select" onchange="setActivityTimeWindow(this.value)">'
        + '<option value="1h"' + (activityTimeWindow === '1h' ? ' selected' : '') + '>Last 1h</option>'
        + '<option value="6h"' + (activityTimeWindow === '6h' ? ' selected' : '') + '>Last 6h</option>'
        + '<option value="24h"' + (activityTimeWindow === '24h' ? ' selected' : '') + '>Last 24h</option>'
        + '<option value="7d"' + (activityTimeWindow === '7d' ? ' selected' : '') + '>Last 7d</option>'
        + '<option value="all"' + (activityTimeWindow === 'all' ? ' selected' : '') + '>All time</option>'
        + '</select>'
        + '<select class="filter-select" onchange="setActivityWorkflow(this.value)">'
        + '<option value="all"' + (activityWorkflow === 'all' ? ' selected' : '') + '>All workflows</option>'
        + workflows.map(function(w) {
            return '<option value="' + esc(w) + '"' + (activityWorkflow === w ? ' selected' : '') + '>' + esc(traceWorkflowOptionLabel(w)) + '</option>';
          }).join('')
        + '</select></div>';

      let body;
      if (filtered.length === 0) {
        // Distinguish "no runs ever" from "runs exist but are filtered out"
        // so we do not show the "Try ax ship ..." first-run hint to users who
        // actually have data but have narrowed it out with the filter bar.
        const hasAnyRuns = traces.length > 0;
        const isFiltered = activityFilter !== 'all'
          || activityWorkflow !== 'all'
          || activityTimeWindow !== 'all'
          || activitySearch.length > 0;
        let hint;
        if (!hasAnyRuns) {
          hint = workflowEmptyStateHint('single');
        } else if (isFiltered) {
          hint = 'No runs match the current filters. Try widening the time window, clearing the search, or switching the workflow.';
        } else {
          hint = workflowEmptyStateHint('single');
        }
        body = renderEmptyStateHtml(hint);
      } else {
        body = renderStackItems(paged, activityRow) + renderActivityPagination(filtered.length, pageStartIndex, paged.length, totalPages);
      }

      return renderSection('Runs', filterBar + body, { count: filtered.length });
    }

    function renderActivityPagination(totalCount, pageStartIndex, pageCount, totalPages) {
      if (totalCount <= ACTIVITY_PAGE_SIZE) {
        return '';
      }
      const pageEndIndex = pageStartIndex + pageCount;
      const previousPage = Math.max(1, activityPage - 1);
      const nextPage = Math.min(totalPages, activityPage + 1);
      return '<div class="pagination-bar">'
        + '<div class="pagination-summary">Showing ' + esc(pageStartIndex + 1) + '-' + esc(pageEndIndex) + ' of ' + esc(totalCount) + ' runs</div>'
        + '<div class="pagination-controls">'
        + '<button class="pagination-btn" data-page-value="' + esc(previousPage) + '" onclick="setActivityPage(this.dataset.pageValue)"' + (activityPage === 1 ? ' disabled' : '') + '>Previous</button>'
        + '<span class="pagination-label">Page ' + esc(activityPage) + ' of ' + esc(totalPages) + '</span>'
        + '<button class="pagination-btn" data-page-value="' + esc(nextPage) + '" onclick="setActivityPage(this.dataset.pageValue)"' + (activityPage === totalPages ? ' disabled' : '') + '>Next</button>'
        + '</div></div>';
    }

    function resetActivityPage() {
      activityPage = 1;
    }

    function setActivityPage(value) {
      const parsed = Number.parseInt(String(value), 10);
      activityPage = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      render();
    }

    function setActivityFilter(f) { activityFilter = f; resetActivityPage(); render(); }
    function setActivityWorkflow(w) { activityWorkflow = w; resetActivityPage(); render(); }
    function setActivitySearch(value) { activitySearch = value; resetActivityPage(); render(); }
    function setActivityTimeWindow(value) { activityTimeWindow = value; resetActivityPage(); render(); }

    /* ── Sessions / Agents / Workflows Tabs ─────────── */

    let sessionsSearch = '';
    let agentsSearch = '';
    let workflowsSearch = '';
    let providersSearch = '';

    function renderSessions(state) {
      const allSessions = state.sessions || [];
      const tracesBySession = {};
      (state.traces || []).forEach(function(trace) {
        const sessionId = metadataString(trace && trace.metadata, 'sessionId');
        if (!sessionId) return;
        if (!Array.isArray(tracesBySession[sessionId])) {
          tracesBySession[sessionId] = [];
        }
        tracesBySession[sessionId].push(trace);
      });
      const sessions = allSessions.filter(function(session) {
        return matchesQuery(sessionsSearch, [
          session.sessionId,
          session.initiator,
          session.task,
          session.status,
          sessionSummary(session, tracesBySession[session.sessionId] || []),
        ]);
      });
      const filterBar = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search session id, initiator, task" value="' + esc(sessionsSearch) + '" oninput="setSessionsSearch(this.value)"></div>';
      let body;
      if (allSessions.length === 0) {
        body = renderEmptyStateHtml('No sessions found.<br>Sessions are created automatically during workflows, agent runs, discussions, reviews, and session-aware MCP execution.');
      } else if (sessions.length === 0) {
        body = renderEmptyStateHtml('No sessions matched the current search.');
      } else {
        body = renderStackItems(sessions, function(session) {
          return sessionRow(session, tracesBySession[session.sessionId] || []);
        });
      }
      return renderSection('Sessions', filterBar + body, { count: sessions.length });
    }

    function renderAgents(state) {
      const allAgents = state.agents || [];
      const agents = allAgents.filter(function(agent) {
        return matchesQuery(agentsSearch, [
          agent.agentId,
          agent.name,
          metadataString(agent.metadata, 'description'),
          metadataString(agent.metadata, 'team'),
          ...metadataStringArray(agent.metadata, 'ownedWorkflows'),
          ...metadataStringArray(agent.metadata, 'recommendedCommands'),
          ...metadataStringArray(agent.metadata, 'useCases'),
          ...metadataStringArray(agent.metadata, 'notFor'),
          ...(Array.isArray(agent.capabilities) ? agent.capabilities : []),
        ]);
      });
      const filterBar = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search agent name, id, capability" value="' + esc(agentsSearch) + '" oninput="setAgentsSearch(this.value)"></div>';
      let body;
      if (allAgents.length === 0) {
        body = renderEmptyStateHtml('No agents registered.<br>Run <code>ax setup</code> to register agents.');
      } else if (agents.length === 0) {
        body = renderEmptyStateHtml('No agents matched the current search.');
      } else {
        body = renderStackItems(agents, agentRow);
      }
      return renderSection('Agents', filterBar + body, { count: agents.length });
    }

    function renderWorkflows(state) {
      const allWorkflows = state.workflows || [];
      const workflows = allWorkflows.filter(function(workflow) {
        return matchesQuery(workflowsSearch, [
          workflow.workflowId,
          workflow.name,
          workflow.version,
          workflow.description,
          workflow.agentId,
          ...stringArray(workflow.requiredInputs),
          ...stringArray(workflow.artifactNames),
        ]);
      });
      const filterBar = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search workflow id or version" value="' + esc(workflowsSearch) + '" oninput="setWorkflowsSearch(this.value)"></div>';
      let body;
      if (allWorkflows.length === 0) {
        body = renderEmptyStateHtml('No workflow definitions found.<br>Check your <code>--workflow-dir</code> or run <code>ax setup</code>.');
      } else if (workflows.length === 0) {
        body = renderEmptyStateHtml('No workflows matched the current search.');
      } else {
        body = renderStackItems(workflows, workflowRow);
      }
      return renderSection('Workflows', filterBar + body, { count: workflows.length });
    }

    function renderProviders(state) {
      const providers = getProviderEntries(state).filter(function(provider) {
        return matchesQuery(providersSearch, [
          provider.providerId,
          provider.enabled ? 'enabled' : 'disabled',
          provider.configuredButUnavailable ? 'not installed' : '',
          provider.detected ? 'detected' : 'unknown',
        ]);
      });
      const filterBar = '<div class="filter-bar"><input class="search-input" type="search" placeholder="Search provider id or state" value="' + esc(providersSearch) + '" oninput="setProvidersSearch(this.value)"></div>';
      let body;
      if (providers.length === 0) {
        body = renderEmptyStateHtml('No providers matched the current search.');
      } else {
        body = renderStackItems(providers, providerRow);
      }
      return renderSection(
        'Providers',
        filterBar + body + '<div class="section-subcopy" style="margin-top:14px">Snapshot: ' + esc(state.providers.generatedAt ? timeAgo(state.providers.generatedAt) + ' (' + state.providers.source + ')' : state.providers.source) + '</div>',
        { count: providers.length },
      );
    }

    function setSessionsSearch(value) { sessionsSearch = value; render(); }
    function setAgentsSearch(value) { agentsSearch = value; render(); }
    function setWorkflowsSearch(value) { workflowsSearch = value; render(); }
    function setProvidersSearch(value) { providersSearch = value; render(); }
`;
