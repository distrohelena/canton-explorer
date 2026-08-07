#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Usage: ./publish.sh [patch|minor|major|<version>]
BUMP="${1:-patch}"

cd "$BACKEND_DIR"

echo "Bumping version ($BUMP)..."
npm version "$BUMP"

echo "Publishing to npm..."
npm publish

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"
echo "Published $PACKAGE_NAME@$PACKAGE_VERSION"
