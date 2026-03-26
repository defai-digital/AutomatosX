export const MONITOR_DASHBOARD_SCRIPT_DETAIL_AGENT = `
    function renderAgentDetail(agent) {
      const caps = Array.isArray(agent.capabilities) && agent.capabilities.length > 0
        ? agent.capabilities : [];
      const description = metadataString(agent.metadata, 'description');
      const team = metadataString(agent.metadata, 'team');
      const owned = metadataStringArray(agent.metadata, 'ownedWorkflows');
      const recommended = metadataStringArray(agent.metadata, 'recommendedCommands');
      const useCases = metadataStringArray(agent.metadata, 'useCases');
      const notFor = metadataStringArray(agent.metadata, 'notFor');
      const stableCatalog = isStableCatalogAgent(agent);
      const chipsHtml = (stableCatalog
          ? '<span class="chip">Availability: <strong>Built-in stable surface</strong></span>'
          : '<span class="chip">Registered: <strong>' + esc(timeAgo(agent.registeredAt)) + '</strong></span>')
        + (!stableCatalog && agent.updatedAt ? '<span class="chip">Updated: <strong>' + esc(timeAgo(agent.updatedAt)) + '</strong></span>' : '')
        + (team ? '<span class="chip">Team: <strong>' + esc(team) + '</strong></span>' : '');
      let html = renderDetailBackButton()
        + renderDetailHeader(agent.name || agent.agentId, agent.agentId, chipsHtml);

      if (description) {
        html += renderSection('Role', renderEscapedDetailBlock(description));
      }

      if (stableCatalog) {
        html += renderSection(
          'Runtime Status',
          renderEscapedDetailBlock('This agent is part of the built-in stable surface. Run ax setup to seed runtime registration for direct agent execution and MCP agent tools.'),
        );
      }

      const capabilitiesBody = caps.length === 0
        ? renderEmptyStateHtml('No capabilities registered.')
        : '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
          + caps.map(function(c) { return '<span class="chip"><strong>' + esc(c) + '</strong></span>'; }).join('')
          + '</div>';
      html += renderSection('Capabilities', capabilitiesBody, { count: caps.length });

      if (owned.length > 0) {
        html += renderSection(
          'Owned Workflows',
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">'
          + owned.map(function(workflowId) {
            return '<button class="action-btn" data-workflow-id="' + esc(workflowId) + '" onclick="openWorkflow(this.dataset.workflowId)">' + esc(workflowId) + '</button>';
          }).join('')
          + '</div>',
          { count: owned.length },
        );
      }

      if (recommended.length > 0) {
        html += renderSection(
          'Recommended Commands',
          '<div class="detail-block">' + recommended.map(function(command) { return esc(command); }).join('<br>') + '</div>',
          { count: recommended.length },
        );
      }

      if (useCases.length > 0) {
        html += renderSection('Use This When', renderEscapedDetailBlocks(useCases), { count: useCases.length });
      }

      if (notFor.length > 0) {
        html += renderSection('Avoid This For', renderEscapedDetailBlocks(notFor), { count: notFor.length });
      }

      if (agent.metadata && Object.keys(agent.metadata).length > 0) {
        html += '<div class="section">' + collapsible('agent-meta', 'Metadata', JSON.stringify(agent.metadata, null, 2)) + '</div>';
      }
      return html;
    }
`;
