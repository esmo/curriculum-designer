#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DEFAULT_INSTANCE_NAME="default"

INSTANCE_NAME=""
INSTANCE_ROOT=""
BUILD_ROOT=""
WEB_ROOT=""
INSTANCE_ENV_FILE=""
SERVICE_NAME=""
ADMIN_PORT=""

log() {
  printf '[deploy] %s\n' "$1"
}

fail() {
  printf '[deploy] ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

resolve_target() {
  local input="${1:-$DEFAULT_INSTANCE_NAME}"
  local -a resolve_args

  resolve_args=(resolve --shell "$input")
  if [ -n "${INSTANCE_REGISTRY_FILE:-}" ]; then
    resolve_args+=(--registry "$INSTANCE_REGISTRY_FILE")
  fi

  eval "$(
    node "$SCRIPT_DIR/instances.js" "${resolve_args[@]}"
  )"

  [ -f "$INSTANCE_ENV_FILE" ] || fail "Env file not found: $INSTANCE_ENV_FILE"
}

update_repository() {
  cd "$REPO_DIR"

  [ -d .git ] || fail "Repository is not a git repository: $REPO_DIR"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    fail "Repository has local changes. Commit or stash them before deploying."
  fi

  git fetch --prune origin main

  if git show-ref --verify --quiet refs/heads/main; then
    git checkout main
  else
    git checkout -b main origin/main
  fi

  git merge --ff-only origin/main
}

build_and_publish() {
  cd "$REPO_DIR"
  npm ci

  mkdir -p "$WEB_ROOT"
  INSTANCE_NAME="$INSTANCE_NAME" npm run build
  rsync -az --delete "${BUILD_ROOT}/" "${WEB_ROOT}/"
}

restart_service() {
  local -a systemctl_cmd

  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not available. Skipping service restart."
    return
  fi

  if ! systemctl cat "$SERVICE_NAME" >/dev/null 2>&1; then
    log "Systemd unit not installed. Skipping service restart: $SERVICE_NAME"
    return
  fi

  if [ "$(id -u)" -eq 0 ]; then
    systemctl_cmd=(systemctl)
  else
    systemctl_cmd=(sudo systemctl)
  fi

  "${systemctl_cmd[@]}" restart "$SERVICE_NAME"
  "${systemctl_cmd[@]}" is-active --quiet "$SERVICE_NAME"
  log "Restarted $SERVICE_NAME."
}

main() {
  require_cmd git
  require_cmd node
  require_cmd npm
  require_cmd rsync

  resolve_target "${1:-$DEFAULT_INSTANCE_NAME}"
  update_repository
  build_and_publish
  restart_service

  cd "$REPO_DIR"
  log "Published $INSTANCE_NAME at commit $(git rev-parse --short HEAD)."
}

main "$@"
