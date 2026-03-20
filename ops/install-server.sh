#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_DIR="/etc/curriculum-designer"
SYSTEMD_DIR="/etc/systemd/system"
NGINX_DIR="/etc/nginx/snippets"

ARG_INSTANCE_NAME="${1:-}"
INSTANCE_NAME="${ARG_INSTANCE_NAME:-default}"
ENV_FILE=""
INSTANCE_ROOT=""
ADMIN_PORT=""
SESSION_SECRET=""
SERVICE_USER=""
SERVICE_GROUP=""
SERVICE_NAME=""
NGINX_SNIPPET_NAME=""

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

resolve_path() {
  node -e 'const path = require("node:path"); process.stdout.write(path.resolve(process.argv[1]));' "$1"
}

default_service_user() {
  if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
    printf '%s' "$SUDO_USER"
    return
  fi

  id -un
}

generate_session_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))'
}

prompt_with_default() {
  local name="$1"
  local label="$2"
  local fallback="$3"
  local current="${!name:-}"
  local value=""

  if [ -z "$current" ]; then
    current="$fallback"
  fi

  if [ ! -t 0 ]; then
    printf -v "$name" '%s' "$current"
    return
  fi

  read -r -p "$label [$current]: " value
  printf -v "$name" '%s' "${value:-$current}"
}

validate_instance_name() {
  case "$INSTANCE_NAME" in
    '' | *[!A-Za-z0-9_-]*)
      fail "Instance name may only contain letters, numbers, _ and -."
      ;;
  esac
}

load_existing_env() {
  if [ ! -f "$ENV_FILE" ]; then
    return
  fi

  log "Loading existing configuration from $ENV_FILE"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

collect_configuration() {
  if [ -t 0 ] && [ -z "$ARG_INSTANCE_NAME" ]; then
    prompt_with_default INSTANCE_NAME "Instance name" "$INSTANCE_NAME"
  fi

  validate_instance_name

  ENV_FILE="$ENV_DIR/$INSTANCE_NAME.env"
  ENV_FILE="$(resolve_path "$ENV_FILE")"
  load_existing_env

  INSTANCE_ROOT="${INSTANCE_ROOT:-/srv/curriculum-designer/instances/$INSTANCE_NAME}"
  ADMIN_PORT="${ADMIN_PORT:-8787}"
  SESSION_SECRET="${SESSION_SECRET:-$(generate_session_secret)}"
  SERVICE_USER="${SERVICE_USER:-$(default_service_user)}"
  SERVICE_GROUP="${SERVICE_GROUP:-$SERVICE_USER}"

  prompt_with_default INSTANCE_ROOT "Instance root" "$INSTANCE_ROOT"
  prompt_with_default ADMIN_PORT "Admin port" "$ADMIN_PORT"
  prompt_with_default SERVICE_USER "Service user" "$SERVICE_USER"
  prompt_with_default SERVICE_GROUP "Service group" "$SERVICE_GROUP"

  INSTANCE_ROOT="$(resolve_path "$INSTANCE_ROOT")"
  SERVICE_NAME="curriculum-designer-admin-$INSTANCE_NAME.service"
  NGINX_SNIPPET_NAME="curriculum-designer-$INSTANCE_NAME.conf"
}

validate_configuration() {
  [ "$(id -u)" -eq 0 ] || fail "Run this script with sudo or as root."
  [ -d "$REPO_DIR/.git" ] || fail "Repository is not a git repository: $REPO_DIR"

  case "$ADMIN_PORT" in
    '' | *[!0-9]*)
      fail "Admin port must be numeric."
      ;;
  esac

  if [ "$ADMIN_PORT" -lt 1 ] || [ "$ADMIN_PORT" -gt 65535 ]; then
    fail "Admin port must be between 1 and 65535."
  fi

  if [ "${#SESSION_SECRET}" -lt 32 ]; then
    fail "SESSION_SECRET must be at least 32 characters long."
  fi

  id "$SERVICE_USER" >/dev/null 2>&1 || fail "Unknown service user: $SERVICE_USER"
  getent group "$SERVICE_GROUP" >/dev/null 2>&1 || fail "Unknown service group: $SERVICE_GROUP"
}

ensure_instance_layout() {
  local theme_root="$INSTANCE_ROOT/theme"
  local content_root="$INSTANCE_ROOT/content"
  local build_root="$INSTANCE_ROOT/build"
  local web_root="$INSTANCE_ROOT/web"
  local admin_root="$INSTANCE_ROOT/admin"
  local admin_user_file="$INSTANCE_ROOT/admin-users.txt"

  mkdir -p "$theme_root"
  mkdir -p "$content_root"
  mkdir -p "$build_root" "$web_root" "$admin_root"

  if [ -z "$(find "$theme_root" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
    cp -R "$REPO_DIR/theme/." "$theme_root/"
    log "Copied default theme into $theme_root"
  else
    log "Keeping existing theme in $theme_root"
  fi

  if [ ! -f "$admin_user_file" ]; then
    cat >"$admin_user_file" <<'EOF'
# One user per line:
# username:$argon2id$...
EOF
    log "Created $admin_user_file"
  fi

  chmod 600 "$admin_user_file"
  chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTANCE_ROOT"
}

write_env_file() {
  mkdir -p "$(dirname "$ENV_FILE")"

  {
    printf 'INSTANCE_ROOT=%q\n' "$INSTANCE_ROOT"
    printf 'SESSION_SECRET=%q\n' "$SESSION_SECRET"
    printf 'ADMIN_PORT=%q\n' "$ADMIN_PORT"
  } >"$ENV_FILE"

  chmod 600 "$ENV_FILE"
  log "Wrote $ENV_FILE"
}

write_systemd_unit() {
  local target="$SYSTEMD_DIR/$SERVICE_NAME"

  cat >"$target" <<EOF
[Unit]
Description=Curriculum Designer Admin Server ($INSTANCE_NAME)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$REPO_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/env npm run admin
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  log "Wrote $target"
}

write_nginx_snippet() {
  local target="$NGINX_DIR/$NGINX_SNIPPET_NAME"
  local web_root="$INSTANCE_ROOT/web"

  mkdir -p "$NGINX_DIR"
  cat >"$target" <<EOF
root $web_root;
index index.html;

location = /admin {
  return 301 /admin/;
}

location /admin/ {
  proxy_pass http://127.0.0.1:$ADMIN_PORT/admin/;
  proxy_set_header Host \$host;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto \$scheme;
}
EOF

  log "Wrote $target"
}

print_next_steps() {
  log "Installation complete."
  log "Next steps:"
  log "  cd '$REPO_DIR'"
  log "  INSTANCE_ROOT='$INSTANCE_ROOT' npm run admin:users -- set admin"
  log "  systemctl daemon-reload"
  log "  systemctl enable --now '$SERVICE_NAME'"
  log "  Add this line to your Nginx server block:"
  log "    include /etc/nginx/snippets/$NGINX_SNIPPET_NAME;"
  log "  nginx -t && systemctl reload nginx"
  log "  Deploy the site:"
  log "    '$REPO_DIR/ops/deploy-pull.sh' '$INSTANCE_NAME'"
}

main() {
  require_cmd find
  require_cmd getent
  require_cmd git
  require_cmd node
  require_cmd npm
  require_cmd rsync
  require_cmd systemctl

  collect_configuration
  validate_configuration
  ensure_instance_layout
  write_env_file
  write_systemd_unit
  write_nginx_snippet
  systemctl daemon-reload
  print_next_steps
}

main
