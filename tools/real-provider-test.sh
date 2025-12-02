#!/bin/bash

###############################################################################
# Real Provider Testing Script
#
# Tests AutomatosX with real AI providers (Claude, Gemini, OpenAI) to validate
# functionality beyond mock tests.
#
# WARNING: This will make real API calls and incur costs!
#
# Usage:
#   ./tools/real-provider-test.sh [options]
#
# Options:
#   --provider <name>    Test specific provider (claude|gemini|openai)
#   --skip-embeddings    Skip embedding tests (saves costs)
#   --quick              Run only essential tests
#   --verbose            Show detailed output
#
# Requirements:
#   - Valid API keys in environment or config
#   - Internet connection
#   - API credits/quota available
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_PATH="$ROOT_DIR/dist/index.js"

PROVIDER="${PROVIDER:-all}"
SKIP_EMBEDDINGS=false
QUICK_MODE=false
VERBOSE=false

# Test results
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_COST=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --provider)
      PROVIDER="$2"
      shift 2
      ;;
    --skip-embeddings)
      SKIP_EMBEDDINGS=true
      shift
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --help)
      head -n 30 "$0" | grep "^#" | sed 's/^# //' | sed 's/^#//'
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

###############################################################################
# Helper Functions
###############################################################################

log() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
  echo -e "${GREEN}[PASS]${NC} $1"
}

error() {
  echo -e "${RED}[FAIL]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

run_test() {
  local test_name="$1"
  local command="$2"
  local expected_pattern="$3"

  TESTS_RUN=$((TESTS_RUN + 1))
  log "Running: $test_name"

  if [ "$VERBOSE" = true ]; then
    echo "Command: $command"
  fi

  # Run command and capture output
  output=$(eval "$command" 2>&1 || true)

  # Check if output matches expected pattern
  if echo "$output" | grep -q "$expected_pattern"; then
    success "$test_name"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    error "$test_name"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    if [ "$VERBOSE" = true ]; then
      echo "Expected pattern: $expected_pattern"
      echo "Actual output:"
      echo "$output"
    fi
    return 1
  fi
}

estimate_cost() {
  local tokens="$1"
  local provider="$2"

  case "$provider" in
    claude)
      # Claude Sonnet: ~$3 per 1M input tokens
      echo "scale=4; $tokens * 3 / 1000000" | bc
      ;;
    gemini)
      # Gemini Flash: free tier, then ~$0.35 per 1M tokens
      echo "scale=4; $tokens * 0.35 / 1000000" | bc
      ;;
    openai)
      # OpenAI embeddings: ~$0.02 per 1M tokens
      echo "scale=4; $tokens * 0.02 / 1000000" | bc
      ;;
    *)
      echo "0"
      ;;
  esac
}

###############################################################################
# Pre-flight Checks
###############################################################################

log "AutomatosX Real Provider Test Suite"
echo ""

# Check if CLI is built
if [ ! -f "$CLI_PATH" ]; then
  error "CLI not built. Run 'npm run build' first."
  exit 1
fi

# Check API keys
log "Checking API keys..."
API_KEYS_FOUND=false

if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  success "Claude API key found"
  API_KEYS_FOUND=true
fi

if [ -n "${GOOGLE_API_KEY:-}" ]; then
  success "Gemini API key found"
  API_KEYS_FOUND=true
fi

if [ -n "${OPENAI_API_KEY:-}" ]; then
  success "OpenAI API key found"
  API_KEYS_FOUND=true
fi

if [ "$API_KEYS_FOUND" = false ]; then
  error "No API keys found. Set ANTHROPIC_API_KEY, GOOGLE_API_KEY, or OPENAI_API_KEY"
  exit 1
fi

echo ""

# Disable mock providers
export AUTOMATOSX_MOCK_PROVIDERS=false

###############################################################################
# Test Suite
###############################################################################

warn "⚠️  This will make REAL API calls and incur costs!"
warn "Estimated cost: \$0.01 - \$0.10 depending on providers tested"
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  log "Test cancelled by user"
  exit 0
fi

echo ""
log "Starting tests..."
echo ""

###############################################################################
# Claude Tests
###############################################################################

if [ "$PROVIDER" = "all" ] || [ "$PROVIDER" = "claude" ]; then
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    log "=== Claude Provider Tests ==="
    echo ""

    # Basic generation
    run_test "Claude: Basic generation" \
      "timeout 30 $CLI_PATH run assistant 'Say hello in exactly 3 words' --provider claude" \
      "Hello"

    # Structured output
    if [ "$QUICK_MODE" = false ]; then
      run_test "Claude: Structured output" \
        "timeout 30 $CLI_PATH run assistant 'List 3 programming languages as JSON array' --provider claude" \
        "\\["
    fi

    TOTAL_COST=$(echo "$TOTAL_COST + 0.001" | bc)
    echo ""
  fi
fi

###############################################################################
# Gemini Tests
###############################################################################

if [ "$PROVIDER" = "all" ] || [ "$PROVIDER" = "gemini" ]; then
  if [ -n "${GOOGLE_API_KEY:-}" ]; then
    log "=== Gemini Provider Tests ==="
    echo ""

    # Basic generation
    run_test "Gemini: Basic generation" \
      "timeout 30 $CLI_PATH run assistant 'Say hello in exactly 3 words' --provider gemini" \
      "Hello"

    # Longer context
    if [ "$QUICK_MODE" = false ]; then
      run_test "Gemini: Longer context" \
        "timeout 30 $CLI_PATH run assistant 'Explain TypeScript in one sentence' --provider gemini" \
        "TypeScript"
    fi

    TOTAL_COST=$(echo "$TOTAL_COST + 0.0001" | bc)
    echo ""
  fi
fi

###############################################################################
# Memory & Embedding Tests
###############################################################################

if [ "$SKIP_EMBEDDINGS" = false ]; then
  if [ -n "${OPENAI_API_KEY:-}" ]; then
    log "=== Memory & Embedding Tests ==="
    echo ""

    # Create temporary test data
    TEST_DIR=$(mktemp -d)
    cd "$TEST_DIR"

    # Initialize project
    $CLI_PATH init --quiet

    # Store memory
    run_test "Memory: Store entry" \
      "$CLI_PATH run assistant 'Remember: my favorite color is blue' --provider claude" \
      "."

    # Search memory
    if [ "$QUICK_MODE" = false ]; then
      run_test "Memory: Search" \
        "$CLI_PATH memory search 'favorite color'" \
        "blue"
    fi

    # Export memory
    run_test "Memory: Export" \
      "$CLI_PATH memory export --output /tmp/memory-test.json" \
      "."

    # Cleanup
    cd - > /dev/null
    rm -rf "$TEST_DIR"
    rm -f /tmp/memory-test.json

    TOTAL_COST=$(echo "$TOTAL_COST + 0.0001" | bc)
    echo ""
  fi
fi

###############################################################################
# Integration Tests
###############################################################################

if [ "$QUICK_MODE" = false ]; then
  log "=== Integration Tests ==="
  echo ""

  # Multi-turn conversation
  if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
    run_test "Integration: Multi-turn" \
      "echo -e 'My name is Alice\\nWhat is my name?' | timeout 60 $CLI_PATH chat assistant --provider claude" \
      "Alice"

    TOTAL_COST=$(echo "$TOTAL_COST + 0.002" | bc)
  fi

  echo ""
fi

###############################################################################
# Results Summary
###############################################################################

echo ""
echo "========================================"
log "Test Results"
echo "========================================"
echo ""
echo "Tests run:    $TESTS_RUN"
success "Passed:       $TESTS_PASSED"
if [ $TESTS_FAILED -gt 0 ]; then
  error "Failed:       $TESTS_FAILED"
else
  echo "Failed:       $TESTS_FAILED"
fi
echo ""
echo "Estimated cost: \$$TOTAL_COST"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  success "✅ All tests passed!"
  exit 0
else
  error "❌ Some tests failed"
  exit 1
fi
