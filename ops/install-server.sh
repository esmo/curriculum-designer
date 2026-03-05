#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${BLENDER_CURRICULUM_REPO_DIR:-}"
WEB_ROOT="${BLENDER_CURRICULUM_WEB_ROOT:-}"
BRANCH="${BLENDER_CURRICULUM_BRANCH:-}"
THEME_ROOT="${BLENDER_CURRICULUM_THEME_ROOT:-}"
CONTENT_ROOT="${BLENDER_CURRICULUM_CONTENT_ROOT:-}"
ENV_FILE="${BLENDER_CURRICULUM_ENV_FILE:-}"
ADMIN_USER="${BLENDER_CURRICULUM_ADMIN_USER:-}"
ADMIN_GROUP="${BLENDER_CURRICULUM_ADMIN_GROUP:-}"
ADMIN_HOST="${BLENDER_CURRICULUM_ADMIN_HOST:-}"
ADMIN_PORT="${BLENDER_CURRICULUM_ADMIN_PORT:-}"
MIGRATE_CONTENT="${BLENDER_CURRICULUM_MIGRATE_CONTENT:-true}"
OVERWRITE_ENV="${BLENDER_CURRICULUM_OVERWRITE_ENV:-false}"
INSTALL_DEPS="${BLENDER_CURRICULUM_INSTALL_DEPS:-false}"
SETUP_DIRENV="${BLENDER_CURRICULUM_SETUP_DIRENV:-true}"
ADMIN_SERVICE="${BLENDER_CURRICULUM_ADMIN_SERVICE:-}"
SYSTEMD_UNIT_NAME="${BLENDER_CURRICULUM_SYSTEMD_UNIT_NAME:-blender-curriculum-admin.service}"
NGINX_SNIPPET_NAME="${BLENDER_CURRICULUM_NGINX_SNIPPET_NAME:-blender-curriculum-admin.conf}"
NGINX_HTPASSWD_PATH="${BLENDER_CURRICULUM_NGINX_HTPASSWD_PATH:-/etc/nginx/.htpasswd}"

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
  prompt_if_unset REPO_DIR "Repository path (BLENDER_CURRICULUM_REPO_DIR)" "/srv/blender-curriculum/repo"
  prompt_if_unset WEB_ROOT "Web root path (BLENDER_CURRICULUM_WEB_ROOT)" "/var/www/blender-curriculum"
  prompt_if_unset BRANCH "Git branch (BLENDER_CURRICULUM_BRANCH)" "main"
  prompt_if_unset THEME_ROOT "Theme root path (BLENDER_CURRICULUM_THEME_ROOT)" "$REPO_DIR/theme"
  prompt_if_unset CONTENT_ROOT "Content root path (BLENDER_CURRICULUM_CONTENT_ROOT)" "/srv/blender-curriculum-content"
  prompt_if_unset ENV_FILE "Env file path (BLENDER_CURRICULUM_ENV_FILE)" "/etc/blender-curriculum/deploy.env"
  prompt_if_unset ADMIN_USER "Admin service user (BLENDER_CURRICULUM_ADMIN_USER)" "$(default_service_user)"
  prompt_if_unset ADMIN_GROUP "Admin service group (BLENDER_CURRICULUM_ADMIN_GROUP)" "$ADMIN_USER"
  prompt_if_unset ADMIN_HOST "Admin bind host (BLENDER_CURRICULUM_ADMIN_HOST)" "127.0.0.1"
  prompt_if_unset ADMIN_PORT "Admin bind port (BLENDER_CURRICULUM_ADMIN_PORT)" "8787"
}

validate_admin_config() {
  case "$ADMIN_PORT" in
    '' | *[!0-9]*)
      fail "BLENDER_CURRICULUM_ADMIN_PORT must be a numeric port between 1 and 65535."
      ;;
  esac

  if [ "$ADMIN_PORT" -lt 1 ] || [ "$ADMIN_PORT" -gt 65535 ]; then
    fail "BLENDER_CURRICULUM_ADMIN_PORT must be between 1 and 65535."
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
Environment=BLENDER_CURRICULUM_REQUIRE_PROXY_AUTH=true
Environment=BLENDER_CURRICULUM_THEME_ROOT=$THEME_ROOT
Environment=BLENDER_CURRICULUM_CONTENT_ROOT=$CONTENT_ROOT
Environment=BLENDER_CURRICULUM_WEB_ROOT=$WEB_ROOT
Environment=BLENDER_CURRICULUM_ADMIN_HOST=$ADMIN_HOST
Environment=BLENDER_CURRICULUM_ADMIN_PORT=$ADMIN_PORT
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
    fail "BLENDER_CURRICULUM_INSTALL_DEPS=true requires root (sudo)."
  fi

  if ! command -v apt-get >/dev/null 2>&1; then
    fail "BLENDER_CURRICULUM_INSTALL_DEPS=true currently supports apt-get only."
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
BLENDER_CURRICULUM_REPO_DIR=$REPO_DIR
BLENDER_CURRICULUM_WEB_ROOT=$WEB_ROOT
BLENDER_CURRICULUM_BRANCH=$BRANCH
BLENDER_CURRICULUM_THEME_ROOT=$THEME_ROOT
BLENDER_CURRICULUM_CONTENT_ROOT=$CONTENT_ROOT
# Optional:
# BLENDER_CURRICULUM_ADMIN_SERVICE=$SYSTEMD_UNIT_NAME
# BLENDER_CURRICULUM_ALLOW_DIRTY=false
# BLENDER_CURRICULUM_FORCE_DEPLOY=false
EOF

  if [ -n "$ADMIN_SERVICE" ]; then
    printf 'BLENDER_CURRICULUM_ADMIN_SERVICE=%s\n' "$ADMIN_SERVICE" >>"$ENV_FILE"
  fi

  chmod 600 "$ENV_FILE" || true
}

setup_direnv() {
  local envrc_path
  local shell_user

  if [ "$SETUP_DIRENV" != "true" ]; then
    log "Skipping direnv setup (BLENDER_CURRICULUM_SETUP_DIRENV=false)."
    return
  fi

  envrc_path="$REPO_DIR/.envrc"
  cat >"$envrc_path" <<EOF
set -a
source "$ENV_FILE"
set +a
EOF

  chmod 644 "$envrc_path" || true
  chown "$ADMIN_USER:$ADMIN_GROUP" "$envrc_path" 2>/dev/null || true
  log "Wrote direnv file: $envrc_path"

  if ! command -v direnv >/dev/null 2>&1; then
    log "direnv not found. Install direnv and add hook to your shell to enable auto-loading."
    log "  zsh:  eval \"\$(direnv hook zsh)\""
    log "  bash: eval \"\$(direnv hook bash)\""
    return
  fi

  shell_user="${SUDO_USER:-$(id -un)}"
  if id "$shell_user" >/dev/null 2>&1; then
    if [ "$(id -u)" -eq 0 ] && [ "$shell_user" != "root" ]; then
      sudo -u "$shell_user" direnv allow "$REPO_DIR" >/dev/null 2>&1 || true
    else
      direnv allow "$REPO_DIR" >/dev/null 2>&1 || true
    fi
    log "direnv allowed for $shell_user in: $REPO_DIR"
  fi

  log "If not already configured, add direnv hook to your shell profile:"
  log "  zsh:  eval \"\$(direnv hook zsh)\""
  log "  bash: eval \"\$(direnv hook bash)\""
}

migrate_content() {
  if [ "$MIGRATE_CONTENT" != "true" ]; then
    log "Skipping content migration (BLENDER_CURRICULUM_MIGRATE_CONTENT=false)."
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

  [ -d "$REPO_DIR/.git" ] || fail "BLENDER_CURRICULUM_REPO_DIR is not a git repository: $REPO_DIR"
  [ -f "$REPO_DIR/ops/deploy-pull.sh" ] || fail "Missing deploy script in repo."

  log "Creating required directories."
  mkdir -p "$WEB_ROOT"
  mkdir -p "$CONTENT_ROOT/lessons" "$CONTENT_ROOT/tasks" "$CONTENT_ROOT/topics"

  migrate_content

  chmod +x "$REPO_DIR/ops/deploy-pull.sh"
  write_env_file
  setup_direnv
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
