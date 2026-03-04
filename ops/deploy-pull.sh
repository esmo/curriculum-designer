#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/blender-curriculum/repo}"
BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-/var/www/blender-curriculum}"
ADMIN_SERVICE="${ADMIN_SERVICE:-}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd git
require_cmd npm
require_cmd rsync

cd "$REPO_DIR"

if [ ! -d .git ]; then
  echo "REPO_DIR is not a git repository: $REPO_DIR" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Repository has local changes. Refusing to deploy." >&2
  exit 1
fi

git fetch --prune origin "$BRANCH"

if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
  git checkout "$BRANCH"
else
  git checkout -b "$BRANCH" "origin/$BRANCH"
fi

local_commit="$(git rev-parse HEAD)"
remote_commit="$(git rev-parse "origin/$BRANCH")"

if [ "$local_commit" = "$remote_commit" ]; then
  if [ "$FORCE_DEPLOY" != "true" ]; then
    echo "No changes on origin/$BRANCH. Nothing to deploy."
    echo "Set FORCE_DEPLOY=true to build and sync anyway."
    exit 0
  fi
  echo "No new commit, but FORCE_DEPLOY=true. Continuing."
else
  git merge --ff-only "origin/$BRANCH"
fi

npm ci
npm run build
rsync -az --delete build/ "${WEB_ROOT}/"

if [ -n "$ADMIN_SERVICE" ]; then
  sudo systemctl restart "$ADMIN_SERVICE"
  sudo systemctl is-active --quiet "$ADMIN_SERVICE"
fi

echo "Deployment finished at commit $(git rev-parse --short HEAD)."
