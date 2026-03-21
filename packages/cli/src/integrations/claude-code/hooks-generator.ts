/**
 * Claude Code Hooks Generator
 *
 * Generates hook scripts in .claude/hooks/ and writes hook configuration
 * into .claude/settings.json via SettingsManager.
 *
 * Supported events: PreToolUse, PostToolUse, SessionStart, SessionEnd
 * Scripts use `set -euo pipefail` and `jq -cn --arg` for safe JSON output.
 */

import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import type { HookEvent, HooksConfig, HookMatcher } from './types.js';
import { SettingsManager } from './settings-manager.js';
import { fileExists, writeJsonFile } from './utils/file-utils.js';

// ─── Default events ───────────────────────────────────────────────────────────

const DEFAULT_EVENTS: HookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
];

// ─── Shared bash helper ───────────────────────────────────────────────────────

function sharedHelpers(): string {
  return `
# Extract a field from JSON safely using jq (if available)
ax_jq_field() {
  local field="\$1" default="\$2" input="\$3"
  if command -v jq &>/dev/null; then
    jq -re --arg d "\$default" "\$field // \\$d" <<< "\$input" 2>/dev/null || echo "\$default"
  else
    echo "\$default"
  fi
}
`;
}

// ─── Hook script templates ────────────────────────────────────────────────────

function preToolUseScript(): string {
  return `#!/usr/bin/env bash
# AutomatosX PreToolUse hook
# Receives JSON on stdin: { tool_name, tool_input, session_id, cwd }
# Exit 0 = allow, Exit 2 = block (this script always allows)
set -euo pipefail
${sharedHelpers()}
TRACE_DIR="\${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"
mkdir -p "\$TRACE_DIR"

INPUT="\$(cat)"
TOOL="\$(ax_jq_field '.tool_name' 'unknown' "\$INPUT")"
SESSION="\$(ax_jq_field '.session_id' '' "\$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "PreToolUse" --arg tool "\$TOOL" --arg session "\$SESSION" \
    '{ts:\$ts,event:\$event,tool:\$tool,session:\$session}' >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"PreToolUse"}\n' "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
`;
}

function postToolUseScript(): string {
  return `#!/usr/bin/env bash
# AutomatosX PostToolUse hook
# Receives JSON on stdin: { tool_name, tool_input, tool_response, session_id, cwd }
# Exit 0 = success
set -euo pipefail
${sharedHelpers()}
TRACE_DIR="\${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"
mkdir -p "\$TRACE_DIR"

INPUT="\$(cat)"
TOOL="\$(ax_jq_field '.tool_name' 'unknown' "\$INPUT")"
SESSION="\$(ax_jq_field '.session_id' '' "\$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "PostToolUse" --arg tool "\$TOOL" --arg session "\$SESSION" \
    '{ts:\$ts,event:\$event,tool:\$tool,session:\$session}' >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"PostToolUse"}\n' "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
`;
}

function sessionStartScript(): string {
  return `#!/usr/bin/env bash
# AutomatosX SessionStart hook
# Receives JSON on stdin: { session_id, cwd }
set -euo pipefail
${sharedHelpers()}
TRACE_DIR="\${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"
mkdir -p "\$TRACE_DIR"

INPUT="\$(cat)"
SESSION="\$(ax_jq_field '.session_id' '' "\$INPUT")"
CWD="\$(ax_jq_field '.cwd' '' "\$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "SessionStart" --arg session "\$SESSION" --arg cwd "\$CWD" \
    '{ts:\$ts,event:\$event,session:\$session,cwd:\$cwd}' >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"SessionStart"}\n' "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
`;
}

function sessionEndScript(): string {
  return `#!/usr/bin/env bash
# AutomatosX SessionEnd hook
# Receives JSON on stdin: { session_id, cwd }
set -euo pipefail
${sharedHelpers()}
TRACE_DIR="\${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"
mkdir -p "\$TRACE_DIR"

INPUT="\$(cat)"
SESSION="\$(ax_jq_field '.session_id' '' "\$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "SessionEnd" --arg session "\$SESSION" \
    '{ts:\$ts,event:\$event,session:\$session}' >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"SessionEnd"}\n' "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
`;
}

const HOOK_SCRIPTS: Record<HookEvent, { filename: string; content: () => string }> = {
  PreToolUse: { filename: 'pre-tool-use.sh', content: preToolUseScript },
  PostToolUse: { filename: 'post-tool-use.sh', content: postToolUseScript },
  PostToolUseFailure: { filename: 'post-tool-use.sh', content: postToolUseScript },
  SessionStart: { filename: 'session-start.sh', content: sessionStartScript },
  SessionEnd: { filename: 'session-end.sh', content: sessionEndScript },
  SubagentStart: { filename: 'session-start.sh', content: sessionStartScript },
  SubagentStop: { filename: 'session-end.sh', content: sessionEndScript },
};

// ─── HooksGenerator ───────────────────────────────────────────────────────────

export interface HooksGeneratorOptions {
  projectDir: string;
  enabledEvents?: HookEvent[];
  force?: boolean;
}

export interface HooksGenerateResult {
  hooksDir: string;
  scriptsWritten: string[];
  scriptsSkipped: string[];
  settingsUpdated: boolean;
}
// Re-export for convenience
export type { HookEvent, HooksConfig, HookMatcher } from './types.js';

export class HooksGenerator {
  private projectDir: string;
  private enabledEvents: HookEvent[];
  private force: boolean;

  constructor(options: HooksGeneratorOptions) {
    this.projectDir = options.projectDir;
    this.enabledEvents = options.enabledEvents ?? DEFAULT_EVENTS;
    this.force = options.force ?? false;
  }

  async generate(): Promise<HooksGenerateResult> {
    const hooksDir = join(this.projectDir, '.claude', 'hooks');
    await mkdir(hooksDir, { recursive: true });

    const scriptsWritten: string[] = [];
    const scriptsSkipped: string[] = [];
    const seen = new Set<string>();

    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def || seen.has(def.filename)) continue;
      seen.add(def.filename);

      const scriptPath = join(hooksDir, def.filename);
      if ((await fileExists(scriptPath)) && !this.force) {
        scriptsSkipped.push(def.filename);
        continue;
      }

      await writeFile(scriptPath, def.content(), { encoding: 'utf-8', flag: 'w' });
      await chmod(scriptPath, 0o755);
      scriptsWritten.push(def.filename);
    }

    const settingsUpdated = await this.writeHookConfig();
    return { hooksDir, scriptsWritten, scriptsSkipped, settingsUpdated };
  }

  buildHooksConfig(): HooksConfig {
    const config: HooksConfig = {};

    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def) continue;

      const scriptPath = `.claude/hooks/${def.filename}`;
      const matcher: HookMatcher = {
        hooks: [{
          type: 'command',
          command: scriptPath,
          timeout: event === 'SessionStart' || event === 'SessionEnd' ? 15 : 30,
        }],
      };

      if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure') {
        matcher.matcher = '.*';
      }

      config[event] = [matcher];
    }

    return config;
  }

  private async writeHookConfig(): Promise<boolean> {
    const mgr = new SettingsManager(this.projectDir);
    const settings = await mgr.read();
    const hooksConfig = this.buildHooksConfig();
    const existing = (settings.hooks as HooksConfig | undefined) ?? {};
    settings.hooks = { ...existing, ...hooksConfig };
    await writeJsonFile(mgr.getSettingsPath(), settings);
    return true;
  }

  async areHooksGenerated(): Promise<boolean> {
    const hooksDir = join(this.projectDir, '.claude', 'hooks');
    const seen = new Set<string>();

    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def || seen.has(def.filename)) continue;
      seen.add(def.filename);
      if (!(await fileExists(join(hooksDir, def.filename)))) return false;
    }
    return true;
  }
}
