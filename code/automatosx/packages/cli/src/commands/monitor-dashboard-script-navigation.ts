export const MONITOR_DASHBOARD_SCRIPT_NAVIGATION = `
    /* ── Navigation ─────────────────────────────────── */

    let currentState = initialState;
    let currentTab = 'overview';
    let currentDetail = null;
    let lastRefreshedAt = Date.now();
    let ignoreNextHashChange = false;
    let detailRequestSequence = 0;

    const validTabs = ['overview', 'activity', 'sessions', 'agents', 'workflows', 'providers', 'raw'];

    function normalizeTab(tab) {
      if (tab === 'traces') return 'activity';
      return validTabs.includes(tab) ? tab : 'overview';
    }

    function decodeHashValue(value) {
      try {
        return decodeURIComponent(value);
      } catch {
        return '';
      }
    }

    function beginDetailRequest() {
      detailRequestSequence += 1;
      return detailRequestSequence;
    }

    function updateHash(value) {
      const nextHash = '#' + value;
      if (location.hash === nextHash) return;
      ignoreNextHashChange = true;
      location.hash = value;
      setTimeout(function() {
        ignoreNextHashChange = false;
      }, 0);
    }

    function switchTab(tab, syncHash) {
      beginDetailRequest();
      currentTab = normalizeTab(tab);
      currentDetail = null;
      if (syncHash !== false) {
        updateHash('tab:' + encodeURIComponent(currentTab));
      }
      renderCurrentSelection();
    }

    function renderTab(state, tab) {
      switch (tab) {
        case 'activity': return renderActivity(state);
        case 'sessions': return renderSessions(state);
        case 'agents': return renderAgents(state);
        case 'workflows': return renderWorkflows(state);
        case 'providers': return renderProviders(state);
        case 'raw': return '<div class="section"><h2>Raw State</h2><pre>' + esc(JSON.stringify(state, null, 2)) + '</pre></div>';
        default: return renderOverview(state);
      }
    }

    function renderCurrentSelection() {
      if (currentDetail === null) {
        document.getElementById('tabs').style.display = '';
        render();
        return;
      }

      document.getElementById('tabs').style.display = 'none';
      if (currentDetail.type === 'trace') {
        document.getElementById('app').innerHTML = renderTraceDetail(currentDetail.data);
      } else if (currentDetail.type === 'agent') {
        document.getElementById('app').innerHTML = renderAgentDetail(currentDetail.data);
      } else if (currentDetail.type === 'session') {
        document.getElementById('app').innerHTML = renderSessionDetail(currentDetail.data);
      } else if (currentDetail.type === 'workflow') {
        document.getElementById('app').innerHTML = renderWorkflowDetail(currentDetail.data);
      } else if (currentDetail.type === 'provider') {
        document.getElementById('app').innerHTML = renderProviderDetail(currentState, currentDetail.id);
      }
    }

    async function openTrace(traceId, syncHash) {
      const requestId = beginDetailRequest();
      if (syncHash !== false) {
        updateHash('trace:' + encodeURIComponent(traceId));
      }
      document.getElementById('app').innerHTML = renderLoadingState();
      try {
        const response = await fetch('/api/traces/' + encodeURIComponent(traceId), { headers: { accept: 'application/json' } });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to load trace');
        if (requestId !== detailRequestSequence) return;
        currentDetail = { type: 'trace', id: traceId, data: result.data };
        renderCurrentSelection();
      } catch (error) {
        if (requestId !== detailRequestSequence) return;
        currentDetail = null;
        document.getElementById('tabs').style.display = '';
        document.getElementById('app').innerHTML = renderErrorState(error);
      }
    }

    async function openAgent(agentId, syncHash) {
      const requestId = beginDetailRequest();
      if (syncHash !== false) {
        updateHash('agent:' + encodeURIComponent(agentId));
      }
      document.getElementById('app').innerHTML = renderLoadingState();
      try {
        const response = await fetch('/api/agents/' + encodeURIComponent(agentId), { headers: { accept: 'application/json' } });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to load agent');
        if (requestId !== detailRequestSequence) return;
        currentDetail = { type: 'agent', id: agentId, data: result.data };
        renderCurrentSelection();
      } catch (error) {
        if (requestId !== detailRequestSequence) return;
        currentDetail = null;
        document.getElementById('tabs').style.display = '';
        document.getElementById('app').innerHTML = renderErrorState(error);
      }
    }

    async function openSession(sessionId, syncHash) {
      const requestId = beginDetailRequest();
      if (syncHash !== false) {
        updateHash('session:' + encodeURIComponent(sessionId));
      }
      document.getElementById('app').innerHTML = renderLoadingState();
      try {
        const response = await fetch('/api/sessions/' + encodeURIComponent(sessionId), { headers: { accept: 'application/json' } });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to load session');
        if (requestId !== detailRequestSequence) return;
        currentDetail = { type: 'session', id: sessionId, data: result.data };
        renderCurrentSelection();
      } catch (error) {
        if (requestId !== detailRequestSequence) return;
        currentDetail = null;
        document.getElementById('tabs').style.display = '';
        document.getElementById('app').innerHTML = renderErrorState(error);
      }
    }

    async function openWorkflow(workflowId, syncHash) {
      const requestId = beginDetailRequest();
      if (syncHash !== false) {
        updateHash('workflow:' + encodeURIComponent(workflowId));
      }
      document.getElementById('app').innerHTML = renderLoadingState();
      try {
        const response = await fetch('/api/workflows/' + encodeURIComponent(workflowId), { headers: { accept: 'application/json' } });
        const result = await response.json();
        if (!result.success) throw new Error(result.error || 'Failed to load workflow');
        if (requestId !== detailRequestSequence) return;
        currentDetail = { type: 'workflow', id: workflowId, data: result.data };
        renderCurrentSelection();
      } catch (error) {
        if (requestId !== detailRequestSequence) return;
        currentDetail = null;
        document.getElementById('tabs').style.display = '';
        document.getElementById('app').innerHTML = renderErrorState(error);
      }
    }

    function openProvider(providerId, syncHash) {
      beginDetailRequest();
      currentDetail = { type: 'provider', id: providerId };
      if (syncHash !== false) {
        updateHash('provider:' + encodeURIComponent(providerId));
      }
      renderCurrentSelection();
    }

    function closeDetail(syncHash) {
      beginDetailRequest();
      currentDetail = null;
      if (syncHash !== false) {
        updateHash('tab:' + encodeURIComponent(currentTab));
      }
      renderCurrentSelection();
    }
`;
