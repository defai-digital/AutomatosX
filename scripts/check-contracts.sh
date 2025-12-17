#!/bin/bash
#
# Contract Checklist Validation Script
#
# This script validates that every contract domain in packages/contracts/src/*/v1/
# has the required files:
# - schema.ts or index.ts (source of truth for schemas)
# - invariants.md (behavioral guarantees documentation)
#
# Usage: ./scripts/check-contracts.sh
# Exit codes:
#   0 - All contracts valid
#   1 - One or more contracts missing required files
#

set -e

CONTRACTS_DIR="packages/contracts/src"
ERRORS=0
CHECKED=0
WARNINGS=0

# Colors for output (if terminal supports it)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  NC='\033[0m' # No Color
else
  RED=''
  GREEN=''
  YELLOW=''
  NC=''
fi

echo "Contract Checklist Validation"
echo "=============================="
echo ""

# Check if contracts directory exists
if [ ! -d "$CONTRACTS_DIR" ]; then
  echo -e "${RED}ERROR: Contracts directory not found: $CONTRACTS_DIR${NC}"
  exit 1
fi

# Iterate through each domain directory
for domain_dir in "$CONTRACTS_DIR"/*/; do
  # Skip if not a directory
  [ -d "$domain_dir" ] || continue

  domain=$(basename "$domain_dir")

  # Skip files (like index.ts at top level)
  [ -f "$CONTRACTS_DIR/$domain" ] && continue

  v1_dir="$domain_dir/v1"

  # Check if v1 directory exists
  if [ -d "$v1_dir" ]; then
    CHECKED=$((CHECKED + 1))
    domain_valid=true

    # Check for schema.ts or index.ts (at least one required)
    if [ ! -f "$v1_dir/schema.ts" ] && [ ! -f "$v1_dir/index.ts" ]; then
      echo -e "${RED}ERROR: $domain/v1 missing schema.ts or index.ts${NC}"
      ERRORS=$((ERRORS + 1))
      domain_valid=false
    fi

    # Check for invariants.md (required)
    if [ ! -f "$v1_dir/invariants.md" ]; then
      echo -e "${RED}ERROR: $domain/v1 missing invariants.md${NC}"
      ERRORS=$((ERRORS + 1))
      domain_valid=false
    fi

    # Optional: Check for JSON schema export
    if ! ls "$v1_dir"/*.schema.json >/dev/null 2>&1; then
      # This is a warning, not an error - JSON schemas are optional
      : # Could add warning here if desired
    fi

    if [ "$domain_valid" = true ]; then
      echo -e "${GREEN}OK${NC}: $domain/v1"
    fi
  else
    echo -e "${YELLOW}WARN: $domain has no v1 directory${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
done

echo ""
echo "=============================="
echo "Summary:"
echo "  Checked: $CHECKED contracts"
echo "  Errors:  $ERRORS"
echo "  Warnings: $WARNINGS"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}FAILED: $ERRORS contract(s) missing required files${NC}"
  echo ""
  echo "Each contract domain must have:"
  echo "  - schema.ts or index.ts (Zod schemas)"
  echo "  - invariants.md (behavioral guarantees)"
  exit 1
fi

echo -e "${GREEN}SUCCESS: All contracts have required files${NC}"
exit 0
