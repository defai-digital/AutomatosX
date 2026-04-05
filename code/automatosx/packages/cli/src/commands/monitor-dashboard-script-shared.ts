export const MONITOR_DASHBOARD_SCRIPT_SHARED = `
    /* ── Utilities ─────────────────────────────────── */

    function esc(value) {
      return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
    }

    function prettyJson(value) {
      return JSON.stringify(value, null, 2);
    }

    function parseIsoTimestamp(iso) {
      if (typeof iso !== 'string' || iso.length === 0) return null;
      const ts = new Date(iso).getTime();
      return Number.isFinite(ts) ? ts : null;
    }

    function timeAgo(iso) {
      const ts = parseIsoTimestamp(iso);
      if (ts === null) return '—';
      const ms = Date.now() - ts;
      if (ms < 0) return 'just now';
      if (ms < 60000) return Math.floor(ms / 1000) + 's ago';
      if (ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
      if (ms < 86400000) return Math.floor(ms / 3600000) + 'h ago';
      if (ms < 604800000) return Math.floor(ms / 86400000) + 'd ago';
      const d = new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function durationMs(startedAt, completedAt) {
      if (!completedAt) return null;
      const start = parseIsoTimestamp(startedAt);
      const end = parseIsoTimestamp(completedAt);
      if (start === null || end === null) return null;
      return end - start;
    }

    function durationLabel(startedAt, completedAt) {
      const ms = durationMs(startedAt, completedAt);
      if (ms === null) return completedAt ? '—' : 'running';
      if (ms < 0) return '—';
      if (ms < 1000) return ms + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
      return Math.floor(ms / 60000) + 'm ' + Math.floor((ms % 60000) / 1000) + 's';
    }

    function formatGanttMs(ms) {
      if (ms < 1000) return Math.round(ms) + 'ms';
      if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
      return Math.floor(ms / 60000) + 'm' + Math.floor((ms % 60000) / 1000) + 's';
    }

    function badge(status) {
      const s = String(status ?? 'unknown');
      return '<span class="badge ' + s + '">' + esc(s) + '</span>';
    }

    function kvRow(key, value) {
      return '<div class="kv-row"><span class="kv-key">' + esc(key) + '</span><span class="kv-val mono">' + esc(value) + '</span></div>';
    }

    function renderEmptyStateHtml(content) {
      return '<div class="empty-state">' + content + '</div>';
    }

    function renderLoadingState() {
      return '<div class="section">' + renderEmptyStateHtml('Loading…') + '</div>';
    }

    function renderErrorState(error) {
      const message = error instanceof Error ? error.message : String(error);
      return '<div class="section">' + renderEmptyStateHtml(esc(message)) + '</div>';
    }

    function renderDetailBackButton(style) {
      return '<button class="back-btn"' + (style ? ' style="' + esc(style) + '"' : '') + ' onclick="closeDetail()">← Back</button>';
    }

    function renderDetailHeader(title, subtitle, chipsHtml, subtitleClass) {
      const subtitleClassName = subtitleClass ? ' ' + esc(subtitleClass) : '';
      return '<div class="detail-header">'
        + '<div class="detail-workflow">' + esc(title) + '</div>'
        + (subtitle ? '<div class="detail-traceid' + subtitleClassName + '">' + esc(subtitle) + '</div>' : '')
        + '<div class="detail-chips">' + chipsHtml + '</div>'
        + '</div>';
    }

    function renderSectionTitle(title, count, actionHtml) {
      return '<h2>' + esc(title)
        + (count !== null && count !== undefined ? ' <span class="section-count">' + esc(count) + '</span>' : '')
        + (actionHtml ? ' ' + actionHtml : '')
        + '</h2>';
    }

    function renderSection(title, bodyHtml, options) {
      const opts = options && typeof options === 'object' ? options : {};
      const subcopy = typeof opts.subcopy === 'string' && opts.subcopy.length > 0
        ? '<div class="section-subcopy">' + opts.subcopy + '</div>'
        : '';
      const actionHtml = typeof opts.actionHtml === 'string' ? opts.actionHtml : '';
      const count = Object.prototype.hasOwnProperty.call(opts, 'count') ? opts.count : null;
      return '<div class="section">'
        + renderSectionTitle(title, count, actionHtml)
        + subcopy
        + bodyHtml
        + '</div>';
    }

    function renderStackHtml(content) {
      return '<div class="stack">' + content + '</div>';
    }

    function renderStackItems(items, renderItem) {
      return renderStackHtml((items || []).map(renderItem).join(''));
    }

    function renderStackOrEmpty(items, renderItem, emptyHtml) {
      if (!Array.isArray(items) || items.length === 0) {
        return renderEmptyStateHtml(emptyHtml);
      }
      return renderStackItems(items, renderItem);
    }

    function renderEscapedDetailBlock(value) {
      return '<div class="detail-block">' + esc(value) + '</div>';
    }

    function renderEscapedDetailBlocks(items) {
      return renderStackHtml((items || []).map(function(item) {
        return renderEscapedDetailBlock(item);
      }).join(''));
    }

    function renderSummarySection(summary) {
      return summary ? renderSection('Summary', renderEscapedDetailBlock(summary)) : '';
    }

    function renderErrorCallout(title, message, detailLines) {
      const details = Array.isArray(detailLines)
        ? detailLines.filter(function(line) { return typeof line === 'string' && line.length > 0; })
        : [];
      return '<div class="error-block">'
        + '<h3>' + esc(title) + '</h3>'
        + '<div class="error-message">' + esc(message) + '</div>'
        + details.map(function(line) {
          return '<div class="error-detail">' + esc(line) + '</div>';
        }).join('')
        + '</div>';
    }

    function renderJsonPreSection(title, value) {
      return '<div class="section"><h2>' + esc(title) + '</h2><pre>' + esc(prettyJson(value)) + '</pre></div>';
    }

    function renderJsonCollapsibleSection(id, label, value) {
      return '<div class="section">' + collapsible(id, label, prettyJson(value)) + '</div>';
    }

    function renderMetadataSection(id, metadata) {
      return metadata && Object.keys(metadata).length > 0
        ? renderJsonCollapsibleSection(id, 'Metadata', metadata)
        : '';
    }

    function workflowEmptyStateHint(mode) {
      const primary = workflowPrimaryExamples[0];
      const secondary = workflowPrimaryExamples[1];
      if (!primary) {
        return 'No workflow runs yet.';
      }
      if (mode === 'single' || !secondary) {
        return 'No workflow runs yet. Try <code>' + esc(primary) + '</code> to start.';
      }
      if (mode === 'sentence') {
        return 'No workflow runs yet. Try <code>' + esc(primary) + '</code>.';
      }
      return 'No workflow runs yet.<br>Try <code>' + esc(primary) + '</code> or <code>' + esc(secondary) + '</code>';
    }

    function collapsible(id, label, content) {
      return '<button class="collapsible-toggle" data-collapse-id="' + esc(id) + '" onclick="toggleCollapse(this.dataset.collapseId)">'
        + '<span id="caret-' + esc(id) + '">▶</span> ' + esc(label)
        + '</button><div class="collapsible-body" id="body-' + esc(id) + '">'
        + '<div class="detail-block">' + esc(content) + '</div>'
        + '</div>';
    }

    function normalizeSearch(value) {
      return String(value ?? '').trim().toLowerCase();
    }

    function matchesQuery(query, values) {
      const normalizedQuery = normalizeSearch(query);
      if (!normalizedQuery) return true;
      return values.some(function(value) {
        return normalizeSearch(value).includes(normalizedQuery);
      });
    }

    function stringArray(value) {
      return Array.isArray(value)
        ? value.filter(function(entry) { return typeof entry === 'string' && entry.length > 0; })
        : [];
    }

    function metadataString(metadata, key) {
      const source = metadata && typeof metadata === 'object' ? metadata : {};
      const value = source[key];
      return typeof value === 'string' ? value : '';
    }

    function metadataStringArray(metadata, key) {
      const source = metadata && typeof metadata === 'object' ? metadata : {};
      return stringArray(source[key]);
    }

    function humanizeIdentifier(value) {
      return String(value ?? '')
        .split(/[._-]+/)
        .filter(function(part) { return part.length > 0; })
        .map(function(part) { return part.charAt(0).toUpperCase() + part.slice(1); })
        .join(' ');
    }

    function truncateSummary(value, maxLength) {
      const text = String(value ?? '').replace(/\\s+/g, ' ').trim();
      if (!text) return '';
      if (text.length <= maxLength) return text;
      return text.slice(0, Math.max(0, maxLength - 1)).trimEnd() + '…';
    }

    function summarizeScalar(value) {
      if (typeof value === 'string') return truncateSummary(value, 120);
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      return '';
    }

    function summarizeArray(value, limit) {
      if (!Array.isArray(value) || value.length === 0) return '';
      return truncateSummary(value
        .map(function(entry) {
          if (typeof entry === 'string') return entry;
          if (entry && typeof entry === 'object') {
            return entry.task || entry.taskId || entry.agentId || '';
          }
          return '';
        })
        .filter(function(entry) { return typeof entry === 'string' && entry.length > 0; })
        .slice(0, limit)
        .join(', '), 120);
    }

    function firstNonEmptyValue(values) {
      for (const value of values) {
        if (typeof value === 'string' && value.length > 0) {
          return value;
        }
      }
      return '';
    }

    function summarizeTraceInput(value) {
      if (value === null || value === undefined) return '';
      if (typeof value !== 'object' || Array.isArray(value)) {
        return summarizeScalar(value);
      }
      if (typeof value.namespace === 'string' && typeof value.key === 'string') {
        return truncateSummary(value.namespace + '/' + value.key, 120);
      }
      if (typeof value.task === 'string') return 'Task: ' + truncateSummary(value.task, 110);
      if (typeof value.request === 'string') return 'Request: ' + truncateSummary(value.request, 107);
      if (typeof value.prompt === 'string') return 'Prompt: ' + truncateSummary(value.prompt, 108);
      if (typeof value.topic === 'string') return 'Topic: ' + truncateSummary(value.topic, 109);
      if (typeof value.query === 'string') return 'Query: ' + truncateSummary(value.query, 109);
      if (typeof value.target === 'string') return 'Target: ' + truncateSummary(value.target, 108);
      if (typeof value.url === 'string') return 'URL: ' + truncateSummary(value.url, 111);
      if (typeof value.releaseVersion === 'string') return 'Release: ' + truncateSummary(value.releaseVersion, 107);
      if (typeof value.workflowId === 'string') return 'Workflow: ' + truncateSummary(value.workflowId, 106);
      if (typeof value.agentId === 'string') return 'Agent: ' + truncateSummary(value.agentId, 109);
      if (typeof value.path === 'string') return 'Path: ' + truncateSummary(value.path, 110);
      if (Array.isArray(value.paths) && value.paths.length > 0) return 'Paths: ' + summarizeArray(value.paths, 3);
      if (Array.isArray(value.tasks) && value.tasks.length > 0) return 'Tasks: ' + summarizeArray(value.tasks, 2);
      if (typeof value.input === 'object' && value.input !== null) return summarizeTraceInput(value.input);
      return '';
    }

    function traceSummary(trace) {
      const metadataSummary = metadataString(trace && trace.metadata, 'summary');
      if (metadataSummary) {
        return metadataSummary;
      }
      return summarizeTraceInput(trace && trace.input);
    }

    function latestTrace(traces) {
      if (!Array.isArray(traces) || traces.length === 0) return null;
      return traces.slice().sort(function(left, right) {
        return (parseIsoTimestamp(right.startedAt) || 0) - (parseIsoTimestamp(left.startedAt) || 0);
      })[0] || null;
    }

    function sessionSummary(session, relatedTraces) {
      if (typeof session.summary === 'string' && session.summary.length > 0) {
        return session.summary;
      }
      const metadataSummary = metadataString(session && session.metadata, 'summary');
      if (metadataSummary) {
        return metadataSummary;
      }
      const trace = latestTrace(relatedTraces);
      return trace ? traceSummary(trace) : '';
    }

    function isStableCatalogAgent(agent) {
      return Boolean(
        agent
        && typeof agent.registrationKey === 'string'
        && agent.registrationKey.startsWith('stable-catalog:')
      ) || metadataString(agent && agent.metadata, 'source') === 'stable-catalog';
    }

    function withinTimeWindow(iso, windowId) {
      if (!iso || windowId === 'all') return true;
      const startedAt = new Date(iso).getTime();
      if (!Number.isFinite(startedAt)) return false;
      const now = Date.now();
      const windowMs = windowId === '1h' ? 3600000
        : windowId === '6h' ? 21600000
        : windowId === '24h' ? 86400000
        : windowId === '7d' ? 604800000
        : Number.POSITIVE_INFINITY;
      return now - startedAt <= windowMs;
    }

    function extractTraceProviders(trace) {
      const values = [];
      const metadata = trace && trace.metadata && typeof trace.metadata === 'object' ? trace.metadata : {};
      if (typeof metadata.provider === 'string') values.push(metadata.provider);
      if (Array.isArray(metadata.providers)) {
        metadata.providers.forEach(function(entry) {
          if (typeof entry === 'string') values.push(entry);
        });
      }
      const input = trace && trace.input && typeof trace.input === 'object' ? trace.input : {};
      if (typeof input.provider === 'string') values.push(input.provider);
      if (Array.isArray(input.providers)) {
        input.providers.forEach(function(entry) {
          if (typeof entry === 'string') values.push(entry);
        });
      }
      return Array.from(new Set(values.filter(function(value) { return value.length > 0; })));
    }

    function traceDisplayName(trace) {
      const metadataLabel = metadataString(trace && trace.metadata, 'displayLabel');
      if (metadataLabel) {
        return metadataLabel;
      }
      const workflowId = trace && typeof trace.workflowId === 'string' ? trace.workflowId : '(unknown)';
      const command = metadataString(trace && trace.metadata, 'command');
      if (workflowId.startsWith('mcp.tool.')) {
        return 'MCP: ' + humanizeIdentifier(workflowId.slice('mcp.tool.'.length));
      }
      if (command === 'workflow.run') {
        return 'Workflow: ' + workflowId;
      }
      if (command === 'agent.run') {
        const agentId = metadataString(trace && trace.metadata, 'agentId');
        return 'Agent Run: ' + (agentId || workflowId);
      }
      if (workflowId === 'call') {
        return 'Provider Call';
      }
      if (workflowId === 'parallel.run') {
        return 'Parallel Run';
      }
      if (workflowId === 'agent.run') {
        const agentId = metadataString(trace && trace.metadata, 'agentId');
        return 'Agent Run: ' + (agentId || 'agent');
      }
      return workflowId;
    }

    function traceWorkflowOptionLabel(workflowId) {
      if (typeof workflowId !== 'string') {
        return '';
      }
      if (workflowId.startsWith('mcp.tool.')) {
        return 'MCP: ' + humanizeIdentifier(workflowId.slice('mcp.tool.'.length));
      }
      return workflowId;
    }

    function buildProviderUsage(traces) {
      const usage = {};
      for (const trace of traces || []) {
        const providers = extractTraceProviders(trace);
        for (const provider of providers) {
          const existing = usage[provider] || { providerId: provider, count: 0, failed: 0, running: 0, lastUsedAt: undefined };
          existing.count += 1;
          if (trace.status === 'failed') existing.failed += 1;
          if (trace.status === 'running') existing.running += 1;
          if (!existing.lastUsedAt || new Date(trace.startedAt).getTime() > new Date(existing.lastUsedAt).getTime()) {
            existing.lastUsedAt = trace.startedAt;
          }
          usage[provider] = existing;
        }
      }
      return Object.values(usage).sort(function(left, right) {
        if (right.count !== left.count) return right.count - left.count;
        return String(right.lastUsedAt || '').localeCompare(String(left.lastUsedAt || ''));
      });
    }

    function getProviderEntries(state) {
      const traceUsage = buildProviderUsage(state.traces || []);
      const usageById = Object.fromEntries(traceUsage.map(function(entry) { return [entry.providerId, entry]; }));
      const snapshotIds = new Set([
        ...(state.providers.detectedProviders || []),
        ...(state.providers.enabledProviders || []),
        ...(state.providers.installedButDisabledProviders || []),
        ...(state.providers.configuredButUnavailableProviders || []),
      ]);
      Object.keys(usageById).forEach(function(providerId) { snapshotIds.add(providerId); });
      if (state.status && state.status.runtime && state.status.runtime.defaultProvider) {
        snapshotIds.add(state.status.runtime.defaultProvider);
      }

      return Array.from(snapshotIds).map(function(providerId) {
        const usage = usageById[providerId] || { count: 0, failed: 0, running: 0, lastUsedAt: undefined };
        return {
          providerId: providerId,
          enabled: (state.providers.enabledProviders || []).includes(providerId),
          detected: (state.providers.detectedProviders || []).includes(providerId),
          installedButDisabled: (state.providers.installedButDisabledProviders || []).includes(providerId),
          configuredButUnavailable: (state.providers.configuredButUnavailableProviders || []).includes(providerId),
          count: usage.count,
          failed: usage.failed,
          running: usage.running,
          lastUsedAt: usage.lastUsedAt,
          isDefault: state.status && state.status.runtime && state.status.runtime.defaultProvider === providerId,
        };
      }).sort(function(left, right) {
        if (Number(right.enabled) !== Number(left.enabled)) return Number(right.enabled) - Number(left.enabled);
        if (right.count !== left.count) return right.count - left.count;
        return left.providerId.localeCompare(right.providerId);
      });
    }

    function toggleCollapse(id) {
      const body = document.getElementById('body-' + id);
      const caret = document.getElementById('caret-' + id);
      if (!body || !caret) return;
      const open = body.classList.toggle('open');
      caret.textContent = open ? '▼' : '▶';
    }

    /* ── Row Renderers ──────────────────────────────── */

    function activityRow(trace) {
      const dur = durationLabel(trace.startedAt, trace.completedAt);
      const ago = timeAgo(trace.startedAt);
      const shortId = String(trace.traceId || '').slice(0, 12);
      const providers = extractTraceProviders(trace);
      const summary = traceSummary(trace);
      const guardSummary = metadataString(trace && trace.metadata, 'guardSummary');
      const accentClass = trace.status === 'running' ? ' row-running' : trace.status === 'failed' ? ' row-failed' : '';
      return '<div class="row clickable' + accentClass + '" data-trace-id="' + esc(trace.traceId) + '" onclick="openTrace(this.dataset.traceId)">'
        + '<div class="row-main">'
        + '<div class="row-title workflow-name">' + esc(traceDisplayName(trace)) + '</div>'
        + (summary ? '<div class="row-sub"><span>' + esc(summary) + '</span></div>' : '')
        + (guardSummary ? '<div class="row-sub"><span>Policy: ' + esc(truncateSummary(guardSummary, 108)) + '</span></div>' : '')
        + '<div class="row-sub"><span class="trace-id-short">' + esc(shortId) + '…</span>'
        + '<span>' + esc(trace.surface || 'cli') + '</span>'
        + (providers.length > 0 ? '<span>' + esc(providers.join(', ')) + '</span>' : '')
        + '</div></div>'
        + '<div class="row-meta">'
        + '<span class="duration-label">' + esc(dur) + '</span>'
        + '<span class="time-ago">' + esc(ago) + '</span>'
        + badge(trace.status)
        + '</div></div>';
    }

    function sessionRow(session, relatedTraces) {
      const ago = timeAgo(session.updatedAt || session.createdAt);
      const summary = sessionSummary(session, relatedTraces);
      const shortId = String(session.sessionId || '').slice(0, 12);
      return '<div class="row clickable" data-session-id="' + esc(session.sessionId) + '" onclick="openSession(this.dataset.sessionId)">'
        + '<div class="row-main">'
        + '<div class="row-title">' + esc(session.task || session.sessionId) + '</div>'
        + '<div class="row-sub"><span>' + esc(session.initiator) + '</span><span class="trace-id-short mono">' + esc(shortId) + '…</span></div>'
        + (summary ? '<div class="row-sub"><span>' + esc(summary) + '</span></div>' : '')
        + '</div><div class="row-meta"><span class="time-ago">' + esc(ago) + '</span>' + badge(session.status) + '</div></div>';
    }

    function agentRow(agent) {
      const caps = Array.isArray(agent.capabilities) && agent.capabilities.length > 0
        ? agent.capabilities.join(', ') : 'no capabilities';
      const description = metadataString(agent.metadata, 'description');
      const owned = metadataStringArray(agent.metadata, 'ownedWorkflows');
      const ago = isStableCatalogAgent(agent) ? 'built-in' : timeAgo(agent.registeredAt);
      return '<div class="row clickable" data-agent-id="' + esc(agent.agentId) + '" onclick="openAgent(this.dataset.agentId)">'
        + '<div class="row-main">'
        + '<div class="row-title">' + esc(agent.name) + '</div>'
        + '<div class="row-sub"><span class="mono">' + esc(agent.agentId) + '</span><span>' + esc(caps) + '</span>'
        + (owned.length > 0 ? '<span>Owns ' + esc(owned.join(', ')) + '</span>' : '')
        + (isStableCatalogAgent(agent) ? '<span>Built-in stable surface</span>' : '')
        + '</div>'
        + (description ? '<div class="row-sub"><span>' + esc(description) + '</span></div>' : '')
        + '</div><div class="row-meta"><span class="time-ago">' + esc(ago) + '</span></div></div>';
    }

    function workflowRow(workflow) {
      const description = typeof workflow.description === 'string' ? workflow.description : '';
      const owner = typeof workflow.agentId === 'string' ? workflow.agentId : '';
      return '<div class="row clickable" data-workflow-id="' + esc(workflow.workflowId) + '" onclick="openWorkflow(this.dataset.workflowId)">'
        + '<div class="row-main">'
        + '<div class="row-title">' + esc(workflow.name || workflow.workflowId) + '</div>'
        + '<div class="row-sub"><span class="mono">' + esc(workflow.workflowId) + '</span><span>v' + esc(workflow.version) + '</span><span>' + esc(workflow.steps) + ' steps</span>'
        + (owner ? '<span>Owner ' + esc(owner) + '</span>' : '')
        + '</div>'
        + (description ? '<div class="row-sub"><span>' + esc(description) + '</span></div>' : '')
        + '</div></div>';
    }

    function providerRow(provider) {
      const stateBadge = provider.enabled
        ? '<span class="badge healthy">enabled</span>'
        : provider.configuredButUnavailable
          ? '<span class="badge warning">not installed</span>'
        : provider.installedButDisabled
          ? '<span class="badge warning">disabled</span>'
          : provider.detected
            ? '<span class="badge completed">detected</span>'
            : '<span class="badge failed">unknown</span>';
      const usageText = provider.count > 0
        ? provider.count + ' traces'
        : provider.isDefault
          ? 'default provider'
          : 'no recent usage';
      return '<div class="row clickable" data-provider-id="' + esc(provider.providerId) + '" onclick="openProvider(this.dataset.providerId)">'
        + '<div class="row-main">'
        + '<div class="row-title">' + esc(provider.providerId) + (provider.isDefault ? ' <span class="trace-id-short">(default)</span>' : '') + '</div>'
        + '<div class="row-sub"><span>' + esc(usageText) + '</span>'
        + (provider.lastUsedAt ? '<span>' + esc(timeAgo(provider.lastUsedAt)) + '</span>' : '')
        + '</div></div><div class="row-meta">'
        + (provider.running > 0 ? '<span class="badge running">' + esc(provider.running) + ' running</span>' : '')
        + (provider.failed > 0 ? '<span class="badge failed">' + esc(provider.failed) + ' failed</span>' : '')
        + stateBadge
        + '</div></div>';
    }

    function miniTraceRow(trace) {
      const dur = durationLabel(trace.startedAt, trace.completedAt);
      const ago = timeAgo(trace.startedAt);
      const providers = extractTraceProviders(trace);
      const summary = traceSummary(trace);
      const guardSummary = metadataString(trace && trace.metadata, 'guardSummary');
      const accentClass = trace.status === 'running' ? ' row-running' : trace.status === 'failed' ? ' row-failed' : '';
      return '<div class="row clickable' + accentClass + '" data-trace-id="' + esc(trace.traceId) + '" onclick="openTrace(this.dataset.traceId)">'
        + '<div class="row-main">'
        + '<div class="row-title workflow-name">' + esc(traceDisplayName(trace)) + '</div>'
        + (summary ? '<div class="row-sub"><span>' + esc(summary) + '</span></div>' : '')
        + (guardSummary ? '<div class="row-sub"><span>Policy: ' + esc(truncateSummary(guardSummary, 108)) + '</span></div>' : '')
        + '<div class="row-sub"><span class="trace-id-short mono">' + esc(String(trace.traceId || '').slice(0,12)) + '…</span>'
        + (providers.length > 0 ? '<span>' + esc(providers.join(', ')) + '</span>' : '')
        + '</div>'
        + '</div><div class="row-meta">'
        + '<span class="duration-label">' + esc(dur) + '</span>'
        + '<span class="time-ago">' + esc(ago) + '</span>'
        + badge(trace.status) + '</div></div>';
    }
`;
