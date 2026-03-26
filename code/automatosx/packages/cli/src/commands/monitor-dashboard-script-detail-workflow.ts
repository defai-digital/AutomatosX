export const MONITOR_DASHBOARD_SCRIPT_DETAIL_WORKFLOW = `
    function renderWorkflowDetail(data) {
      const workflow = data.workflow;
      const traces = Array.isArray(data.traces) ? data.traces : [];
      const completedCount = traces.filter(function(t) { return t.status === 'completed'; }).length;
      const successPct = traces.length > 0 ? Math.round(completedCount / traces.length * 100) : 0;
      const requiredInputs = stringArray(workflow.requiredInputs);
      const optionalInputs = stringArray(workflow.optionalInputs);
      const artifactNames = stringArray(workflow.artifactNames);
      const whenToUse = stringArray(workflow.whenToUse);
      const avoidWhen = stringArray(workflow.avoidWhen);
      const stages = stringArray(workflow.stages);

      const chipsHtml = '<span class="chip">v<strong>' + esc(workflow.version || '1.0.0') + '</strong></span>'
        + '<span class="chip"><strong>' + esc(String(workflow.steps ?? 0)) + '</strong> steps</span>'
        + (workflow.agentId ? '<span class="chip">Owner: <strong>' + esc(workflow.agentId) + '</strong></span>' : '');
      let html = renderDetailBackButton()
        + renderDetailHeader(workflow.name || workflow.workflowId, workflow.workflowId, chipsHtml, 'mono');

      if (workflow.description) {
        html += renderSection('Summary', renderEscapedDetailBlock(workflow.description));
      }

      if (requiredInputs.length > 0 || optionalInputs.length > 0 || artifactNames.length > 0) {
        html += '<div class="columns">' + renderSection(
          'Inputs',
          kvRow('Required', requiredInputs.length > 0 ? requiredInputs.join(', ') : 'none')
          + kvRow('Optional', optionalInputs.length > 0 ? optionalInputs.join(', ') : 'none'),
        ) + renderSection(
            'Artifacts',
            artifactNames.length === 0 ? renderEmptyStateHtml('No artifacts defined.') : renderEscapedDetailBlocks(artifactNames),
          ) + '</div>';
      }

      if (whenToUse.length > 0 || avoidWhen.length > 0) {
        html += '<div class="columns">';
        if (whenToUse.length > 0) {
          html += renderSection('Use This When', renderEscapedDetailBlocks(whenToUse), { count: whenToUse.length });
        }
        if (avoidWhen.length > 0) {
          html += renderSection('Avoid When', renderEscapedDetailBlocks(avoidWhen), { count: avoidWhen.length });
        }
        html += '</div>';
      }

      if (stages.length > 0) {
        html += renderSection(
          'Planned Stages',
          renderEscapedDetailBlocks(stages.map(function(stage, index) {
            return String(index + 1) + '. ' + stage;
          })),
          { count: stages.length },
        );
      }

      if (traces.length > 0) {
        html += renderSection(
          'Execution Health',
          '<div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">'
          + '<span>' + completedCount + ' / ' + traces.length + ' succeeded</span>'
          + '<span style="color:' + (successPct >= 80 ? 'var(--success)' : successPct >= 50 ? 'var(--warn)' : 'var(--danger)') + '">' + successPct + '%</span>'
          + '</div>'
          + '<div class="success-bar-wrap"><div class="success-bar" style="width:' + successPct + '%"></div></div>',
        );
      }

      if (Array.isArray(workflow.stepDefinitions) && workflow.stepDefinitions.length > 0) {
        html += '<div class="section">' + renderSectionTitle('Step Definitions', workflow.stepDefinitions.length) + '<div class="steps-list">';
        for (const step of workflow.stepDefinitions) {
          html += '<div class="step-card">'
            + '<div class="step-top">'
            + '<span class="step-id">' + esc(step.stepId || step.id || '') + '</span>'
            + '<span class="chip">' + esc(step.type || 'unknown') + '</span>'
            + '</div></div>';
        }
        html += '</div></div>';
      }

      html += renderSection(
        'Recent Executions',
        renderStackOrEmpty(traces, miniTraceRow, 'No runs recorded for this workflow yet.'),
        { count: traces.length },
      );

      return html;
    }
`;
