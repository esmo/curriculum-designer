#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="/etc/curriculum-designer"
DEFAULT_INSTANCE_NAME="default"

INSTANCE_NAME=""
ENV_FILE=""
INSTANCE_ROOT=""
BUILD_ROOT=""
WEB_ROOT=""
SERVICE_NAME=""

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

resolve_path() {
  node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1]));' "$1"
}

validate_instance_name() {
  case "$INSTANCE_NAME" in
    '' | *[!A-Za-z0-9_-]*)
      fail "Instance name may only contain letters, numbers, _ and -."
      ;;
  esac
}

resolve_target() {
  local input="${1:-$DEFAULT_INSTANCE_NAME}"

  if [ "${input#*/}" != "$input" ] || [ "${input%.env}" != "$input" ]; then
    ENV_FILE="$input"
    INSTANCE_NAME="$(basename "$input")"
    INSTANCE_NAME="${INSTANCE_NAME%.env}"
  else
    INSTANCE_NAME="$input"
    ENV_FILE="$ENV_DIR/$INSTANCE_NAME.env"
  fi

  validate_instance_name
  ENV_FILE="$(resolve_path "$ENV_FILE")"
  SERVICE_NAME="curriculum-designer-admin-$INSTANCE_NAME.service"
}

load_instance_env() {
  [ -f "$ENV_FILE" ] || fail "Env file not found: $ENV_FILE"

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  [ -n "${INSTANCE_ROOT:-}" ] || fail "INSTANCE_ROOT must be set in $ENV_FILE."
  [ -n "${SESSION_SECRET:-}" ] || fail "SESSION_SECRET must be set in $ENV_FILE."

  if [ "${#SESSION_SECRET}" -lt 32 ]; then
    fail "SESSION_SECRET must be at least 32 characters long."
  fi

  case "${ADMIN_PORT:-8787}" in
    '' | *[!0-9]*)
      fail "ADMIN_PORT must be numeric."
      ;;
  esac

  if [ "${ADMIN_PORT:-8787}" -lt 1 ] || [ "${ADMIN_PORT:-8787}" -gt 65535 ]; then
    fail "ADMIN_PORT must be between 1 and 65535."
  fi

  INSTANCE_ROOT="$(resolve_path "$INSTANCE_ROOT")"
  BUILD_ROOT="$INSTANCE_ROOT/build"
  WEB_ROOT="$INSTANCE_ROOT/web"
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
  INSTANCE_ROOT="$INSTANCE_ROOT" npm run build
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
  load_instance_env
  update_repository
  build_and_publish
  restart_service

  cd "$REPO_DIR"
  log "Published $INSTANCE_NAME at commit $(git rev-parse --short HEAD)."
}

main "$@"
