#!/bin/bash
# Test script to generate traces with classification data for dashboard testing
# PRD-2026-003: Dashboard Classification Observability
#
# Usage: ./scripts/test-dashboard-classification.sh
#
# This script runs various ax commands to generate traces that will
# appear in the dashboard with classification information.

set -e

echo "=========================================="
echo "Dashboard Classification Test Script"
echo "PRD-2026-003"
echo "=========================================="
echo ""

# Check if ax is available
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm not found. Please install pnpm first."
    exit 1
fi

echo "Step 1: Building project..."
pnpm build

echo ""
echo "Step 2: Running test commands to generate traces..."
echo ""

# Run a simple provider call (generates 'call' type trace)
echo "[1/5] Running provider call test..."
pnpm ax call claude "Hello, respond with just 'OK'" --timeout 30000 2>/dev/null || echo "  (Provider may not be available, continuing...)"

echo ""
echo "[2/5] Running another provider call..."
pnpm ax call gemini "What is 2+2? Just respond with the number." --timeout 30000 2>/dev/null || echo "  (Provider may not be available, continuing...)"

echo ""
echo "[3/5] Running agent list to verify agents..."
pnpm ax agent list 2>/dev/null || echo "  (Continuing...)"

echo ""
echo "[4/5] Running a quick discussion test..."
pnpm ax discuss "What is the best programming language for beginners?" --rounds 1 --fast 2>/dev/null || echo "  (Discussion may have failed, continuing...)"

echo ""
echo "[5/5] Running doctor to check provider health..."
pnpm ax doctor 2>/dev/null || echo "  (Continuing...)"

echo ""
echo "=========================================="
echo "Trace generation complete!"
echo ""
echo "Now start the dashboard to view the results:"
echo ""
echo "  pnpm ax monitor"
echo ""
echo "The dashboard will show:"
echo "  - Execution Stats card with recent traces"
echo "  - Task Classification card (if classification data exists)"
echo "  - Classification badges on trace details"
echo "=========================================="
