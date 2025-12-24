#!/usr/bin/env bash
#
# Multi-Model Discussion Demo Script
#
# This script demonstrates the discuss feature of AutomatosX.
# It shows various discussion patterns and use cases.
#
# Prerequisites:
#   - AutomatosX built (pnpm build)
#   - At least 2 providers available (run: ax doctor)
#
# Usage:
#   ./examples/scripts/demo-discuss.sh
#

set -e

echo "=================================================="
echo "  Multi-Model Discussion Demo"
echo "=================================================="
echo ""

# Check if providers are available
echo "Checking available providers..."
if ! pnpm ax doctor --format json 2>/dev/null | grep -q '"healthy"'; then
  echo "Warning: Some providers may not be available."
  echo "Run 'pnpm ax doctor' to check provider status."
  echo ""
fi

echo "=================================================="
echo "  Demo 1: Quick Discussion (Synthesis)"
echo "=================================================="
echo ""
echo "Topic: What is the best approach for rate limiting in APIs?"
echo ""
echo "Running: ax discuss quick \"What is the best approach for rate limiting in APIs?\""
echo ""

pnpm ax discuss quick "What is the best approach for rate limiting in APIs?" 2>/dev/null || {
  echo "Note: Quick discussion requires providers to be available."
  echo "This is a demonstration of the command."
}

echo ""
echo "=================================================="
echo "  Demo 2: Voting Pattern"
echo "=================================================="
echo ""
echo "Topic: Which database is best for time-series data?"
echo "Options: PostgreSQL with TimescaleDB, InfluxDB, or Clickhouse"
echo ""
echo "Running: ax discuss \"PostgreSQL vs InfluxDB vs ClickHouse for time-series\" --pattern voting"
echo ""

pnpm ax discuss "Which database should we use for time-series data: PostgreSQL with TimescaleDB, InfluxDB, or ClickHouse?" \
  --pattern voting \
  --rounds 1 \
  2>/dev/null || {
  echo "Note: Voting discussion requires providers to be available."
}

echo ""
echo "=================================================="
echo "  Demo 3: Critique Pattern"
echo "=================================================="
echo ""
echo "Topic: Review an authentication approach"
echo ""
echo "Running: ax discuss \"Review JWT-based auth\" --pattern critique --rounds 3"
echo ""

pnpm ax discuss "Review this authentication approach: JWT tokens stored in httpOnly cookies with refresh token rotation" \
  --pattern critique \
  --rounds 3 \
  2>/dev/null || {
  echo "Note: Critique discussion requires providers to be available."
}

echo ""
echo "=================================================="
echo "  Demo 4: Debate Pattern"
echo "=================================================="
echo ""
echo "Topic: Microservices vs Monolith for startups"
echo ""
echo "Running: ax discuss \"Microservices vs Monolith\" --pattern debate --rounds 2"
echo ""

pnpm ax discuss "Should early-stage startups use microservices or monolith architecture?" \
  --pattern debate \
  --rounds 2 \
  2>/dev/null || {
  echo "Note: Debate discussion requires providers to be available."
}

echo ""
echo "=================================================="
echo "  Demo 5: JSON Output"
echo "=================================================="
echo ""
echo "Getting structured output for programmatic use..."
echo ""
echo "Running: ax discuss quick \"Best testing strategy\" --format json"
echo ""

pnpm ax discuss quick "What is the best testing strategy for a REST API?" \
  --format json \
  2>/dev/null || {
  echo "Note: Discussion requires providers to be available."
}

echo ""
echo "=================================================="
echo "  Demo Complete!"
echo "=================================================="
echo ""
echo "Additional commands to try:"
echo ""
echo "  # Quick discussion with specific providers"
echo "  ax discuss quick \"Your topic\" --providers claude,gemini"
echo ""
echo "  # Full discussion with context"
echo "  ax discuss \"Review this code\" --context \"\$(cat file.ts)\""
echo ""
echo "  # Run a discussion workflow"
echo "  ax run discuss-step-examples --input '{\"question\": \"Best API design?\"}'"
echo ""
echo "  # MCP tool (in Claude Code)"
echo "  ax_discuss_quick({topic: \"Your question\"})"
echo ""
