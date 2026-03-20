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
  BLENDER_CURRICULUM_ENV_FILE=/etc/blender-curriculum/blender-curriculum.env \
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
The install script creates the external content directory structure but does not
copy repository example content into it.

After installation:

```bash
/srv/blender-curriculum/repo/ops/deploy-pull.sh
eval "$(/srv/blender-curriculum/repo/ops/deploy-pull.sh print-env)"
cd /srv/blender-curriculum/repo
npm run admin:users -- set admin
```

`ops/deploy-pull.sh` loads the runtime env file automatically before deploy.
`ops/deploy-pull.sh print-env` prints `export ...` lines for the currently resolved configuration, so `eval "$(...)"` refreshes the variables in the current shell after config changes.

If you explicitly want `direnv`, `ops/install-server.sh` can still create `$REPO_DIR/.envrc` when `BLENDER_CURRICULUM_SETUP_DIRENV=true`.

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

`BLENDER_CURRICULUM_ENV_FILE` points to the central runtime env file.
Default path: `/etc/blender-curriculum/blender-curriculum.env`

`ops/deploy-pull.sh` resolves the runtime env file in this order:

1. explicit `BLENDER_CURRICULUM_ENV_FILE`
2. `/etc/blender-curriculum/blender-curriculum.env`

`ops/deploy-pull.sh print-env` uses the same resolution order and prints shell
exports for the resolved configuration, so `eval "$(...)"` refreshes the
current terminal session after config changes.

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

- `BLENDER_CURRICULUM_ADMIN_USER_FILE`
- `BLENDER_CURRICULUM_SESSION_SECRET`
- `BLENDER_CURRICULUM_SESSION_COOKIE_NAME`
- `BLENDER_CURRICULUM_SESSION_COOKIE_SECURE`
- `BLENDER_CURRICULUM_SESSION_TTL_SECONDS`

`BLENDER_CURRICULUM_SESSION_SECRET` must be at least 32 characters long.

Session variable meanings:

- `BLENDER_CURRICULUM_ADMIN_USER_FILE`: absolute or relative path to the admin user file. The server resolves it to an absolute path and requires at least one valid user entry before startup.
- `BLENDER_CURRICULUM_SESSION_SECRET`: secret used to sign the session cookie. Required, minimum 32 characters.
- `BLENDER_CURRICULUM_SESSION_COOKIE_NAME`: cookie name for the admin browser session. Default: `bc_admin_session`.
- `BLENDER_CURRICULUM_SESSION_COOKIE_SECURE`: whether the session cookie should be sent only via HTTPS. Allowed values: `auto`, `true`, `false`. Recommended for production behind HTTPS reverse proxy: `auto`. Recommended for local HTTP development only: `false`.
- `BLENDER_CURRICULUM_SESSION_TTL_SECONDS`: session lifetime in seconds. Default: `43200` (12 hours).

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

Example runtime env file (`/etc/blender-curriculum/blender-curriculum.env`):

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
# Session optional:
# BLENDER_CURRICULUM_SESSION_COOKIE_NAME=bc_admin_session
# BLENDER_CURRICULUM_SESSION_TTL_SECONDS=43200
# Deployment optional:
# BLENDER_CURRICULUM_ADMIN_SERVICE=blender-curriculum-admin.service
# BLENDER_CURRICULUM_ALLOW_DIRTY=false
# BLENDER_CURRICULUM_FORCE_DEPLOY=false
```

Recommended permissions:

```bash
sudo chmod 600 /etc/blender-curriculum/blender-curriculum.env
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
EnvironmentFile=/etc/blender-curriculum/blender-curriculum.env
ExecStart=/usr/bin/env npm run admin
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Admin save behavior:

- writes Markdown into the configured content root
- production content should live in `BLENDER_CURRICULUM_CONTENT_ROOT`, outside the repository
- the repository `content/` directory is retained only as example/development content
- runs `npm run build`
- if `BLENDER_CURRICULUM_WEB_ROOT` is set, syncs `build/` to web root via `rsync`
- writes `created_by`/`created_at` on create and keeps them on update
- writes `updated_by`/`updated_at` on every save
- redirects to the saved page after successful save + build (and sync, if enabled)

## Admin User File

Local admin logins are read from `BLENDER_CURRICULUM_ADMIN_USER_FILE`.
The file is required for local admin login and must contain at least one valid user before the admin server can start.
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
- existing sessions stay valid until logout or expiry; deleting a user from the file prevents new logins but does not immediately invalidate an already active session

Manage users with the included CLI:

```bash
cd /srv/blender-curriculum/repo
npm run admin:users -- set admin
npm run admin:users -- set editor
npm run admin:users -- list
npm run admin:users -- delete editor
```

The `set` command prompts for a password, hashes it with `argon2id`, and updates the file in place.
If `BLENDER_CURRICULUM_ADMIN_USER_FILE` is not loaded in the current shell, you can still pass the file path explicitly:

```bash
npm run admin:users -- set /etc/blender-curriculum/admin-users.txt admin
```

Recommended permissions:

```bash
sudo chown deploy:deploy /etc/blender-curriculum/admin-users.txt
sudo chmod 600 /etc/blender-curriculum/admin-users.txt
```

## Admin Schemas

Admin forms are defined via YAML schema files in:

- default: `theme/admin/schemas/`
- resolved from `BLENDER_CURRICULUM_THEME_ROOT`

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
    label: Title
    input: text
    required: true
  - name: description
    label: Description
    input: textarea
    required: true
  - name: content
    label: Content
    input: markdown
    required: false
```

Notes:

- `fields` drive both form rendering and frontmatter generation.
- supported `input` values are `text`, `textarea`, `markdown`, `number`, `tags`, `select`, `section`
- `title`, `track`, and `description` are required by the server.
- `slug` is optional and auto-generated from `title` if empty.
- `content` is written as Markdown body, all other fields go to frontmatter
- `input: markdown` renders a TinyMDE-based Markdown editor with toolbar; preview is rendered by the admin server through the same `markdown-it` pipeline used for the site build
- `input: section` renders a non-persisted section heading inside the admin form and is not written to frontmatter
- `textarea` and `markdown` fields preserve line breaks when stored in frontmatter
- `list: true` on a `textarea` or `markdown` field stores one non-empty line per entry as a YAML list in frontmatter
- bundled default schemas include `lesson`, `task`, `topic`, and `resource`
- use spaces (no tabs) and 2-space indentation in schema YAML files.

The bundled `task` schema is currently structured for assignment authoring. It captures:

- base data such as title, author/instructor, version, module/topic area, and level
- required resource linkage via primary learning resources and learning-goal alignment
- task goal and concrete assignment brief
- time planning via planned total hours, optional buffer hours, and optional milestones
- deliverables and assessment criteria as structured Markdown blocks
- pass requirement, optional exclusion criteria, prerequisites, teaching implementation, and starter files/assets

The current form builder does not support repeatable nested groups. Fields such as deliverables and assessment criteria are therefore modeled as guided Markdown fields rather than as repeatable subforms.

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
- `content/`: example editorial content for local development (`lessons/`, `tasks/`, `topics/`, `resources/`).
- `admin/`: static admin frontend and schema definitions.
- `server/`: admin API server.
- `ops/`: build/deploy/install scripts.

Production content should live outside the repository in `BLENDER_CURRICULUM_CONTENT_ROOT`.

## Development

- `npm run start`: static Eleventy preview workflow.
- `npm run admin`: admin server on local host/port.
- `npm run start:admin`: preview + admin together.
