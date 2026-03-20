#!/usr/bin/env bash
set -euo pipefail

DEFAULT_ENV_FILE="/etc/blender-curriculum/blender-curriculum.env"

resolve_env_file() {
  if [ -n "${BLENDER_CURRICULUM_ENV_FILE:-}" ]; then
    printf '%s\n' "$BLENDER_CURRICULUM_ENV_FILE"
    return
  fi

  if [ -f "$DEFAULT_ENV_FILE" ]; then
    printf '%s\n' "$DEFAULT_ENV_FILE"
    return
  fi

  printf '%s\n' "$DEFAULT_ENV_FILE"
}

remember_override() {
  local name="$1"
  local has_name="HAS_OVERRIDE_${name}"
  local value_name="OVERRIDE_${name}"

  if [ "${!name+x}" = "x" ]; then
    printf -v "$has_name" '%s' "true"
    printf -v "$value_name" '%s' "${!name}"
  else
    printf -v "$has_name" '%s' "false"
  fi
}

restore_override() {
  local name="$1"
  local has_name="HAS_OVERRIDE_${name}"
  local value_name="OVERRIDE_${name}"

  if [ "${!has_name:-false}" = "true" ]; then
    export "$name=${!value_name}"
  fi
}

load_runtime_env() {
  local env_file
  env_file="$(resolve_env_file)"

  remember_override "BLENDER_CURRICULUM_REPO_DIR"
  remember_override "BLENDER_CURRICULUM_BRANCH"
  remember_override "BLENDER_CURRICULUM_WEB_ROOT"
  remember_override "BLENDER_CURRICULUM_THEME_ROOT"
  remember_override "BLENDER_CURRICULUM_CONTENT_ROOT"
  remember_override "BLENDER_CURRICULUM_ADMIN_SERVICE"
  remember_override "BLENDER_CURRICULUM_FORCE_DEPLOY"
  remember_override "BLENDER_CURRICULUM_ALLOW_DIRTY"
  remember_override "BLENDER_CURRICULUM_ENV_FILE"

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi

  export BLENDER_CURRICULUM_ENV_FILE="$env_file"
  restore_override "BLENDER_CURRICULUM_REPO_DIR"
  restore_override "BLENDER_CURRICULUM_BRANCH"
  restore_override "BLENDER_CURRICULUM_WEB_ROOT"
  restore_override "BLENDER_CURRICULUM_THEME_ROOT"
  restore_override "BLENDER_CURRICULUM_CONTENT_ROOT"
  restore_override "BLENDER_CURRICULUM_ADMIN_SERVICE"
  restore_override "BLENDER_CURRICULUM_FORCE_DEPLOY"
  restore_override "BLENDER_CURRICULUM_ALLOW_DIRTY"
  restore_override "BLENDER_CURRICULUM_ENV_FILE"
}

print_env_exports() {
  local name
  for name in \
    BLENDER_CURRICULUM_ENV_FILE \
    BLENDER_CURRICULUM_REPO_DIR \
    BLENDER_CURRICULUM_BRANCH \
    BLENDER_CURRICULUM_WEB_ROOT \
    BLENDER_CURRICULUM_THEME_ROOT \
    BLENDER_CURRICULUM_CONTENT_ROOT \
    BLENDER_CURRICULUM_ADMIN_HOST \
    BLENDER_CURRICULUM_ADMIN_PORT \
    BLENDER_CURRICULUM_ADMIN_USER_FILE \
    BLENDER_CURRICULUM_SESSION_SECRET \
    BLENDER_CURRICULUM_SESSION_COOKIE_NAME \
    BLENDER_CURRICULUM_SESSION_COOKIE_SECURE \
    BLENDER_CURRICULUM_SESSION_TTL_SECONDS \
    BLENDER_CURRICULUM_ADMIN_SERVICE \
    BLENDER_CURRICULUM_FORCE_DEPLOY \
    BLENDER_CURRICULUM_ALLOW_DIRTY
  do
    if [ "${!name+x}" = "x" ]; then
      printf 'export %s=%q\n' "$name" "${!name}"
    fi
  done
}

COMMAND="${1:-deploy}"

load_runtime_env

if [ "$COMMAND" = "print-env" ]; then
  print_env_exports
  exit 0
fi

if [ "$COMMAND" != "deploy" ]; then
  echo "Usage: $0 [deploy|print-env]" >&2
  exit 1
fi

shift || true

REPO_DIR="${BLENDER_CURRICULUM_REPO_DIR:-/srv/blender-curriculum/repo}"
BRANCH="${BLENDER_CURRICULUM_BRANCH:-main}"
WEB_ROOT="${BLENDER_CURRICULUM_WEB_ROOT:-/var/www/blender-curriculum}"
THEME_ROOT="${BLENDER_CURRICULUM_THEME_ROOT:-$REPO_DIR/theme}"
CONTENT_ROOT="${BLENDER_CURRICULUM_CONTENT_ROOT:-$REPO_DIR/content}"
ADMIN_SERVICE="${BLENDER_CURRICULUM_ADMIN_SERVICE:-}"
FORCE_DEPLOY="${BLENDER_CURRICULUM_FORCE_DEPLOY:-false}"
ALLOW_DIRTY="${BLENDER_CURRICULUM_ALLOW_DIRTY:-false}"

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
  echo "Set BLENDER_CURRICULUM_ALLOW_DIRTY=true to deploy local (uncommitted) content." >&2
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
      echo "No new git commit, but BLENDER_CURRICULUM_CONTENT_ROOT is outside repo. Continuing."
    elif [ "$FORCE_DEPLOY" != "true" ]; then
      echo "No changes on origin/$BRANCH. Nothing to deploy."
      echo "Set BLENDER_CURRICULUM_FORCE_DEPLOY=true to build and sync anyway."
      exit 0
    else
      echo "No new commit, but BLENDER_CURRICULUM_FORCE_DEPLOY=true. Continuing."
    fi
  else
    git merge --ff-only "origin/$BRANCH"
  fi
fi

npm ci
mkdir -p "$CONTENT_ROOT/lessons" "$CONTENT_ROOT/tasks" "$CONTENT_ROOT/topics" "$CONTENT_ROOT/resources"
BLENDER_CURRICULUM_THEME_ROOT="$THEME_ROOT" \
BLENDER_CURRICULUM_CONTENT_ROOT="$CONTENT_ROOT" \
npm run build

rsync -az --delete build/ "${WEB_ROOT}/"

if [ -n "$ADMIN_SERVICE" ]; then
  sudo systemctl restart "$ADMIN_SERVICE"
  sudo systemctl is-active --quiet "$ADMIN_SERVICE"
fi

echo "Deployment finished at commit $(git rev-parse --short HEAD)."
