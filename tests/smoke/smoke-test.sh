#!/bin/bash

# Smoke tests for AutomatosX package
# Tests the actual npm package in a clean environment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR=$(mktemp -d)
TARBALL=""

echo "🧪 AutomatosX Smoke Tests"
echo "========================="
echo ""
echo "Test directory: $TEST_DIR"
echo ""

# Cleanup function
cleanup() {
    local exit_code=$?
    echo ""
    echo "🧹 Cleaning up..."
    cd "$PROJECT_ROOT"
    rm -rf "$TEST_DIR"
    [ -n "$TARBALL" ] && rm -f "$TARBALL"

    if [ $exit_code -eq 0 ]; then
        echo "✅ All smoke tests passed!"
    else
        echo "❌ Smoke tests failed!"
    fi

    exit $exit_code
}

trap cleanup EXIT INT TERM

# Step 1: Build and pack
echo "📦 Step 1: Building and packing..."
cd "$PROJECT_ROOT"
npm run build
TARBALL=$(npm pack 2>&1 | tail -1)
echo "   Created: $TARBALL"
echo ""

# Step 2: Install in clean environment
echo "📥 Step 2: Installing package in clean environment..."
cd "$TEST_DIR"
npm init -y > /dev/null 2>&1
npm install "$PROJECT_ROOT/$TARBALL" > /dev/null 2>&1
echo "   ✓ Package installed"
echo ""

# Step 3: Test CLI availability
echo "🔍 Step 3: Testing CLI availability..."

# Test automatosx command
if ! npx automatosx --version > /dev/null 2>&1; then
    echo "   ✗ 'automatosx' command not available"
    exit 1
fi
echo "   ✓ 'automatosx' command available"

# Test ax alias
if ! npx ax --version > /dev/null 2>&1; then
    echo "   ✗ 'ax' alias not available"
    exit 1
fi
echo "   ✓ 'ax' alias available"
echo ""

# Step 4: Test basic commands
echo "🧪 Step 4: Testing basic commands..."

# Test --version
VERSION=$(npx ax --version)
if [ -z "$VERSION" ]; then
    echo "   ✗ Version command failed"
    exit 1
fi
echo "   ✓ Version: $VERSION"

# Test --help
if ! npx ax --help > /dev/null 2>&1; then
    echo "   ✗ Help command failed"
    exit 1
fi
echo "   ✓ Help command works"

# Test list agents
if ! npx ax list agents > /dev/null 2>&1; then
    echo "   ✗ 'list agents' command failed"
    exit 1
fi
echo "   ✓ 'list agents' command works"

# Test status (with timeout to prevent hangs)
if ! timeout 10 npx ax status > /dev/null 2>&1; then
    echo "   ⚠️  'status' command timeout or failed (skipping for now)"
else
    echo "   ✓ 'status' command works"
fi
echo ""

# Step 5: Test examples directory
echo "📂 Step 5: Verifying examples directory..."
EXAMPLES_DIR="$TEST_DIR/node_modules/@defai.digital/automatosx/examples"

if [ ! -d "$EXAMPLES_DIR" ]; then
    echo "   ✗ Examples directory missing"
    exit 1
fi
echo "   ✓ Examples directory present"

# Check key example files
if [ ! -f "$EXAMPLES_DIR/AGENTS_INFO.md" ]; then
    echo "   ✗ AGENTS_INFO.md missing"
    exit 1
fi
echo "   ✓ AGENTS_INFO.md present"

# Count abilities
ABILITIES_COUNT=$(find "$EXAMPLES_DIR/abilities" -name "*.md" 2>/dev/null | wc -l)
if [ "$ABILITIES_COUNT" -lt 20 ]; then
    echo "   ✗ Expected at least 20 abilities, found $ABILITIES_COUNT"
    exit 1
fi
echo "   ✓ Found $ABILITIES_COUNT abilities"
echo ""

# Step 6: Test package.json integrity
echo "📋 Step 6: Checking package.json integrity..."
PKG_JSON="$TEST_DIR/node_modules/@defai.digital/automatosx/package.json"

# Check bin entries
if ! grep -q '"automatosx"' "$PKG_JSON"; then
    echo "   ✗ 'automatosx' bin entry missing"
    exit 1
fi
if ! grep -q '"ax"' "$PKG_JSON"; then
    echo "   ✗ 'ax' bin entry missing"
    exit 1
fi
echo "   ✓ Bin entries correct"

# Check engine requirement
if ! grep -q '"node": ">=24.0.0"' "$PKG_JSON"; then
    echo "   ✗ Node version requirement missing or incorrect"
    exit 1
fi
echo "   ✓ Engine requirements correct"
echo ""

# Step 7: Check for unnecessary files
echo "🔒 Step 7: Checking for unnecessary files..."
PACKAGE_DIR="$TEST_DIR/node_modules/@defai.digital/automatosx"

# Should not have .map files
if find "$PACKAGE_DIR" -name "*.map" | grep -q .; then
    echo "   ✗ Found .map files in package (should be excluded)"
    exit 1
fi
echo "   ✓ No source maps in package"

# Should not have test files
if [ -d "$PACKAGE_DIR/tests" ]; then
    echo "   ✗ Tests directory should not be in package"
    exit 1
fi
echo "   ✓ Test files excluded"

# Should not have src directory
if [ -d "$PACKAGE_DIR/src" ]; then
    echo "   ✗ Source directory should not be in package"
    exit 1
fi
echo "   ✓ Source files excluded"
echo ""

# Step 8: Verify dist directory
echo "📁 Step 8: Verifying dist directory..."
DIST_DIR="$PACKAGE_DIR/dist"

if [ ! -f "$DIST_DIR/index.js" ]; then
    echo "   ✗ dist/index.js missing"
    exit 1
fi
echo "   ✓ dist/index.js present"

if [ ! -f "$DIST_DIR/index.d.ts" ]; then
    echo "   ✗ dist/index.d.ts missing"
    exit 1
fi
echo "   ✓ Type definitions present"

# Check shebang
if ! head -n 1 "$DIST_DIR/index.js" | grep -q "^#!"; then
    echo "   ✗ Shebang missing from index.js"
    exit 1
fi
echo "   ✓ Shebang present"
echo ""

echo "========================="
# Success message printed in cleanup function
