#!/bin/bash

###############################################################################
# automatosx/tmp/ Directory Cleanup Script
#
# Archives all temporary documents by date
# Note: automatosx/tmp/ is for temporary working documents, not .gitignored tmp/
#
# Usage:
#   ./tools/cleanup-tmp.sh [--keep-recent N]
#
# Options:
#   --keep-recent N    Keep files modified within last N days (default: 7)
###############################################################################

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TMP_DIR="$PROJECT_ROOT/automatosx/tmp"
# Generate dynamic archive directory based on current date
ARCHIVE_DATE=$(date +%Y-%m)
ARCHIVE_DIR="$TMP_DIR/archive-$ARCHIVE_DATE"

# Parse arguments
KEEP_DAYS=7
while [[ $# -gt 0 ]]; do
  case $1 in
    --keep-recent)
      KEEP_DAYS="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--keep-recent N]"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

echo "📁 Creating archive directory..."
mkdir -p "$ARCHIVE_DIR"

echo ""
echo "📋 Cleanup policy:"
echo "• Keep files modified within last $KEEP_DAYS days"
echo "• Archive older files to: archive-$ARCHIVE_DATE/"

echo ""
echo "🗑️  Moving files to archive..."

# Count files before
TOTAL_BEFORE=$(find "$TMP_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
echo "Files before: $TOTAL_BEFORE"

# Move files older than KEEP_DAYS days
find "$TMP_DIR" -maxdepth 1 -type f -mtime +$KEEP_DAYS \
  -exec mv {} "$ARCHIVE_DIR/" \;

# Count files after
TOTAL_AFTER=$(find "$TMP_DIR" -maxdepth 1 -type f | wc -l | tr -d ' ')
ARCHIVED=$(find "$ARCHIVE_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "✅ Cleanup complete!"
echo "Files remaining: $TOTAL_AFTER"
echo "Files archived: $ARCHIVED"
echo ""
echo "📂 Remaining files (modified within last $KEEP_DAYS days):"
if [ $TOTAL_AFTER -gt 0 ]; then
  ls -1t "$TMP_DIR" | grep -v "^archive-" | head -10
else
  echo "(none)"
fi

if [ $ARCHIVED -gt 0 ]; then
  echo ""
  echo "📁 Archive location:"
  echo "automatosx/tmp/archive-$ARCHIVE_DATE/ ($ARCHIVED files)"
fi
