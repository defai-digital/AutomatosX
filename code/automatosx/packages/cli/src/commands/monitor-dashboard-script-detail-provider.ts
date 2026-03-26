export const MONITOR_DASHBOARD_SCRIPT_DETAIL_PROVIDER = `
    function renderProviderDetail(state, providerId) {
      const provider = getProviderEntries(state).find(function(entry) { return entry.providerId === providerId; });
      const traces = (state.traces || []).filter(function(trace) {
        return extractTraceProviders(trace).includes(providerId);
      }).sort(function(a, b) {
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      });
      const completedCount = traces.filter(function(trace) { return trace.status === 'completed'; }).length;
      const successPct = traces.length > 0 ? Math.round(completedCount / traces.length * 100) : 0;

      const chipsHtml = (provider && provider.enabled ? '<span class="chip">Enabled: <strong>yes</strong></span>' : '<span class="chip">Enabled: <strong>no</strong></span>')
        + (provider && provider.detected ? '<span class="chip">Detected: <strong>yes</strong></span>' : '<span class="chip">Detected: <strong>no</strong></span>')
        + (provider && provider.isDefault ? '<span class="chip">Default: <strong>yes</strong></span>' : '')
        + (provider && provider.lastUsedAt ? '<span class="chip">Last used: <strong>' + esc(timeAgo(provider.lastUsedAt)) + '</strong></span>' : '');
      let html = renderDetailBackButton()
        + renderDetailHeader(providerId, '', chipsHtml);

      html += '<div class="columns">' + renderSection(
        'Usage Summary',
        kvRow('Recent traces', provider ? provider.count : traces.length)
        + kvRow('Failed traces', provider ? provider.failed : traces.filter(function(trace) { return trace.status === 'failed'; }).length)
        + kvRow('Running traces', provider ? provider.running : traces.filter(function(trace) { return trace.status === 'running'; }).length)
        + kvRow('Success rate', traces.length > 0 ? successPct + '%' : 'n/a'),
      ) + renderSection(
        'Workspace State',
        kvRow('Snapshot source', state.providers.source)
        + kvRow('Snapshot generated', state.providers.generatedAt ? timeAgo(state.providers.generatedAt) : 'unavailable')
        + kvRow('Installed but disabled', provider && provider.installedButDisabled ? 'yes' : 'no'),
      ) + '</div>';

      html += renderSection(
        'Recent Traces',
        renderStackOrEmpty(traces, miniTraceRow, 'No recent traces reference this provider in the current monitor window.'),
        { count: traces.length },
      );

      return html;
    }
`;
