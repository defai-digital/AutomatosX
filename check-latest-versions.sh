#!/bin/bash
echo "Current tree-sitter dependencies and their latest versions:"
echo "============================================================"
echo ""

packages=(
  "tree-sitter"
  "@derekstride/tree-sitter-sql"
  "tree-sitter-c-sharp"
  "tree-sitter-cpp"
  "tree-sitter-go"
  "tree-sitter-html"
  "tree-sitter-java"
  "tree-sitter-kotlin"
  "tree-sitter-php"
  "tree-sitter-python"
  "tree-sitter-ruby"
  "tree-sitter-rust"
  "tree-sitter-swift"
  "tree-sitter-typescript"
)

for pkg in "${packages[@]}"; do
  current=$(grep "\"$pkg\"" package.json | awk -F'"' '{print $4}')
  latest=$(npm view "$pkg" version 2>/dev/null)
  if [ -n "$latest" ]; then
    echo "$pkg"
    echo "  Current: $current"
    echo "  Latest:  $latest"
    echo ""
  else
    echo "$pkg: NOT FOUND"
    echo ""
  fi
done
