#!/bin/bash

###############################################################################
# Smoke Test Script
#
# Quick validation that AutomatosX basic functionality works.
# Runs in <1 minute with mock providers (no API costs).
#
# Usage:
#   ./tools/smoke-test.sh
#
# Exit codes:
#   0 - All tests passed
#   1 - One or more tests failed
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI_PATH="$ROOT_DIR/dist/index.js"

# Enable mock providers
export AUTOMATOSX_MOCK_PROVIDERS=true

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

###############################################################################
# Helper Functions
###############################################################################

log() {
  echo -e "${BLUE}[TEST]${NC} $1"
}

success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}[FAIL]${NC} $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

test_command() {
  local name="$1"
  local command="$2"
  local expected_exit="$3"

  log "$name"

  if eval "$command" > /dev/null 2>&1; then
    actual_exit=0
  else
    actual_exit=$?
  fi

  if [ "$actual_exit" -eq "$expected_exit" ]; then
    success "$name"
  else
    fail "$name (exit code: $actual_exit, expected: $expected_exit)"
  fi
}

test_output() {
  local name="$1"
  local command="$2"
  local expected_pattern="$3"

  log "$name"

  output=$(eval "$command" 2>&1 || true)

  if echo "$output" | grep -q "$expected_pattern"; then
    success "$name"
  else
    fail "$name (pattern '$expected_pattern' not found)"
  fi
}

###############################################################################
# Pre-flight Checks
###############################################################################

echo ""
echo "AutomatosX Smoke Test Suite"
echo "============================"
echo ""

# Check if CLI is built
if [ ! -f "$CLI_PATH" ]; then
  echo -e "${RED}ERROR:${NC} CLI not built at $CLI_PATH"
  echo "Run 'npm run build' first"
  exit 1
fi

log "Using CLI: $CLI_PATH"
log "Mode: Mock providers (no API costs)"
echo ""

###############################################################################
# Test Suite
###############################################################################

log "Running smoke tests..."
echo ""

# Test 1: Version (check that version is returned)
test_output "CLI version" \
  "$CLI_PATH --version" \
  "[0-9]+\.[0-9]+\.[0-9]+"

# Test 2: Help
test_output "CLI help" \
  "$CLI_PATH --help" \
  "Commands"

# Test 3: Status command
test_command "Status command" \
  "$CLI_PATH status" \
  0

# Test 4: Config command
test_command "Config command (no config file)" \
  "$CLI_PATH config" \
  1

# Test 5: List agents (no project)
test_command "List agents" \
  "$CLI_PATH list agents" \
  0

# Test 6: List abilities (no project)
test_command "List abilities" \
  "$CLI_PATH list abilities" \
  0

# Test 7: Run command with mock provider
test_output "Run assistant (mock)" \
  "timeout 10 $CLI_PATH run assistant 'hello'" \
  "Mock response"

# Test 8: Memory list (no database)
test_command "Memory list (no database)" \
  "$CLI_PATH memory list" \
  1

# Test 9: Init command in temp directory
TEST_DIR=$(mktemp -d)
test_command "Init command" \
  "cd $TEST_DIR && $CLI_PATH init --quiet" \
  0
rm -rf "$TEST_DIR"

# Test 10: Invalid command
test_command "Invalid command handling" \
  "$CLI_PATH invalid-command" \
  1

# Test 11: Unknown option
test_command "Unknown option handling" \
  "$CLI_PATH --unknown-option" \
  1

# Test 12: Help for specific command
test_output "Command-specific help" \
  "$CLI_PATH run --help" \
  "agent"

# Test 13: Built binary size
BINARY_SIZE=$(du -m "$ROOT_DIR/dist" | cut -f1)
if [ "$BINARY_SIZE" -lt 1 ]; then
  success "Bundle size check (<1MB: ${BINARY_SIZE}MB)"
else
  fail "Bundle size check (${BINARY_SIZE}MB exceeds 1MB)"
fi

###############################################################################
# Project-specific Tests
###############################################################################

log "Running project-specific tests..."
echo ""

# Create temporary project
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR"

# Test 14: Initialize project
test_command "Initialize project" \
  "$CLI_PATH init --quiet" \
  0

# Test 15: Config created
if [ -f ".automatosx/config.json" ]; then
  success "Config file created"
else
  fail "Config file not created"
fi

# Test 16: Config is valid JSON
if cat .automatosx/config.json | grep -q "version"; then
  success "Config is valid JSON"
else
  fail "Config is invalid JSON"
fi

# Test 17: Config command works in project
test_output "Config command in project" \
  "$CLI_PATH config" \
  "config\\.json"

# Test 18: Set config value
test_command "Set config value" \
  "$CLI_PATH config --set logging.level --value debug" \
  0

# Test 19: Get config value
test_output "Get config value" \
  "$CLI_PATH config --get logging.level" \
  "debug"

# Test 20: Memory commands work in project
test_command "Memory list in project" \
  "$CLI_PATH memory list" \
  0

# Cleanup
cd - > /dev/null
rm -rf "$TEST_DIR"

###############################################################################
# Build Verification
###############################################################################

log "Running build verification..."
echo ""

# Test 21: TypeScript compilation
test_command "TypeScript compilation" \
  "cd $ROOT_DIR && npm run typecheck" \
  0

# Test 22: All files in dist/
DIST_FILES=$(find "$ROOT_DIR/dist" -name "*.js" | wc -l)
if [ "$DIST_FILES" -gt 10 ]; then
  success "Distribution files present ($DIST_FILES files)"
else
  fail "Too few distribution files ($DIST_FILES files)"
fi

###############################################################################
# Results Summary
###############################################################################

echo ""
echo "========================================"
echo "Smoke Test Results"
echo "========================================"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo "Total tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Failed:       $TESTS_FAILED${NC}"
  echo ""
  echo -e "${RED}❌ Smoke tests failed${NC}"
  exit 1
else
  echo "Failed:       0"
  echo ""
  echo -e "${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
fi
