export const MONITOR_DASHBOARD_SCRIPT_DETAIL_TRACE = `
    function renderTraceDetail(trace) {
      const dur = durationLabel(trace.startedAt, trace.completedAt);
      const steps = Array.isArray(trace.stepResults) ? trace.stepResults : [];
      const totalMs = steps.reduce(function(sum, s) { return sum + (s.durationMs || 0); }, 0);
      const summary = traceSummary(trace);

      const chipsHtml = badge(trace.status)
        + '<span class="chip">⏱ <strong>' + esc(dur) + '</strong></span>'
        + '<span class="chip">Surface: <strong>' + esc(trace.surface || 'cli') + '</strong></span>'
        + '<span class="chip">Started: <strong>' + esc(timeAgo(trace.startedAt)) + '</strong></span>'
        + (trace.completedAt ? '<span class="chip">Ended: <strong>' + esc(timeAgo(trace.completedAt)) + '</strong></span>' : '')
        + (trace.metadata && trace.metadata.provider ? '<span class="chip">Provider: <strong>' + esc(String(trace.metadata.provider)) + '</strong></span>' : '')
        + (trace.metadata && trace.metadata.sessionId ? '<span class="chip">Session: <strong class="mono">' + esc(String(trace.metadata.sessionId).slice(0,12)) + '…</strong></span>' : '');

      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
        + renderDetailBackButton('margin:0')
        + '<div class="action-bar" style="margin:0">'
        + '<button class="action-btn" id="copy-btn" data-trace-id="' + esc(trace.traceId) + '" onclick="copyTraceId(this.dataset.traceId)">⎘ Copy ID</button>'
        + '<button class="action-btn" data-trace-id="' + esc(trace.traceId) + '" onclick="exportTrace(this.dataset.traceId)">↓ Export JSON</button>'
        + '</div></div>'
        + renderDetailHeader(traceDisplayName(trace), trace.traceId, chipsHtml);

      if (trace.error && trace.error.message) {
        html += '<div class="error-block">'
          + '<h3>Error</h3>'
          + '<div class="error-message">' + esc(trace.error.message) + '</div>'
          + (trace.error.failedStepId ? '<div class="error-detail">Failed step: ' + esc(trace.error.failedStepId) + '</div>' : '')
          + (trace.error.code ? '<div class="error-detail">Code: ' + esc(trace.error.code) + '</div>' : '')
          + '</div>';
      }

      if (trace.metadata && trace.metadata.guardSummary) {
        const guardSummary = String(trace.metadata.guardSummary);
        const guardFailedGates = Array.isArray(trace.metadata.guardFailedGates)
          ? trace.metadata.guardFailedGates.map(function(entry) { return String(entry); })
          : [];
        const requiredTrustStates = Array.isArray(trace.metadata.guardRequiredTrustStates)
          ? trace.metadata.guardRequiredTrustStates.map(function(entry) { return String(entry); })
          : [];
        html += '<div class="error-block">'
          + '<h3>Guard</h3>'
          + '<div class="error-message">' + esc(guardSummary) + '</div>'
          + (trace.metadata.guardToolName ? '<div class="error-detail">Tool: ' + esc(String(trace.metadata.guardToolName)) + '</div>' : '')
          + (trace.metadata.guardTrustState ? '<div class="error-detail">Trust state: ' + esc(String(trace.metadata.guardTrustState)) + '</div>' : '')
          + (requiredTrustStates.length > 0 ? '<div class="error-detail">Required trust states: ' + esc(requiredTrustStates.join(', ')) + '</div>' : '')
          + (guardFailedGates.length > 0 ? '<div class="error-detail">Failed gates: ' + esc(guardFailedGates.join(', ')) + '</div>' : '')
          + '</div>';
      }

      if (summary) {
        html += renderSection('Summary', renderEscapedDetailBlock(summary));
      }

      if (steps.length > 0) {
        const hasTimestamps = steps.some(function(s) { return s.startedAt; });
        html += '<div class="section"><h2>Steps <span class="section-count">' + steps.length + '</span></h2>';

        if (hasTimestamps) {
          const traceStart = trace.startedAt ? new Date(trace.startedAt).getTime() : Date.now();
          const traceEnd = trace.completedAt ? new Date(trace.completedAt).getTime() : Date.now();
          const totalSpan = Math.max(Number.isFinite(traceEnd - traceStart) ? traceEnd - traceStart : 1, 1);

          const axisLabels = ['0', formatGanttMs(totalSpan * 0.25), formatGanttMs(totalSpan * 0.5), formatGanttMs(totalSpan * 0.75), formatGanttMs(totalSpan)];
          html += '<div class="gantt-axis">' + axisLabels.map(function(l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
          html += '<div class="gantt-wrap">';

          for (const step of steps) {
            const stepStart = step.startedAt ? new Date(step.startedAt).getTime() : traceStart;
            const stepEnd = step.completedAt ? new Date(step.completedAt).getTime() : (stepStart + (step.durationMs || 0));
            const offsetPct = Math.max(0, Math.min(99, ((stepStart - traceStart) / totalSpan) * 100));
            const widthPct = Math.max(0.5, Math.min(100 - offsetPct, ((stepEnd - stepStart) / totalSpan) * 100));
            const barClass = !step.completedAt ? 'running' : step.success ? 'success' : 'fail';
            const sdur = step.durationMs != null
              ? (step.durationMs < 1000 ? step.durationMs + 'ms' : (step.durationMs / 1000).toFixed(1) + 's')
              : '—';

            html += '<div class="gantt-row">'
              + '<div class="gantt-label" title="' + esc(step.stepId) + '">' + esc(step.stepId) + '</div>'
              + '<div class="gantt-track">'
              + '<div class="gantt-bar ' + barClass + '" style="left:' + offsetPct.toFixed(1) + '%;width:' + widthPct.toFixed(1) + '%"></div>'
              + '</div>'
              + '<div class="gantt-dur">' + esc(sdur) + (step.retryCount > 0 ? ' <span class="retry-badge">↻' + esc(step.retryCount) + '</span>' : '') + '</div>'
              + '</div>';

            if (step.error) {
              html += '<div style="margin:0 0 6px 170px;font-size:12px;color:#ff8080;font-family:ui-monospace,monospace;background:rgba(248,81,73,0.06);border-radius:5px;padding:5px 8px">'
                + esc(step.error) + '</div>';
            }
          }
          html += '</div>';
        } else {
          html += '<div class="steps-list">';
          for (const step of steps) {
            const sdur = step.durationMs != null
              ? (step.durationMs < 1000 ? step.durationMs + 'ms' : (step.durationMs / 1000).toFixed(1) + 's')
              : '—';
            const pct = totalMs > 0 && step.durationMs ? Math.min(100, Math.max(2, Math.round(step.durationMs / totalMs * 100))) : 0;
            const barClass = step.success ? 'success' : 'fail';
            html += '<div class="step-card' + (step.success ? '' : ' step-failed') + '">'
              + '<div class="step-top">'
              + '<span class="step-id">' + esc(step.stepId) + '</span>'
              + '<span class="step-right">'
              + (step.retryCount > 0 ? '<span class="retry-badge">↻ ' + step.retryCount + '</span>' : '')
              + '<span class="step-dur">' + esc(sdur) + '</span>'
              + badge(step.success ? 'completed' : 'failed')
              + '</span></div>'
              + (pct > 0 ? '<div class="dur-bar-wrap"><div class="dur-bar ' + barClass + '" style="width:' + pct + '%"></div></div>' : '')
              + (step.error ? '<div class="step-error">' + esc(step.error) + '</div>' : '')
              + '</div>';
          }
          html += '</div>';
        }

        html += '</div>';
      } else {
        html += '<div class="section"><h2>Steps</h2><div class="empty-state">No step data recorded.</div></div>';
      }

      if (trace.input) {
        html += '<div class="section">' + collapsible('trace-input', 'Input', JSON.stringify(trace.input, null, 2)) + '</div>';
      }
      if (trace.output) {
        html += '<div class="section">' + collapsible('trace-output', 'Output', JSON.stringify(trace.output, null, 2)) + '</div>';
      }
      if (trace.metadata && Object.keys(trace.metadata).length > 0) {
        html += '<div class="section">' + collapsible('trace-meta', 'Metadata', JSON.stringify(trace.metadata, null, 2)) + '</div>';
      }

      return html;
    }
`;
