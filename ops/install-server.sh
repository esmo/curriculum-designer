#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-}"
WEB_ROOT="${WEB_ROOT:-}"
BRANCH="${BRANCH:-}"
THEME_ROOT="${THEME_ROOT:-}"
CONTENT_ROOT="${CONTENT_ROOT:-}"
ENV_FILE="${ENV_FILE:-}"
ADMIN_USER="${ADMIN_USER:-}"
ADMIN_GROUP="${ADMIN_GROUP:-}"
ADMIN_HOST="${ADMIN_HOST:-}"
ADMIN_PORT="${ADMIN_PORT:-}"
MIGRATE_CONTENT="${MIGRATE_CONTENT:-true}"
OVERWRITE_ENV="${OVERWRITE_ENV:-false}"
INSTALL_DEPS="${INSTALL_DEPS:-false}"
ADMIN_SERVICE="${ADMIN_SERVICE:-}"
SYSTEMD_UNIT_NAME="${SYSTEMD_UNIT_NAME:-blender-curriculum-admin.service}"
NGINX_SNIPPET_NAME="${NGINX_SNIPPET_NAME:-blender-curriculum-admin.conf}"
NGINX_HTPASSWD_PATH="${NGINX_HTPASSWD_PATH:-/etc/nginx/.htpasswd}"

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

default_service_user() {
  if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
    printf '%s' "$SUDO_USER"
    return
  fi

  id -un
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
  prompt_if_unset ADMIN_USER "Admin service user (ADMIN_USER)" "$(default_service_user)"
  prompt_if_unset ADMIN_GROUP "Admin service group (ADMIN_GROUP)" "$ADMIN_USER"
  prompt_if_unset ADMIN_HOST "Admin bind host (ADMIN_HOST)" "127.0.0.1"
  prompt_if_unset ADMIN_PORT "Admin bind port (ADMIN_PORT)" "8787"
}

validate_admin_config() {
  case "$ADMIN_PORT" in
    '' | *[!0-9]*)
      fail "ADMIN_PORT must be a numeric port between 1 and 65535."
      ;;
  esac

  if [ "$ADMIN_PORT" -lt 1 ] || [ "$ADMIN_PORT" -gt 65535 ]; then
    fail "ADMIN_PORT must be between 1 and 65535."
  fi
}

write_systemd_unit() {
  local target_path="$1"
  cat >"$target_path" <<EOF
[Unit]
Description=Blender Curriculum Admin Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ADMIN_USER
Group=$ADMIN_GROUP
WorkingDirectory=$REPO_DIR
Environment=REQUIRE_PROXY_AUTH=true
Environment=THEME_ROOT=$THEME_ROOT
Environment=CONTENT_ROOT=$CONTENT_ROOT
Environment=ADMIN_HOST=$ADMIN_HOST
Environment=ADMIN_PORT=$ADMIN_PORT
ExecStart=/usr/bin/env npm run admin
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
}

write_nginx_snippet() {
  local target_path="$1"
  cat >"$target_path" <<EOF
location = /admin {
  return 301 /admin/;
}

location /admin/ {
  auth_basic "Admin";
  auth_basic_user_file $NGINX_HTPASSWD_PATH;
  proxy_pass http://$ADMIN_HOST:$ADMIN_PORT/admin/;
  proxy_set_header Host \$host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_set_header X-Remote-User \$remote_user;
}

location /admin-api/ {
  auth_basic "Admin";
  auth_basic_user_file $NGINX_HTPASSWD_PATH;
  proxy_pass http://$ADMIN_HOST:$ADMIN_PORT/admin-api/;
  proxy_set_header Host \$host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_set_header X-Remote-User \$remote_user;
}
EOF
}

generate_runtime_configs() {
  local generated_dir
  local generated_systemd
  local generated_nginx
  local systemd_target
  local nginx_target

  generated_dir="$REPO_DIR/ops/generated"
  generated_systemd="$generated_dir/$SYSTEMD_UNIT_NAME"
  generated_nginx="$generated_dir/$NGINX_SNIPPET_NAME"

  mkdir -p "$generated_dir"
  write_systemd_unit "$generated_systemd"
  write_nginx_snippet "$generated_nginx"

  log "Generated systemd unit: $generated_systemd"
  log "Generated nginx snippet: $generated_nginx"

  if [ "$(id -u)" -ne 0 ]; then
    log "Not running as root: skipped install to /etc."
    return
  fi

  systemd_target="/etc/systemd/system/$SYSTEMD_UNIT_NAME"
  nginx_target="/etc/nginx/snippets/$NGINX_SNIPPET_NAME"

  mkdir -p /etc/systemd/system /etc/nginx/snippets
  cp "$generated_systemd" "$systemd_target"
  cp "$generated_nginx" "$nginx_target"

  log "Installed systemd unit: $systemd_target"
  log "Installed nginx snippet: $nginx_target"
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
# ADMIN_SERVICE=$SYSTEMD_UNIT_NAME
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
  validate_admin_config
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
  generate_runtime_configs

  log "Installation complete."
  log "Next steps:"
  log "  set -a; source '$ENV_FILE'; set +a; '$REPO_DIR/ops/deploy-pull.sh'"
  if [ "$(id -u)" -eq 0 ]; then
    log "  systemctl daemon-reload"
    log "  systemctl enable --now '$SYSTEMD_UNIT_NAME'"
    log "  Include this line in your Nginx server block:"
    log "    include /etc/nginx/snippets/$NGINX_SNIPPET_NAME;"
    log "  nginx -t && systemctl reload nginx"
  fi
}

main
