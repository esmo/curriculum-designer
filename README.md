# Curriculum Designer

Eleventy site plus a small Fastify-based admin server.

The repository is installed only once. Each website runs as its own named instance with:

- its own root path
- its own theme
- its own content
- its own build output
- its own published web directory
- its own admin user file

Production instances are resolved by name through a central registry file.

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
sudo /srv/curriculum-designer/repo/ops/install-server.sh \
  site-a \
  /srv/customer-a/curriculum-designer \
  --admin-port 8787
```

`ops/install-server.sh` is a thin wrapper around:

```bash
sudo /srv/curriculum-designer/repo/ops/instances.js create \
  site-a \
  /srv/customer-a/curriculum-designer \
  --admin-port 8787
```

The create command:

- creates the central registry file `/etc/curriculum-designer/instances.json` if missing
- registers `site-a` with its explicit root path
- creates `/etc/curriculum-designer/instances/site-a.env`
- creates the systemd unit `curriculum-designer-admin-site-a.service`
- creates the Nginx snippet `/etc/nginx/snippets/curriculum-designer-site-a.conf`
- creates the instance directory structure at the exact root you passed
- copies the bundled theme into `<root>/theme` if that directory is still empty

Then create the first admin user:

```bash
cd /srv/curriculum-designer/repo
INSTANCE_NAME=site-a npm run admin:users -- set admin
```

Enable the admin service:

```bash
sudo systemctl enable --now curriculum-designer-admin-site-a.service
```

Include the generated Nginx snippet inside the correct `server {}` block:

```nginx
include /etc/nginx/snippets/curriculum-designer-site-a.conf;
```

Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Deploy the instance:

```bash
/srv/curriculum-designer/repo/ops/deploy-pull.sh site-a
```

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
      "adminPort": 8787
    },
    "site-b": {
      "root": "/var/www/customer-b/curriculum-designer",
      "adminPort": 8788
    }
  }
}
```

Important points:

- the instance name is the primary key
- each instance can use any root path
- instances do not need to live under one shared `instancesRoot`
- the registry stores non-secret operational data only

List registered instances:

```bash
cd /srv/curriculum-designer/repo
npm run instances -- list
```

Resolve one instance:

```bash
cd /srv/curriculum-designer/repo
npm run instances -- resolve site-a
```

## Runtime Config

Production runtime now uses two layers:

1. the registry file for `root` and `adminPort`
2. one small env file per instance for secrets

Per-instance env files live here:

```txt
/etc/curriculum-designer/instances/<name>.env
```

Example:

```bash
INSTANCE_NAME=site-a
SESSION_SECRET=replace-this-with-a-long-random-secret
```

What is fixed on purpose:

- Git branch: `main`
- admin URL path: `/admin`
- admin bind host: `127.0.0.1`
- session cookie name and TTL

`INSTANCE_ROOT` still exists as a direct fallback for local development and one-off builds, but named instances should use the registry.

## Instance Layout

Everything below is derived from the registered root path of one instance:

```txt
<instance-root>/
├── admin/              # built admin frontend served by Fastify
├── admin-users.txt     # local admin users
├── build/              # Eleventy build output
├── content/            # content files grouped by schema outputDir
├── theme/              # templates, assets, admin schemas
└── web/                # published static site for Nginx
```

Only `content/` itself is created automatically.

Theme-specific subdirectories are derived from the schemas and are created on demand when entries are saved.
The bundled default theme typically uses `content/lessons`, `content/tasks`, `content/topics`, and `content/resources`.

## Daily Operations

Deploy one instance by name:

```bash
/srv/curriculum-designer/repo/ops/deploy-pull.sh site-a
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
INSTANCE_NAME=site-a npm run admin:users -- set admin
INSTANCE_NAME=site-a npm run admin:users -- list
INSTANCE_NAME=site-a npm run admin:users -- delete admin
```

You can still pass a file path explicitly:

```bash
npm run admin:users -- set /srv/customer-a/curriculum-designer/admin-users.txt admin
```

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

The generated snippet already contains:

- `root <instance-root>/web`
- redirect from `/admin` to `/admin/`
- reverse proxy from `/admin/` to `127.0.0.1:<adminPort>`

You only need to include that snippet in the right `server {}` block.

## Development

Without `INSTANCE_NAME` or `INSTANCE_ROOT`, local commands use the repository root as the default instance.

- `npm run build`
- `npm run admin`
- `npm run start`
- `npm run start:admin`

For local work on a named registered instance:

```bash
INSTANCE_NAME=site-a npm run build
INSTANCE_NAME=site-a npm run admin
```

For one-off local work without registry:

```bash
INSTANCE_ROOT=/path/to/instance npm run build
INSTANCE_ROOT=/path/to/instance npm run admin
```

The repository `theme/` and `content/` directories are therefore local defaults. Production instances should use named registry entries with their own root paths.
