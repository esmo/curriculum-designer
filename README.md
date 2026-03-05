# Blender Curriculum web pages

This is the source for my Blender Curriculum.

## Development

- `npm run start`: Static Eleventy preview (existing workflow).
- `npm run admin`: Runs the local Fastify admin server on `127.0.0.1:8787`.
- `npm run start:admin`: Runs static preview + admin server together.

## Source layout

- `theme/`: templates, navigation data, styles, and structural pages.
- `content/`: editorial content (`lessons/`, `tasks/`, `topics/`).

## Admin entry form

The new admin UI is available at `/admin/` and writes Markdown files into:

- default: `content/lessons`, `content/tasks`, `content/topics`
- with `CONTENT_ROOT` set: `$CONTENT_ROOT/lessons`, `$CONTENT_ROOT/tasks`, `$CONTENT_ROOT/topics`

Each save calls `npm run build` so `build/` stays up-to-date.

## Security model

The app is designed to be protected by Nginx Basic Auth in front of:

- `/admin/`
- `/admin-api/`

If you want to enforce that only proxied/authenticated requests can reach the API, start the admin server with:

```bash
REQUIRE_PROXY_AUTH=true npm run admin
```

This requires `X-Remote-User` to be set by Nginx.

## Run admin server in production

Do not use `npm run start:admin` on the server. That command is for local development.
For production, run only the admin API/UI process via `npm run admin`.

Recommended: run it as a `systemd` service.

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
Environment=REQUIRE_PROXY_AUTH=true
Environment=THEME_ROOT=/srv/blender-curriculum/repo/theme
Environment=CONTENT_ROOT=/srv/blender-curriculum-content
ExecStart=/usr/bin/env npm run admin
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now blender-curriculum-admin.service
sudo systemctl status blender-curriculum-admin.service
```

Logs:

```bash
sudo journalctl -u blender-curriculum-admin.service -f
```

## Example Nginx config

```nginx
  location /admin/ {
    auth_basic "Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:8787/admin/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Remote-User $remote_user;
  }

  location /admin-api/ {
    auth_basic "Admin";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://127.0.0.1:8787/admin-api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Remote-User $remote_user;
  }
```

## Create admin users (Basic Auth)

`auth_basic_user_file` points to `/etc/nginx/.htpasswd`.  
Create users with `htpasswd`:

```bash
# Debian/Ubuntu (if htpasswd is missing)
sudo apt-get install -y apache2-utils

# First user (creates the file)
sudo htpasswd -c /etc/nginx/.htpasswd admin

# Additional users (do NOT use -c, otherwise file is overwritten)
sudo htpasswd /etc/nginx/.htpasswd editor
```


## Deployment (pull model, server initiated)
Production deployment happens fully on the server via `ops/deploy-pull.sh`:

1. fetch latest `main`
2. fast-forward local repo
3. run `npm ci` and `npm run build` using `THEME_ROOT` + `CONTENT_ROOT`
4. sync `build/` to the web root via `rsync`
5. optionally restart an admin service

No GitHub repository secrets are required for deployment.

### One-time server setup

1. Clone this repo on the server (example: `/srv/blender-curriculum/repo`).
2. Configure read-only GitHub access for that server clone (deploy key or token).
3. Create separate content storage:

```bash
mkdir -p /srv/blender-curriculum-content/{lessons,tasks,topics}
```

4. Migrate existing content once (optional but recommended):

```bash
rsync -a /srv/blender-curriculum/repo/content/lessons/ /srv/blender-curriculum-content/lessons/
rsync -a /srv/blender-curriculum/repo/content/tasks/ /srv/blender-curriculum-content/tasks/
rsync -a /srv/blender-curriculum/repo/content/topics/ /srv/blender-curriculum-content/topics/
```

5. Ensure the web root exists (example: `/var/www/blender-curriculum`) and is writable by the deploy user.
6. Install required tools on server: `git`, `node`, `npm`, `rsync`.
7. Make deploy script executable:

```bash
chmod +x /srv/blender-curriculum/repo/ops/deploy-pull.sh
```

8. Test once manually:

```bash
REPO_DIR=/srv/blender-curriculum/repo \
WEB_ROOT=/var/www/blender-curriculum \
BRANCH=main \
THEME_ROOT=/srv/blender-curriculum/repo/theme \
CONTENT_ROOT=/srv/blender-curriculum-content \
/srv/blender-curriculum/repo/ops/deploy-pull.sh
```

You can trigger deployment whenever you want by running `ops/deploy-pull.sh` directly (manually, webhook, or your preferred scheduler).

If you keep content inside the repo (without `CONTENT_ROOT`) and need to deploy uncommitted local content, you can still use:

```bash
ALLOW_DIRTY=true FORCE_DEPLOY=true /srv/blender-curriculum/repo/ops/deploy-pull.sh
```
