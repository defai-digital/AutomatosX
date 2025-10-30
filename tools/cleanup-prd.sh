#!/bin/bash

###############################################################################
# PRD/ Directory Cleanup Script
#
# Archives completed PRD documents by date
#
# Usage:
#   ./tools/cleanup-prd.sh
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PRD_DIR="$PROJECT_ROOT/PRD"
WORKSPACE_PRD="$PROJECT_ROOT/automatosx/PRD"
# Generate dynamic archive directory based on current date
ARCHIVE_DATE=$(date +%Y-%m)
ARCHIVE_DIR="$PRD_DIR/archive-$ARCHIVE_DATE"

cd "$PROJECT_ROOT"

echo "📁 Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"

echo ""
echo "📊 PRD/ Directory Status:"
TOTAL_PRD=$(find "$PRD_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "Files before: $TOTAL_PRD"

echo ""
echo "🗑️  Moving PRD documents to archive..."

# Move all files except README.md
find "$PRD_DIR" -maxdepth 1 -type f \
  ! -name "README.md" \
  -exec mv {} "$ARCHIVE_DIR/" \;

echo ""
echo "📝 Creating new README.md..."

cat > "$PRD_DIR/README.md" << EOFREADME
# Product Requirements Documentation

## Current Status

This directory contains Product Requirements Documentation (PRD) for AutomatosX.

## Active Documents

Currently no active PRD documents. All planning is done in:
- Issue tracking: GitHub Issues
- Development plans: \`automatosx/tmp/\` directory (temporary)
- Architecture decisions: \`docs/\` directory

## Archived Documents

Completed PRD documents are archived by month in:
- **Location**: \`archive-YYYY-MM/\` directories
- **Organization**: All documents archived by completion date

## Project Documentation

For current project information, see:
- **User Documentation**: \`README.md\` (project root)
- **Developer Guide**: \`CLAUDE.md\` (project root)
- **API Documentation**: \`docs/\` directory
- **Change Log**: \`CHANGELOG.md\` (project root)

## Notes

- This directory is excluded from git (\`.gitignore\`)
- PRD documents are for internal planning only
- For feature requests, use GitHub Issues
EOFREADME

echo ""
echo "📦 Checking automatosx/PRD/ (workspace documents)..."
if [ -d "$WORKSPACE_PRD" ] && [ "$(ls -A "$WORKSPACE_PRD" 2>/dev/null)" ]; then
  WORKSPACE_COUNT=$(find "$WORKSPACE_PRD" -type f | wc -l | tr -d ' ')
  echo "Found $WORKSPACE_COUNT workspace documents"
  echo "Moving to archive..."
  find "$WORKSPACE_PRD" -type f -exec mv {} "$ARCHIVE_DIR/" \;
  echo "✅ Workspace documents archived"
else
  echo "✅ automatosx/PRD/ already clean"
fi

# Count results
ARCHIVED=$(find "$ARCHIVE_DIR" -type f | wc -l | tr -d ' ')
REMAINING=$(find "$PRD_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')

echo ""
echo "✅ Cleanup complete!"
echo "Files remaining in PRD/: $REMAINING"
echo "Files archived: $ARCHIVED"
echo ""
echo "📂 Remaining files in PRD/:"
ls -1 "$PRD_DIR" | grep -v "^archive-" || echo "(none)"

echo ""
echo "📁 Archive location:"
echo "PRD/archive-$ARCHIVE_DATE/ ($ARCHIVED files)"
