#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-}"
WEB_ROOT="${WEB_ROOT:-}"
BRANCH="${BRANCH:-}"
THEME_ROOT="${THEME_ROOT:-}"
CONTENT_ROOT="${CONTENT_ROOT:-}"
ENV_FILE="${ENV_FILE:-}"
MIGRATE_CONTENT="${MIGRATE_CONTENT:-true}"
OVERWRITE_ENV="${OVERWRITE_ENV:-false}"
INSTALL_DEPS="${INSTALL_DEPS:-false}"
ADMIN_SERVICE="${ADMIN_SERVICE:-}"

log() {
  printf '[install] %s\n' "$1"
}

fail() {
  printf '[install] ERROR: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Missing required command: $1"
  fi
}

prompt_if_unset() {
  local name="$1"
  local label="$2"
  local default_value="$3"
  local current_value="${!name-}"
  local input_value

  if [ -n "$current_value" ]; then
    return
  fi

  if [ ! -t 0 ]; then
    fail "$name is not set and no interactive terminal is available."
  fi

  if [ -n "$default_value" ]; then
    read -r -p "$label [$default_value]: " input_value
    input_value="${input_value:-$default_value}"
  else
    read -r -p "$label: " input_value
  fi

  if [ -z "$input_value" ]; then
    fail "$name cannot be empty."
  fi

  printf -v "$name" '%s' "$input_value"
}

collect_configuration() {
  prompt_if_unset REPO_DIR "Repository path (REPO_DIR)" "/srv/blender-curriculum/repo"
  prompt_if_unset WEB_ROOT "Web root path (WEB_ROOT)" "/var/www/blender-curriculum"
  prompt_if_unset BRANCH "Git branch (BRANCH)" "main"
  prompt_if_unset THEME_ROOT "Theme root path (THEME_ROOT)" "$REPO_DIR/theme"
  prompt_if_unset CONTENT_ROOT "Content root path (CONTENT_ROOT)" "/srv/blender-curriculum-content"
  prompt_if_unset ENV_FILE "Env file path (ENV_FILE)" "/etc/blender-curriculum/deploy.env"
}

maybe_install_deps() {
  if [ "$INSTALL_DEPS" != "true" ]; then
    return
  fi

  if [ "$(id -u)" -ne 0 ]; then
    fail "INSTALL_DEPS=true requires root (sudo)."
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    fail "INSTALL_DEPS=true currently supports apt-get only."
  fi

  log "Installing dependencies via apt-get (git, rsync, nodejs, npm)."
  apt-get update
  apt-get install -y git rsync nodejs npm
}

write_env_file() {
  local env_dir
  env_dir="$(dirname "$ENV_FILE")"
  mkdir -p "$env_dir"

  if [ -f "$ENV_FILE" ] && [ "$OVERWRITE_ENV" != "true" ]; then
    log "Env file exists, keeping current file: $ENV_FILE"
    return
  fi

  log "Writing env file: $ENV_FILE"
  cat >"$ENV_FILE" <<EOF
REPO_DIR=$REPO_DIR
WEB_ROOT=$WEB_ROOT
BRANCH=$BRANCH
THEME_ROOT=$THEME_ROOT
CONTENT_ROOT=$CONTENT_ROOT
# Optional:
# ADMIN_SERVICE=blender-curriculum-admin
# ALLOW_DIRTY=false
# FORCE_DEPLOY=false
EOF

  if [ -n "$ADMIN_SERVICE" ]; then
    printf 'ADMIN_SERVICE=%s\n' "$ADMIN_SERVICE" >>"$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE" || true
}

migrate_content() {
  if [ "$MIGRATE_CONTENT" != "true" ]; then
    log "Skipping content migration (MIGRATE_CONTENT=false)."
    return
  fi

  if [ ! -d "$REPO_DIR/content" ]; then
    log "No repo content directory found, skipping migration."
    return
  fi

  log "Migrating content from $REPO_DIR/content to $CONTENT_ROOT (no overwrite)."
  rsync -a --ignore-existing "$REPO_DIR/content/lessons/" "$CONTENT_ROOT/lessons/"
  rsync -a --ignore-existing "$REPO_DIR/content/tasks/" "$CONTENT_ROOT/tasks/"
  rsync -a --ignore-existing "$REPO_DIR/content/topics/" "$CONTENT_ROOT/topics/"
}

main() {
  collect_configuration
  maybe_install_deps

  require_cmd git
  require_cmd npm
  require_cmd rsync

  [ -d "$REPO_DIR/.git" ] || fail "REPO_DIR is not a git repository: $REPO_DIR"
  [ -f "$REPO_DIR/ops/deploy-pull.sh" ] || fail "Missing deploy script in repo."

  log "Creating required directories."
  mkdir -p "$WEB_ROOT"
  mkdir -p "$CONTENT_ROOT/lessons" "$CONTENT_ROOT/tasks" "$CONTENT_ROOT/topics"

  migrate_content

  chmod +x "$REPO_DIR/ops/deploy-pull.sh"
  write_env_file

  log "Installation complete."
  log "Next step:"
  log "  set -a; source $ENV_FILE; set +a; $REPO_DIR/ops/deploy-pull.sh"
}

main
