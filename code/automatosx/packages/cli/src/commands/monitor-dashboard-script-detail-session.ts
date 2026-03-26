export const MONITOR_DASHBOARD_SCRIPT_DETAIL_SESSION = `
    function renderSessionDetail(data) {
      const session = data.session || data;
      const relatedTraces = Array.isArray(data.traces) ? data.traces : [];
      const participants = Array.isArray(session.participants) ? session.participants : [];
      const summary = sessionSummary(session, relatedTraces);
      const chipsHtml = badge(session.status)
        + '<span class="chip">Initiator: <strong>' + esc(session.initiator) + '</strong></span>'
        + '<span class="chip">Created: <strong>' + esc(timeAgo(session.createdAt)) + '</strong></span>'
        + (session.updatedAt ? '<span class="chip">Updated: <strong>' + esc(timeAgo(session.updatedAt)) + '</strong></span>' : '');
      let html = renderDetailBackButton()
        + renderDetailHeader(session.task || '(no task)', session.sessionId, chipsHtml);

      if (summary) {
        html += renderSection('Summary', renderEscapedDetailBlock(summary));
      }

      if (session.error && session.error.message) {
        html += '<div class="error-block"><h3>Error</h3><div class="error-message">' + esc(session.error.message) + '</div></div>';
      }

      const participantsBody = participants.length === 0
        ? renderEmptyStateHtml('No participants recorded.')
        : participants.map(function(p) {
            const role = String(p.role || 'collaborator');
            return '<div class="participant-row">'
              + '<span class="mono" style="font-size:13px">' + esc(p.agentId) + '</span>'
              + '<span style="display:flex;gap:8px;align-items:center">'
              + '<span class="role-chip ' + esc(role) + '">' + esc(role) + '</span>'
              + '<span style="font-size:12px;color:var(--muted)">' + esc(timeAgo(p.joinedAt)) + '</span>'
              + '</span></div>';
          }).join('');
      html += renderSection('Participants', participantsBody, { count: participants.length });

      html += renderSection(
        'Traces',
        renderStackOrEmpty(relatedTraces, miniTraceRow, 'No traces recorded for this session.'),
        { count: relatedTraces.length },
      );

      if (session.metadata && Object.keys(session.metadata).length > 0) {
        html += '<div class="section">' + collapsible('session-meta', 'Metadata', JSON.stringify(session.metadata, null, 2)) + '</div>';
      }
      return html;
    }
`;
