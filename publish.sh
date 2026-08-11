#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"

# Usage: ./publish.sh [patch|minor|major|<version>]
BUMP="${1:-patch}"

cd "$BACKEND_DIR"

echo "Bumping version ($BUMP)..."
npm version "$BUMP" --no-git-tag-version

PACKAGE_NAME="$(node -p "require('./package.json').name")"
PACKAGE_VERSION="$(node -p "require('./package.json').version")"

echo "Committing version bump..."
git -C "$SCRIPT_DIR" add "$BACKEND_DIR/package.json"
git -C "$SCRIPT_DIR" commit -m "chore: bump $PACKAGE_NAME to v$PACKAGE_VERSION"

echo "Publishing to npm..."
npm publish

echo "Published $PACKAGE_NAME@$PACKAGE_VERSION"
