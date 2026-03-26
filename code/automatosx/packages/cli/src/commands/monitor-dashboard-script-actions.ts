export const MONITOR_DASHBOARD_SCRIPT_ACTIONS = `
    /* ── Utilities: Toast, Copy, Export, Refresh ───── */

    let toastTimer = null;
    function showToast(msg) {
      const el = document.getElementById('toast');
      if (!el) return;
      el.textContent = msg;
      el.classList.add('show');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { el.classList.remove('show'); }, 2200);
    }

    function markTraceCopied() {
      showToast('Trace ID copied to clipboard');
      const btn = document.getElementById('copy-btn');
      if (btn) {
        btn.classList.add('copied');
        btn.textContent = '✓ Copied';
        setTimeout(function() {
          btn.classList.remove('copied');
          btn.textContent = '⎘ Copy ID';
        }, 1500);
      }
    }

    function fallbackCopyText(value) {
      if (!document.body || typeof document.createElement !== 'function' || typeof document.execCommand !== 'function') {
        return false;
      }
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', 'readonly');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      input.style.pointerEvents = 'none';
      document.body.appendChild(input);
      if (typeof input.focus === 'function') input.focus();
      if (typeof input.select === 'function') input.select();
      try {
        return document.execCommand('copy');
      } catch {
        return false;
      } finally {
        if (typeof input.remove === 'function') {
          input.remove();
        } else if (typeof document.body.removeChild === 'function') {
          try {
            document.body.removeChild(input);
          } catch {
          }
        }
      }
    }

    function copyTraceId(traceId) {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(traceId).then(function() {
          markTraceCopied();
        }).catch(function() {
          if (fallbackCopyText(traceId)) {
            markTraceCopied();
            return;
          }
          showToast('Copy failed — check browser permissions');
        });
        return;
      }
      if (fallbackCopyText(traceId)) {
        markTraceCopied();
        return;
      }
      showToast('Copy failed — check browser permissions');
    }

    function exportTrace(traceId) {
      fetch('/api/traces/' + encodeURIComponent(traceId), { headers: { accept: 'application/json' } })
        .then(function(r) { return r.json(); })
        .then(function(result) {
          if (!result.success) throw new Error(result.error || 'Failed');
          const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'trace-' + traceId.slice(0, 12) + '.json';
          a.click();
          URL.revokeObjectURL(url);
          showToast('Trace exported as JSON');
        })
        .catch(function(err) { showToast('Export failed: ' + String(err)); });
    }

    let refreshing = false;
    async function manualRefresh() {
      if (refreshing) return;
      refreshing = true;
      const btn = document.getElementById('refresh-btn');
      if (btn) btn.classList.add('spinning');
      try {
        await refreshState(false);
        showToast('Dashboard refreshed');
      } catch (err) {
        showToast('Refresh failed: ' + String(err));
      } finally {
        refreshing = false;
        if (btn) btn.classList.remove('spinning');
      }
    }
`;
