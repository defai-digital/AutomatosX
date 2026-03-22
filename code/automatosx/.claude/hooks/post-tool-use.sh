#!/usr/bin/env bash
# AutomatosX PostToolUse hook
# Receives JSON on stdin: { tool_name, tool_input, tool_response, session_id, cwd }
# Exit 0 = success
set -euo pipefail

# Extract a field from JSON safely using jq (if available)
ax_jq_field() {
  local field="$1" default="$2" input="$3"
  if command -v jq &>/dev/null; then
    jq -re --arg d "$default" "$field // \$d" <<< "$input" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

TRACE_DIR="${AUTOMATOSX_TRACE_DIR:-.automatosx/logs}"
mkdir -p "$TRACE_DIR"

INPUT="$(cat)"
TOOL="$(ax_jq_field '.tool_name' 'unknown' "$INPUT")"
SESSION="$(ax_jq_field '.session_id' '' "$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "PostToolUse" --arg tool "$TOOL" --arg session "$SESSION"     '{ts:$ts,event:$event,tool:$tool,session:$session}' >> "$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"PostToolUse"}
' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
