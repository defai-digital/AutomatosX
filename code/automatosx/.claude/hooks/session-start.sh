#!/usr/bin/env bash
# AutomatosX SessionStart hook
# Receives JSON on stdin: { session_id, cwd }
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
SESSION="$(ax_jq_field '.session_id' '' "$INPUT")"
CWD="$(ax_jq_field '.cwd' '' "$INPUT")"

if command -v jq &>/dev/null; then
  jq -cn --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" --arg event "SessionStart" --arg session "$SESSION" --arg cwd "$CWD"     '{ts:$ts,event:$event,session:$session,cwd:$cwd}' >> "$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
else
  printf '{"ts":"%s","event":"SessionStart"}
' "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$TRACE_DIR/hook-trace.jsonl" 2>/dev/null || true
fi

exit 0
