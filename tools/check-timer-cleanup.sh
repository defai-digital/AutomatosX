#!/bin/bash

# Timer Cleanup Verification Script
# Checks that all setTimeout/setInterval calls have corresponding cleanup logic

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking for timer cleanup patterns..."
echo ""

ISSUES_FOUND=0

# Find all files with setTimeout/setInterval
FILES_WITH_TIMERS=$(grep -rl "setTimeout\|setInterval" src/ --include="*.ts" 2>/dev/null || true)

if [ -z "$FILES_WITH_TIMERS" ]; then
  echo "${GREEN}✓ No timer usage found${NC}"
  exit 0
fi

echo "Files with timers:"
echo "$FILES_WITH_TIMERS" | sed 's/^/  /'
echo ""

# Check each file
for file in $FILES_WITH_TIMERS; do
  # Skip test files and simple delays
  if [[ $file == *"test"* ]] || [[ $file == *"spec"* ]]; then
    continue
  fi

  # Check if file has destroy/cleanup/shutdown/clear/close/flush method
  HAS_CLEANUP=$(grep -E "destroy\(\)|cleanup\(\)|shutdown\(\)|stopCleanup\(\)|clear\(\)|close\(\)|flush\(\)" "$file" || true)

  if [ -z "$HAS_CLEANUP" ]; then
    # Check if it's just Promise delays (safe pattern)
    IS_DELAY_ONLY=$(grep "setTimeout" "$file" | grep -c "Promise.*resolve.*setTimeout" || true)
    TIMER_COUNT=$(grep -c "setTimeout\|setInterval" "$file" || true)

    if [ "$TIMER_COUNT" -gt "$IS_DELAY_ONLY" ]; then
      echo "${YELLOW}⚠  $file${NC}"
      echo "   Has timers but no cleanup method"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    fi
  else
    # Has cleanup method - verify it clears timers
    HAS_CLEAR=$(grep -E "clearTimeout|clearInterval" "$file" || true)
    if [ -z "$HAS_CLEAR" ]; then
      echo "${YELLOW}⚠  $file${NC}"
      echo "   Has cleanup method but doesn't clear timers"
      ISSUES_FOUND=$((ISSUES_FOUND + 1))
    else
      echo "${GREEN}✓ $file${NC}"
    fi
  fi
done

echo ""
if [ $ISSUES_FOUND -eq 0 ]; then
  echo "${GREEN}✅ All timer cleanup patterns verified!${NC}"
  exit 0
else
  echo "${RED}❌ Found $ISSUES_FOUND potential timer cleanup issues${NC}"
  echo ""
  echo "Please ensure:"
  echo "  1. Classes with timers have destroy()/cleanup()/shutdown() methods"
  echo "  2. Cleanup methods call clearTimeout()/clearInterval()"
  echo "  3. Timers are cleared before reassignment"
  exit 1
fi
