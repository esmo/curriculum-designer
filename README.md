# Blender Curriculum web pages

This is the source for my Blender Curriculum.

## Development

- `npm run start`: Static Eleventy preview (existing workflow).
- `npm run admin`: Runs the local Fastify admin server on `127.0.0.1:8787`.
- `npm run start:admin`: Runs static preview + admin server together.

## Admin entry form

The new admin UI is available at `/admin/` and writes Markdown files into:

- `src/lessons`
- `src/tasks`
- `src/topics`

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

## Deployment (pull model, server initiated)
Production deployment happens fully on the server via `ops/deploy-pull.sh`:

1. fetch latest `main`
2. fast-forward local repo
3. run `npm ci` and `npm run build`
4. sync `build/` to the web root via `rsync`
5. optionally restart an admin service

No GitHub repository secrets are required for deployment.

### One-time server setup

1. Clone this repo on the server (example: `/srv/blender-curriculum/repo`).
2. Configure read-only GitHub access for that server clone (deploy key or token).
3. Ensure the web root exists (example: `/var/www/blender-curriculum`) and is writable by the deploy user.
4. Install required tools on server: `git`, `node`, `npm`, `rsync`.
5. Make deploy script executable:

```bash
chmod +x /srv/blender-curriculum/repo/ops/deploy-pull.sh
```

6. Test once manually:

```bash
REPO_DIR=/srv/blender-curriculum/repo \
WEB_ROOT=/var/www/blender-curriculum \
BRANCH=main \
/srv/blender-curriculum/repo/ops/deploy-pull.sh
```

If your server repo is already on the latest commit and you still want to deploy (for initial sync), force a deploy:

```bash
REPO_DIR=/srv/blender-curriculum/repo \
WEB_ROOT=/var/www/blender-curriculum \
BRANCH=main \
FORCE_DEPLOY=true \
/srv/blender-curriculum/repo/ops/deploy-pull.sh
```

You can trigger deployment whenever you want by running `ops/deploy-pull.sh` directly (manually, webhook, or your preferred scheduler).
