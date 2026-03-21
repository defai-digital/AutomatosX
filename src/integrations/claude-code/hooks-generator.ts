/**
 * Claude Code Hooks Generator
 *
 * Generates hook scripts in .claude/hooks/ and writes hook configuration
 * into .claude/settings.json via SettingsManager.
 *
 * Supported hook types (Phase 2):
 *   PreToolUse    — validate + trace before any tool runs
 *   PostToolUse   — auto-save memory after writes
 *   SessionStart  — inject AutomatosX context at session open
 *   SessionEnd    — persist session report at close
 *
 * @module integrations/claude-code/hooks-generator
 */

import { mkdir, writeFile, chmod } from 'fs/promises';
import { join } from 'path';
import { logger } from '../../shared/logging/logger.js';
import { SettingsManager } from './settings-manager.js';
import { fileExists, writeJsonFile } from './utils/file-reader.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type HookType = 'command' | 'prompt' | 'http';
export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SessionStart'
  | 'SessionEnd'
  | 'SubagentStart'
  | 'SubagentStop';

export interface HookEntry {
  type: HookType;
  command?: string;
  timeout?: number;
  url?: string;
}

export interface HookMatcher {
  matcher?: string;
  hooks: HookEntry[];
}

export interface HooksConfig {
  [event: string]: HookMatcher[];
}

export interface HooksGeneratorOptions {
  projectDir: string;
  /** Events to enable. Defaults to PreToolUse, PostToolUse, SessionStart, SessionEnd. */
  enabledEvents?: HookEvent[];
  /** Overwrite existing hook scripts (default: false) */
  force?: boolean;
}

export interface HooksGenerateResult {
  hooksDir: string;
  scriptsWritten: string[];
  scriptsSkipped: string[];
  settingsUpdated: boolean;
}

// ─── Default enabled events ───────────────────────────────────────────────────

const DEFAULT_EVENTS: HookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'SessionEnd',
];

// ─── Hook script templates ─────────────────────────────────────────────────────

/**
 * Shared helper used by all hook scripts.
 * Extracts a field from stdin JSON safely:
 * - Uses jq when available (availability check separated from parse errors)
 * - Falls back to "unknown"/"" when jq is absent
 * - Uses `jq -n --arg` to write JSON safely without string interpolation injection
 */
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

/**
 * PreToolUse hook — receives tool name + input on stdin, logs to trace file.
 * Exit 0 = allow; exit 2 = block (we never block here by default).
 */
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

# Write trace record using explicit --arg flags (safe, no word splitting)
if command -v jq &>/dev/null; then
  jq -cn --arg ts "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "PreToolUse" --arg tool "\$TOOL" --arg session "\$SESSION" \
    '{ts:\$ts,event:\$event,tool:\$tool,session:\$session}' >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"PreToolUse"}\n' "\$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "\$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
`;
}

/**
 * PostToolUse hook — logs completed tool execution.
 */
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

/**
 * SessionStart hook — logs new session.
 */
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

/**
 * SessionEnd hook — writes a session completion record.
 */
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

// Map events to script filenames and content generators
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

export class HooksGenerator {
  private projectDir: string;
  private enabledEvents: HookEvent[];
  private force: boolean;

  constructor(options: HooksGeneratorOptions) {
    this.projectDir = options.projectDir;
    this.enabledEvents = options.enabledEvents ?? DEFAULT_EVENTS;
    this.force = options.force ?? false;
  }

  /**
   * Generate hook scripts and write hook config into settings.json.
   */
  async generate(): Promise<HooksGenerateResult> {
    logger.info('[HooksGenerator] Generating hooks...', {
      events: this.enabledEvents,
    });

    const hooksDir = join(this.projectDir, '.claude', 'hooks');
    await mkdir(hooksDir, { recursive: true });

    const scriptsWritten: string[] = [];
    const scriptsSkipped: string[] = [];

    // Deduplicate: multiple events may share a script file
    const seen = new Set<string>();
    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def || seen.has(def.filename)) continue;
      seen.add(def.filename);

      const scriptPath = join(hooksDir, def.filename);
      const exists = await fileExists(scriptPath);

      if (exists && !this.force) {
        scriptsSkipped.push(def.filename);
        logger.debug('[HooksGenerator] Script exists, skipping', { file: def.filename });
        continue;
      }

      await writeFile(scriptPath, def.content(), { encoding: 'utf-8', flag: 'w' });
      // Make executable
      await chmod(scriptPath, 0o755);
      scriptsWritten.push(def.filename);
      logger.debug('[HooksGenerator] Script written', { file: def.filename });
    }

    // Write hook config into settings.json
    const settingsUpdated = await this.writeHookConfig();

    logger.info('[HooksGenerator] Hooks generation complete', {
      written: scriptsWritten.length,
      skipped: scriptsSkipped.length,
      settingsUpdated,
    });

    return { hooksDir, scriptsWritten, scriptsSkipped, settingsUpdated };
  }

  /**
   * Build the hooks config object for settings.json and merge it in.
   * Ensures the .claude/ directory exists before writing.
   */
  private async writeHookConfig(): Promise<boolean> {
    const mgr = new SettingsManager(this.projectDir);

    // Ensure .claude/ directory exists (may not yet if permissions step was skipped)
    const claudeDir = join(this.projectDir, '.claude');
    await mkdir(claudeDir, { recursive: true });

    const settings = await mgr.read();
    const hooksConfig = this.buildHooksConfig();

    // Merge: preserve user hooks, overwrite only automatosx-managed events
    const existing = (settings.hooks as HooksConfig | undefined) ?? {};
    settings.hooks = { ...existing, ...hooksConfig };

    await writeJsonFile(mgr.getSettingsPath(), settings);
    return true;
  }

  /**
   * Build the hooks section for settings.json from enabled events.
   */
  buildHooksConfig(): HooksConfig {
    const config: HooksConfig = {};

    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def) continue;

      const scriptPath = `.claude/hooks/${def.filename}`;
      const matcher: HookMatcher = {
        hooks: [
          {
            type: 'command',
            command: scriptPath,
            timeout: event === 'SessionStart' || event === 'SessionEnd' ? 15 : 30,
          },
        ],
      };

      // PreToolUse and PostToolUse get a catch-all matcher
      if (event === 'PreToolUse' || event === 'PostToolUse' || event === 'PostToolUseFailure') {
        matcher.matcher = '.*';
      }

      config[event] = [matcher];
    }

    return config;
  }

  /**
   * Check whether all expected hook scripts exist.
   */
  async areHooksGenerated(): Promise<boolean> {
    const hooksDir = join(this.projectDir, '.claude', 'hooks');
    const seen = new Set<string>();

    for (const event of this.enabledEvents) {
      const def = HOOK_SCRIPTS[event];
      if (!def || seen.has(def.filename)) continue;
      seen.add(def.filename);

      if (!(await fileExists(join(hooksDir, def.filename)))) {
        return false;
      }
    }

    return true;
  }
}
