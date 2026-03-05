#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-/srv/blender-curriculum/repo}"
BRANCH="${BRANCH:-main}"
WEB_ROOT="${WEB_ROOT:-/var/www/blender-curriculum}"
THEME_ROOT="${THEME_ROOT:-$REPO_DIR/theme}"
CONTENT_ROOT="${CONTENT_ROOT:-$REPO_DIR/content}"
ADMIN_SERVICE="${ADMIN_SERVICE:-}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"
ALLOW_DIRTY="${ALLOW_DIRTY:-false}"

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

has_local_changes="false"
if ! git diff --quiet || ! git diff --cached --quiet; then
  has_local_changes="true"
fi

if [ "$has_local_changes" = "true" ] && [ "$ALLOW_DIRTY" != "true" ]; then
  echo "Repository has local changes. Refusing to deploy." >&2
  echo "Set ALLOW_DIRTY=true to deploy local (uncommitted) content." >&2
  exit 1
fi

if [ "$has_local_changes" = "true" ]; then
  echo "Repository has local changes. Skipping git fetch/merge."
else
  content_outside_repo="false"
  case "$CONTENT_ROOT" in
    "$REPO_DIR"/*) ;;
    *) content_outside_repo="true" ;;
  esac

  git fetch --prune origin "$BRANCH"

  if git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    git checkout "$BRANCH"
  else
    git checkout -b "$BRANCH" "origin/$BRANCH"
  fi

  local_commit="$(git rev-parse HEAD)"
  remote_commit="$(git rev-parse "origin/$BRANCH")"

  if [ "$local_commit" = "$remote_commit" ]; then
    if [ "$content_outside_repo" = "true" ]; then
      echo "No new git commit, but CONTENT_ROOT is outside repo. Continuing."
    elif [ "$FORCE_DEPLOY" != "true" ]; then
      echo "No changes on origin/$BRANCH. Nothing to deploy."
      echo "Set FORCE_DEPLOY=true to build and sync anyway."
      exit 0
    else
      echo "No new commit, but FORCE_DEPLOY=true. Continuing."
    fi
  else
    git merge --ff-only "origin/$BRANCH"
  fi
fi

npm ci
mkdir -p "$CONTENT_ROOT/lessons" "$CONTENT_ROOT/tasks" "$CONTENT_ROOT/topics"
THEME_ROOT="$THEME_ROOT" CONTENT_ROOT="$CONTENT_ROOT" npm run build

rsync -az --delete build/ "${WEB_ROOT}/"

if [ -n "$ADMIN_SERVICE" ]; then
  sudo systemctl restart "$ADMIN_SERVICE"
  sudo systemctl is-active --quiet "$ADMIN_SERVICE"
fi

echo "Deployment finished at commit $(git rev-parse --short HEAD)."
