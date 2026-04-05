export const MONITOR_DASHBOARD_SCRIPT_DETAIL_TRACE = `
    function renderTraceDetail(trace) {
      const dur = durationLabel(trace.startedAt, trace.completedAt);
      const steps = Array.isArray(trace.stepResults) ? trace.stepResults : [];
      const totalMs = steps.reduce(function(sum, s) { return sum + (s.durationMs || 0); }, 0);
      const summary = traceSummary(trace);
      const providers = extractTraceProviders(trace);

      const chipsHtml = badge(trace.status)
        + '<span class="chip">⏱ <strong>' + esc(dur) + '</strong></span>'
        + '<span class="chip">Surface: <strong>' + esc(trace.surface || 'cli') + '</strong></span>'
        + '<span class="chip">Started: <strong>' + esc(timeAgo(trace.startedAt)) + '</strong></span>'
        + (trace.completedAt ? '<span class="chip">Ended: <strong>' + esc(timeAgo(trace.completedAt)) + '</strong></span>' : '')
        + (providers.length > 0 ? '<span class="chip">' + esc(providers.length === 1 ? 'Provider' : 'Providers') + ': <strong>' + esc(providers.join(', ')) + '</strong></span>' : '')
        + (trace.metadata && trace.metadata.sessionId ? '<span class="chip">Session: <strong class="mono">' + esc(String(trace.metadata.sessionId).slice(0,12)) + '…</strong></span>' : '');

      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">'
        + renderDetailBackButton('margin:0')
        + '<div class="action-bar" style="margin:0">'
        + '<button class="action-btn" id="copy-btn" data-trace-id="' + esc(trace.traceId) + '" onclick="copyTraceId(this.dataset.traceId)">⎘ Copy ID</button>'
        + '<button class="action-btn" data-trace-id="' + esc(trace.traceId) + '" onclick="exportTrace(this.dataset.traceId)">↓ Export JSON</button>'
        + '</div></div>'
        + renderDetailHeader(traceDisplayName(trace), trace.traceId, chipsHtml);

      if (trace.error && trace.error.message) {
        html += renderErrorCallout('Error', trace.error.message, [
          trace.error.failedStepId ? 'Failed step: ' + trace.error.failedStepId : '',
          trace.error.code ? 'Code: ' + trace.error.code : '',
        ]);
      }

      if (trace.metadata && trace.metadata.guardSummary) {
        const guardSummary = String(trace.metadata.guardSummary);
        const guardFailedGates = Array.isArray(trace.metadata.guardFailedGates)
          ? trace.metadata.guardFailedGates.map(function(entry) { return String(entry); })
          : [];
        const requiredTrustStates = Array.isArray(trace.metadata.guardRequiredTrustStates)
          ? trace.metadata.guardRequiredTrustStates.map(function(entry) { return String(entry); })
          : [];
        html += renderErrorCallout('Policy', guardSummary, [
          trace.metadata.guardToolName ? 'Tool: ' + String(trace.metadata.guardToolName) : '',
          trace.metadata.guardTrustState ? 'Trust state: ' + String(trace.metadata.guardTrustState) : '',
          requiredTrustStates.length > 0 ? 'Required trust states: ' + requiredTrustStates.join(', ') : '',
          guardFailedGates.length > 0 ? 'Failed gates: ' + guardFailedGates.join(', ') : '',
        ]);
      }

      html += renderSummarySection(summary);

      if (steps.length > 0) {
        const hasTimestamps = steps.some(function(s) {
          return parseIsoTimestamp(s.startedAt) !== null || parseIsoTimestamp(s.completedAt) !== null;
        });
        html += '<div class="section"><h2>Steps <span class="section-count">' + steps.length + '</span></h2>';

        if (hasTimestamps) {
          const stepTimes = steps.flatMap(function(step) {
            return [parseIsoTimestamp(step.startedAt), parseIsoTimestamp(step.completedAt)].filter(function(value) {
              return value !== null;
            });
          });
          const traceStart = parseIsoTimestamp(trace.startedAt) || stepTimes[0] || Date.now();
          const traceEnd = parseIsoTimestamp(trace.completedAt) || stepTimes[stepTimes.length - 1] || traceStart;
          const totalSpan = Math.max(traceEnd - traceStart, 1);

          const axisLabels = ['0', formatGanttMs(totalSpan * 0.25), formatGanttMs(totalSpan * 0.5), formatGanttMs(totalSpan * 0.75), formatGanttMs(totalSpan)];
          html += '<div class="gantt-axis">' + axisLabels.map(function(l) { return '<span>' + esc(l) + '</span>'; }).join('') + '</div>';
          html += '<div class="gantt-wrap">';

          for (const step of steps) {
            const stepStart = parseIsoTimestamp(step.startedAt) || traceStart;
            const stepEnd = parseIsoTimestamp(step.completedAt) || (stepStart + (step.durationMs || 0));
            const offsetPct = Math.max(0, Math.min(99, ((stepStart - traceStart) / totalSpan) * 100));
            const widthPct = Math.max(0.5, Math.min(100 - offsetPct, ((stepEnd - stepStart) / totalSpan) * 100));
            const hasCompletedAt = parseIsoTimestamp(step.completedAt) !== null;
            const barClass = !hasCompletedAt && step.success !== false ? 'running' : step.success ? 'success' : 'fail';
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
        html += renderJsonCollapsibleSection('trace-input', 'Input', trace.input);
      }
      if (trace.output) {
        html += renderJsonCollapsibleSection('trace-output', 'Output', trace.output);
      }
      html += renderMetadataSection('trace-meta', trace.metadata);

      return html;
    }
`;
