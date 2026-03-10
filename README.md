# Blender Curriculum Web Pages

Source repository for the Blender Curriculum site and admin workflow.

## Quick Start (Server)

1. Clone this repository on the server, for example to `/srv/blender-curriculum/repo`.
2. Configure read-only GitHub access for this server clone (deploy key or token).
3. Run the installation script.

Example with explicit variables:

```bash
sudo BLENDER_CURRICULUM_REPO_DIR=/srv/blender-curriculum/repo \
  BLENDER_CURRICULUM_WEB_ROOT=/var/www/blender-curriculum \
  BLENDER_CURRICULUM_CONTENT_ROOT=/srv/blender-curriculum-content \
  BLENDER_CURRICULUM_ENV_FILE=/etc/blender-curriculum/deploy.env \
  /srv/blender-curriculum/repo/ops/install-server.sh
```

You can also run it interactively (the script prompts for missing values):

```bash
sudo /srv/blender-curriculum/repo/ops/install-server.sh
```

If the configured env file already exists, its current values are offered as
prompt defaults and can be accepted with Enter.
If `BLENDER_CURRICULUM_*` variables are already set in the shell, they take
priority as prompt defaults.

After installation:

```bash
set -a
source /etc/blender-curriculum/deploy.env
set +a
/srv/blender-curriculum/repo/ops/deploy-pull.sh
cd /srv/blender-curriculum/repo
npm run admin:users -- set /etc/blender-curriculum/admin-users.txt admin
```

`ops/install-server.sh` also creates `$REPO_DIR/.envrc` by default
(`BLENDER_CURRICULUM_SETUP_DIRENV=true`) so `direnv` can auto-load
`BLENDER_CURRICULUM_*` variables when you enter the repository.

If installed as root, finalize services:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blender-curriculum-admin.service
```

Include the generated Nginx snippet inside your `server {}` block:

```nginx
include /etc/nginx/snippets/blender-curriculum-admin.conf;
```

Then validate and reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Environment Variables (Prefixed)

Use prefixed names to avoid collisions with other software.

Core deployment variables:

- `BLENDER_CURRICULUM_REPO_DIR`
- `BLENDER_CURRICULUM_WEB_ROOT`
- `BLENDER_CURRICULUM_BRANCH`
- `BLENDER_CURRICULUM_THEME_ROOT`
- `BLENDER_CURRICULUM_CONTENT_ROOT`

Optional deployment variables:

- `BLENDER_CURRICULUM_ADMIN_SERVICE`
- `BLENDER_CURRICULUM_ALLOW_DIRTY`
- `BLENDER_CURRICULUM_FORCE_DEPLOY`

Install-script specific variables:

- `BLENDER_CURRICULUM_ENV_FILE`
- `BLENDER_CURRICULUM_MIGRATE_CONTENT`
- `BLENDER_CURRICULUM_OVERWRITE_ENV`
- `BLENDER_CURRICULUM_INSTALL_DEPS`
- `BLENDER_CURRICULUM_SETUP_DIRENV`
- `BLENDER_CURRICULUM_ADMIN_USER`
- `BLENDER_CURRICULUM_ADMIN_GROUP`
- `BLENDER_CURRICULUM_ADMIN_HOST`
- `BLENDER_CURRICULUM_ADMIN_PORT`
- `BLENDER_CURRICULUM_SYSTEMD_UNIT_NAME`
- `BLENDER_CURRICULUM_NGINX_SNIPPET_NAME`

Admin runtime variables:

- `BLENDER_CURRICULUM_SCHEMA_ROOT`
- `BLENDER_CURRICULUM_ADMIN_USER_FILE`
- `BLENDER_CURRICULUM_SESSION_SECRET`
- `BLENDER_CURRICULUM_SESSION_COOKIE_NAME`
- `BLENDER_CURRICULUM_SESSION_COOKIE_SECURE`
- `BLENDER_CURRICULUM_SESSION_TTL_SECONDS`

`BLENDER_CURRICULUM_SESSION_SECRET` must be at least 32 characters long.

## Deployment Model

Production deployment is server-initiated via `ops/deploy-pull.sh`.

The script performs:

1. `git fetch` and fast-forward merge on the configured branch.
2. `npm ci`.
3. `npm run build` using configured theme/content roots.
4. `rsync` from `build/` to `BLENDER_CURRICULUM_WEB_ROOT`.
5. optional admin service restart.

No GitHub Action secrets are required for deployment.

Manual test run:

```bash
BLENDER_CURRICULUM_REPO_DIR=/srv/blender-curriculum/repo \
BLENDER_CURRICULUM_WEB_ROOT=/var/www/blender-curriculum \
BLENDER_CURRICULUM_BRANCH=main \
BLENDER_CURRICULUM_THEME_ROOT=/srv/blender-curriculum/repo/theme \
BLENDER_CURRICULUM_CONTENT_ROOT=/srv/blender-curriculum-content \
/srv/blender-curriculum/repo/ops/deploy-pull.sh
```

Example `.env` file (`/etc/blender-curriculum/deploy.env`):

```bash
BLENDER_CURRICULUM_REPO_DIR=/srv/blender-curriculum/repo
BLENDER_CURRICULUM_WEB_ROOT=/var/www/blender-curriculum
BLENDER_CURRICULUM_BRANCH=main
BLENDER_CURRICULUM_THEME_ROOT=/srv/blender-curriculum/repo/theme
BLENDER_CURRICULUM_CONTENT_ROOT=/srv/blender-curriculum-content
BLENDER_CURRICULUM_ADMIN_HOST=127.0.0.1
BLENDER_CURRICULUM_ADMIN_PORT=8787
BLENDER_CURRICULUM_ADMIN_USER_FILE=/etc/blender-curriculum/admin-users.txt
BLENDER_CURRICULUM_SESSION_SECRET=change-me-to-a-long-random-string
BLENDER_CURRICULUM_SESSION_COOKIE_SECURE=auto
# Optional:
# BLENDER_CURRICULUM_ADMIN_SERVICE=blender-curriculum-admin.service
# BLENDER_CURRICULUM_ALLOW_DIRTY=false
# BLENDER_CURRICULUM_FORCE_DEPLOY=false
```

Recommended permissions:

```bash
sudo chmod 600 /etc/blender-curriculum/deploy.env
```

## Admin Server (Production)

Do not use `npm run start:admin` on production servers.
Use the admin process only (`npm run admin`) behind an Nginx reverse proxy.

Suggested `systemd` unit:

```ini
# /etc/systemd/system/blender-curriculum-admin.service
[Unit]
Description=Blender Curriculum Admin Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=deploy
Group=deploy
WorkingDirectory=/srv/blender-curriculum/repo
EnvironmentFile=/etc/blender-curriculum/deploy.env
ExecStart=/usr/bin/env npm run admin
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Admin save behavior:

- writes Markdown into `content/` or `BLENDER_CURRICULUM_CONTENT_ROOT`
- runs `npm run build`
- if `BLENDER_CURRICULUM_WEB_ROOT` is set, syncs `build/` to web root via `rsync`
- writes `created_by`/`created_at` on create and keeps them on update
- writes `updated_by`/`updated_at` on every save
- redirects to the saved page after successful save + build (and sync, if enabled)

## Admin User File

Local admin logins are read from `BLENDER_CURRICULUM_ADMIN_USER_FILE`.
The file format is:

```txt
admin:$argon2id$...
editor:$argon2id$...
```

Rules:

- one user per line
- format: `username:hash`
- hashes must be `argon2id`
- blank lines and lines starting with `#` are ignored
- changes to the file are picked up on the next login attempt; no admin-server restart is required

Manage users with the included CLI:

```bash
cd /srv/blender-curriculum/repo
npm run admin:users -- set /etc/blender-curriculum/admin-users.txt admin
npm run admin:users -- set /etc/blender-curriculum/admin-users.txt editor
npm run admin:users -- list /etc/blender-curriculum/admin-users.txt
npm run admin:users -- delete /etc/blender-curriculum/admin-users.txt editor
```

The `set` command prompts for a password, hashes it with `argon2id`, and updates the file in place.

Recommended permissions:

```bash
sudo chown deploy:deploy /etc/blender-curriculum/admin-users.txt
sudo chmod 600 /etc/blender-curriculum/admin-users.txt
```

## Admin Schemas

Admin forms are defined via YAML schema files in:

- default: `admin/schemas/`
- optional override: `BLENDER_CURRICULUM_SCHEMA_ROOT`

Supported schema files use `.yml` or `.yaml`.
Example:

```yaml
id: lesson
label: Lesson
typeValue: Lesson
outputDir: lessons
viewBasePath: /lessons
fields:
  - name: track
    label: Track
    input: text
    required: true
  - name: title
    label: Titel
    input: text
    required: true
  - name: description
    label: Beschreibung
    input: textarea
    required: true
```

Notes:

- `fields` drive both form rendering and frontmatter generation.
- `title`, `track`, and `description` are required by the server.
- `slug` is optional and auto-generated from `title` if empty.
- `content` is written as Markdown body, all other fields go to frontmatter.
- use spaces (no tabs) and 2-space indentation in schema YAML files.

## Nginx Reverse Proxy

Nginx should proxy the complete `/admin/*` namespace to the Fastify admin server.
Authentication is handled by Fastify session endpoints:

- `POST /admin/login`
- `POST /admin/logout`
- `GET /admin/session`
- `GET|POST|DELETE /admin/api/*` (session-protected)

Example snippet:

```nginx
location = /admin {
  return 301 /admin/;
}

location /admin/ {
  proxy_pass http://127.0.0.1:8787/admin/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Why `build/` Is Kept As Staging

`build/` is intentionally used as a staging directory before syncing to `BLENDER_CURRICULUM_WEB_ROOT`.

This keeps deployment robust:

- incomplete/failed builds do not partially overwrite live files
- `rsync --delete` guarantees that removed pages/assets are also removed live
- build output and published output are easy to compare/debug

## Source Layout

- `theme/`: templates, navigation data, styles, structural pages.
- `content/`: editorial content (`lessons/`, `tasks/`, `topics/`).
- `admin/`: static admin frontend and schema definitions.
- `server/`: admin API server.
- `ops/`: build/deploy/install scripts.

## Development

- `npm run start`: static Eleventy preview workflow.
- `npm run admin`: admin server on local host/port.
- `npm run start:admin`: preview + admin together.
