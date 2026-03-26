# Curriculum Designer

Eleventy site plus a small Fastify-based admin server.

The repository is installed only once. Each website runs as its own named instance with:

- its own root path
- its own theme
- its own content
- its own build output
- its own published web directory
- its own admin user file

Instances are resolved by name through a central registry file.

## Quick Start

Prerequisites on the server:

- `git`
- `rsync`
- `node`
- `npm`
- `nginx`
- `systemd`

1. Clone the repository, for example to `/srv/curriculum-designer/repo`.
2. Configure read access for `git pull` on that server clone.
3. Create one instance with an explicit root path.

```bash
cd /srv/curriculum-designer/repo
sudo npm run instance:create -- site-a /srv/customer-a/curriculum-designer --server-name site-a.example.org --ssl-certificate /etc/letsencrypt/live/site-a.example.org/fullchain.pem --ssl-certificate-key /etc/letsencrypt/live/site-a.example.org/privkey.pem --admin-port 8787
```

The create command:

- creates the central registry file `/etc/curriculum-designer/instances.json` if missing
- registers `site-a` with its explicit root path
- creates `/etc/curriculum-designer/instances/site-a.env`
- creates the systemd unit `curriculum-designer-admin-site-a.service`
- creates the Nginx site file `/etc/nginx/sites-available/curriculum-designer-site-a.conf`
- creates the instance directory structure at the exact root you passed
- copies the bundled theme into `<root>/theme` if that directory is still empty
- creates `<root>/content` only when you use the default local content path
- prompts for the password of the initial admin user `admin`

Deploy the instance:

```bash
cd /srv/curriculum-designer/repo
npm run deploy -- site-a
```

Install the service integration:

```bash
cd /srv/curriculum-designer/repo
sudo npm run instance:install -- site-a
```

## npm Interface

Primary commands:

- `sudo npm run instance:create -- <name> <root> --server-name <name> [--content-root <path>] [--ssl-certificate <file>] [--ssl-certificate-key <file>] [--admin-port <port>] [--admin-user <username>]`
- `sudo npm run instance:install -- <name>`
- `sudo npm run instance:delete -- <name>`
- `npm run instance:list`
- `npm run instance:resolve -- <name>`
- `npm run deploy -- <name>`
- `npm run admin:users -- list <instance-name>`
- `npm run admin:users -- set <instance-name> <username>`
- `npm run admin:users -- delete <instance-name> <username>`

What they do:

- `instance:create` creates the instance layout, registry entry, env file, systemd unit, Nginx site file, and the initial admin user.
- `instance:install` enables the generated Nginx site, starts the systemd unit, then validates and reloads Nginx.
- `instance:delete` removes the registry entry and the generated system files for one instance.
- `instance:list` lists all registered instances.
- `instance:resolve` shows the resolved paths and port of one instance.
- `deploy` builds and publishes one instance by name.
- `admin:users` manages admin logins by instance name instead of by environment variable.

Commands that modify `/etc`, `systemd`, or `nginx` must be run with `sudo`.
For HTTPS pass both `--ssl-certificate` and `--ssl-certificate-key`. If both are omitted, the generated site is HTTP-only.
If `--content-root` is omitted, the default content path is `<root>/content`.

## Registry

The central registry file is:

```txt
/etc/curriculum-designer/instances.json
```

Example:

```json
{
  "instances": {
    "site-a": {
      "root": "/srv/customer-a/curriculum-designer",
      "contentRoot": "/srv/customer-a/content-repo/content",
      "adminPort": 8787,
      "serverName": "site-a.example.org",
      "sslCertificate": "/etc/letsencrypt/live/site-a.example.org/fullchain.pem",
      "sslCertificateKey": "/etc/letsencrypt/live/site-a.example.org/privkey.pem"
    },
    "site-b": {
      "root": "/var/www/customer-b/curriculum-designer",
      "adminPort": 8788,
      "serverName": "site-b.example.org www.site-b.example.org",
      "sslCertificate": "/etc/letsencrypt/live/site-b.example.org/fullchain.pem",
      "sslCertificateKey": "/etc/letsencrypt/live/site-b.example.org/privkey.pem"
    }
  }
}
```

Important points:

- the instance name is the primary key
- each instance can use any root path
- `contentRoot` can point to an external repository checkout
- instances do not need to live under one shared `instancesRoot`
- the registry stores non-secret operational data only
- `serverName` defines the public host names of the generated Nginx site
- `sslCertificate` and `sslCertificateKey` enable HTTPS in the generated Nginx site

List registered instances:

```bash
cd /srv/curriculum-designer/repo
npm run instance:list
```

Resolve one instance:

```bash
cd /srv/curriculum-designer/repo
npm run instance:resolve -- site-a
```

## Runtime Config

Runtime uses two layers:

1. the registry file for `root`, `contentRoot`, `adminPort`, `serverName`, and optional TLS file paths
2. one small env file per instance for secrets

Per-instance env files live here:

```txt
/etc/curriculum-designer/instances/<name>.env
```

Example:

```bash
INSTANCE_NAME=site-a
INSTANCE_REGISTRY_FILE=/etc/curriculum-designer/instances.json
SESSION_SECRET=replace-this-with-a-long-random-secret
```

What is fixed on purpose:

- Git branch: `main`
- admin URL path: `/admin`
- admin bind host: `127.0.0.1`
- session cookie name and TTL

## Instance Layout

By default the main instance layout looks like this:

```txt
<instance-root>/
├── admin/              # built admin frontend served by Fastify
├── admin-users.txt     # local admin users
├── build/              # Eleventy build output
├── content/            # default content root
├── theme/              # templates, assets, admin schemas
└── web/                # published static site for Nginx
```

If you pass `--content-root`, the Markdown files may live outside the instance root entirely.
Only the default local `content/` path is created automatically.

Theme-specific subdirectories are derived from the schemas and are created on demand when entries are saved.
The bundled default theme typically uses `lessons`, `tasks`, `topics`, and `resources` below the configured content root.

Example with an external content repository:

```bash
cd /srv/curriculum-designer/repo
sudo npm run instance:create -- site-a /srv/customer-a/curriculum-designer --content-root /srv/customer-a/content-repo/content --server-name site-a.example.org --ssl-certificate /etc/letsencrypt/live/site-a.example.org/fullchain.pem --ssl-certificate-key /etc/letsencrypt/live/site-a.example.org/privkey.pem --admin-port 8787
```

In that setup:

- the application still lives in `/srv/curriculum-designer/repo`
- the instance runtime lives in `/srv/customer-a/curriculum-designer`
- the Markdown files come from `/srv/customer-a/content-repo/content`

## Daily Operations

Deploy one instance by name:

```bash
cd /srv/curriculum-designer/repo
npm run deploy -- site-a
```

The deploy script always:

1. resolves the instance root and admin port from the registry
2. updates the shared repository to `origin/main`
3. runs `npm ci`
4. runs `npm run build` for that named instance
5. syncs the instance build output to the registered web directory
6. restarts `curriculum-designer-admin-<instance>.service` if that unit exists

Manage admin users by instance name:

```bash
cd /srv/curriculum-designer/repo
npm run admin:users -- set site-a admin
npm run admin:users -- list site-a
npm run admin:users -- delete site-a admin
```

Delete one instance by name:

```bash
cd /srv/curriculum-designer/repo
sudo npm run instance:delete -- site-a
```

This removes:

- the registry entry in `/etc/curriculum-designer/instances.json`
- `/etc/curriculum-designer/instances/site-a.env`
- `/etc/systemd/system/curriculum-designer-admin-site-a.service`
- `/etc/nginx/sites-available/curriculum-designer-site-a.conf`
- `/etc/nginx/sites-enabled/curriculum-designer-site-a.conf`
- `<instance-root>/admin-users.txt`

The instance root itself stays in place.
An external `contentRoot` also stays in place.

## Multiple Instances

Recommended production model:

- one shared repository
- one shared `node_modules`
- one registry file for all instance definitions
- one secret env file per instance
- one systemd unit per instance
- one virtual host per instance

Example:

```txt
/srv/curriculum-designer/repo
/etc/curriculum-designer/instances.json
/etc/curriculum-designer/instances/site-a.env
/etc/curriculum-designer/instances/site-b.env
/srv/customer-a/curriculum-designer
/var/www/customer-b/curriculum-designer
```

The only per-instance values that normally differ are:

- registry `root`
- registry `contentRoot` when content comes from a different checkout
- registry `adminPort`
- `SESSION_SECRET`

Separate domains or subdomains are recommended. The admin path is always `/admin`.

## Admin User File

Local admin logins are stored in:

```txt
<instance-root>/admin-users.txt
```

Format:

```txt
admin:$argon2id$...
editor:$argon2id$...
```

Rules:

- one user per line
- format: `username:hash`
- hashes must be `argon2id`
- blank lines and lines starting with `#` are ignored
- the admin server requires at least one valid user before it can start

## Admin Schemas

Admin schemas live inside the instance theme:

```txt
<instance-root>/theme/admin/schemas/
```

Supported files use `.yml` or `.yaml`.

The bundled default schemas are:

- `lesson`
- `task`
- `topic`
- `resource`

Supported field inputs:

- `text`
- `textarea`
- `markdown`
- `number`
- `tags`
- `select`
- `section`

## Nginx

The generated site file is:

- `/etc/nginx/sites-available/curriculum-designer-<instance>.conf`

When installed, the CLI also creates:

- `/etc/nginx/sites-enabled/curriculum-designer-<instance>.conf`

The generated site contains:

- `root <instance-root>/web`
- `index index.html`
- redirect from `/admin` to `/admin/`
- reverse proxy from `/admin/` to `127.0.0.1:<adminPort>`
- `server_name <serverName>`
- HTTP-to-HTTPS redirect if `sslCertificate` and `sslCertificateKey` are configured
- `listen 443 ssl` with the configured certificate files if TLS is configured

HTTPS example:

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name site-a.example.org;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  listen [::]:443 ssl;
  server_name site-a.example.org;

  ssl_certificate /etc/letsencrypt/live/site-a.example.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/site-a.example.org/privkey.pem;

  root /srv/customer-a/curriculum-designer/web;
  index index.html;

  location = /admin {
    return 301 /admin/;
  }

  location /admin/ {
    proxy_pass http://127.0.0.1:8787/admin/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

`npm run instance:install -- <instance>` creates the symlink in `sites-enabled`, validates the Nginx config, and reloads Nginx.

## Development

There is no implicit default instance.
Build and admin-start commands require `INSTANCE_NAME`.

- `npm run build`
- `npm run admin`
- `npm run start`
- `npm run start:admin`

For local work on a named registered instance:

```bash
INSTANCE_NAME=site-a npm run build
INSTANCE_NAME=site-a npm run admin
```

If you do not want to use the global registry path during development, point `INSTANCE_REGISTRY_FILE` to a different registry file.
