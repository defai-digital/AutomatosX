export const MONITOR_DASHBOARD_SCRIPT_BOOT = `
    /* ── Render & Refresh ───────────────────────────── */

    const REFRESH_INTERVAL_MS = 10000;

    function render() {
      document.querySelectorAll('.tab').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === currentTab);
      });
      document.getElementById('app').innerHTML = renderTab(currentState, currentTab);
      if (currentTab === 'overview') {
        loadHourlyMetrics();
      }
    }

    function updateHeaderClock() {
      const el = document.getElementById('last-updated-rel');
      const dot = document.getElementById('live-dot');
      const label = document.getElementById('live-label-text');
      if (!el || !dot || !label) return;
      const now = Date.now();
      const msUntilRefresh = (lastRefreshedAt + REFRESH_INTERVAL_MS) - now;
      const secondsRemaining = Math.max(0, Math.ceil(msUntilRefresh / 1000));
      el.textContent = secondsRemaining + 's';
      const overdueMs = now - (lastRefreshedAt + REFRESH_INTERVAL_MS);
      const isStale = overdueMs > (REFRESH_INTERVAL_MS * 2);
      dot.classList.toggle('stale', isStale);
      label.textContent = isStale ? 'STALE' : 'LIVE';
      label.style.color = isStale ? 'var(--danger)' : 'var(--muted)';
    }

    async function refreshState(silent) {
      try {
        const response = await fetch('/api/state', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        currentState = await response.json();
        lastRefreshedAt = Date.now();
        if (currentTab === 'overview') {
          hourlyLoadedAt = 0;
        }
        if (currentDetail === null) {
          renderCurrentSelection();
          return;
        }

        if (currentDetail.type === 'provider') {
          renderCurrentSelection();
          return;
        }

        const detailType = currentDetail.type;
        const detailId = currentDetail.id;
        const detailPath = detailType === 'trace'
          ? '/api/traces/' + encodeURIComponent(detailId)
          : detailType === 'agent'
            ? '/api/agents/' + encodeURIComponent(detailId)
            : detailType === 'session'
              ? '/api/sessions/' + encodeURIComponent(detailId)
              : '/api/workflows/' + encodeURIComponent(currentDetail.id);
        const detailResponse = await fetch(detailPath, { headers: { accept: 'application/json' } });
        if (!detailResponse.ok) throw new Error('HTTP ' + detailResponse.status);
        const detailResult = await detailResponse.json();
        if (!detailResult.success) throw new Error(detailResult.error || 'Failed to refresh detail');
        if (currentDetail === null || currentDetail.type !== detailType || currentDetail.id !== detailId) {
          return;
        }
        currentDetail.data = detailResult.data;
        renderCurrentSelection();
      } catch (error) {
        if (silent === false) {
          throw error;
        }
        // leave stale indicator to show naturally via clock
      }
    }

    function navigateFromHash() {
      const raw = location.hash.replace(/^#/, '');
      if (!raw) {
        switchTab('overview', false);
        return;
      }
      const separator = raw.indexOf(':');
      const type = separator === -1 ? 'tab' : raw.slice(0, separator);
      const value = decodeHashValue(separator === -1 ? raw : raw.slice(separator + 1));
      if (!value) {
        switchTab('overview', false);
        return;
      }
      switch (type) {
        case 'trace':
          openTrace(value, false);
          return;
        case 'agent':
          openAgent(value, false);
          return;
        case 'session':
          openSession(value, false);
          return;
        case 'workflow':
          openWorkflow(value, false);
          return;
        case 'provider':
          openProvider(value, false);
          return;
        case 'tab':
        default:
          switchTab(value, false);
      }
    }

    document.getElementById('tabs').addEventListener('click', function(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.dataset.tab) return;
      switchTab(target.dataset.tab);
    });

    window.addEventListener('hashchange', function() {
      if (ignoreNextHashChange) return;
      navigateFromHash();
    });

    document.addEventListener('keydown', function(event) {
      if (event.key === 'Escape' && currentDetail !== null) {
        closeDetail();
        return;
      }
      if ((event.key === 'r' || event.key === 'R') && currentDetail === null && !event.ctrlKey && !event.metaKey && !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLSelectElement)) {
        manualRefresh();
      }
    });

    navigateFromHash();
    updateHeaderClock();
    setInterval(refreshState, REFRESH_INTERVAL_MS);
    setInterval(updateHeaderClock, 1000);
`;
