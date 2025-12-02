#!/bin/bash

# Check package size before and after optimization

set -e

echo "📦 Building package..."
npm run build

echo ""
echo "📊 Analyzing package size..."
echo ""

# Create package
npm pack --quiet

# Get tarball filename
TARBALL=$(ls -t defai.digital-automatosx-*.tgz 2>/dev/null | head -1)

if [ -z "$TARBALL" ]; then
    echo "❌ No tarball found"
    exit 1
fi

# Show file sizes
echo "Package: $TARBALL"
echo ""
echo "Gzipped size:"
ls -lh "$TARBALL" | awk '{print $5}'

echo ""
echo "Unpacked size:"
tar -tzf "$TARBALL" | xargs -I {} sh -c 'tar -xzOf "'$TARBALL'" "{}" | wc -c' | \
    awk '{sum+=$1} END {print sum/1024/1024 " MB"}'

echo ""
echo "Largest files in package:"
tar -tzf "$TARBALL" | \
    xargs -I {} sh -c 'size=$(tar -xzOf "'$TARBALL'" "{}" 2>/dev/null | wc -c); echo "$size {}"' | \
    sort -rn | head -10 | \
    awk '{size=$1/1024; $1=""; printf "  %.1f KB %s\n", size, $0}'

echo ""
echo "Total files:"
tar -tzf "$TARBALL" | wc -l

# Cleanup
rm "$TARBALL"

echo ""
echo "✅ Analysis complete"
