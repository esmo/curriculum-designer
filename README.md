# Curriculum Designer

Eleventy site plus a small Fastify-based admin server.

The repository is installed only once. Each website runs as its own instance with:

- its own theme
- its own content
- its own build output
- its own published web directory
- its own admin user file

An instance is defined by one directory: `INSTANCE_ROOT`.

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
3. Run the install script for one instance.

```bash
sudo /srv/curriculum-designer/repo/ops/install-server.sh site-a
```

The install script:

- creates `/srv/curriculum-designer/instances/site-a` by default
- copies the bundled theme into `site-a/theme` if that directory is still empty
- creates the env file `/etc/curriculum-designer/site-a.env`
- creates the systemd unit `curriculum-designer-admin-site-a.service`
- creates the Nginx snippet `/etc/nginx/snippets/curriculum-designer-site-a.conf`
- creates the admin user file `site-a/admin-users.txt`

Then create the first admin user:

```bash
cd /srv/curriculum-designer/repo
INSTANCE_ROOT=/srv/curriculum-designer/instances/site-a npm run admin:users -- set admin
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

## Configuration

Only three environment variables are used.

| Variable | Required | Meaning |
| --- | --- | --- |
| `INSTANCE_ROOT` | yes | Root directory of one site instance. All other paths are derived from it. |
| `SESSION_SECRET` | yes | Secret for the admin session cookie. Minimum length: 32 characters. The install script generates one automatically. |
| `ADMIN_PORT` | no | Local TCP port for the admin server. Default: `8787`. Each instance on the same server needs its own port. |

Typical env file:

```bash
INSTANCE_ROOT=/srv/curriculum-designer/instances/site-a
SESSION_SECRET=replace-this-with-a-long-random-secret
ADMIN_PORT=8787
```

What is fixed on purpose:

- Git branch: `main`
- admin URL path: `/admin`
- admin bind host: `127.0.0.1`
- session cookie name and TTL

## Instance Layout

Everything below is derived from `INSTANCE_ROOT`:

```txt
INSTANCE_ROOT/
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

Deploy one instance:

```bash
/srv/curriculum-designer/repo/ops/deploy-pull.sh site-a
```

The deploy script always:

1. updates the shared repository to `origin/main`
2. runs `npm ci`
3. runs `npm run build` with the configured `INSTANCE_ROOT`
4. syncs `INSTANCE_ROOT/build/` to `INSTANCE_ROOT/web/`
5. restarts `curriculum-designer-admin-<instance>.service` if that unit exists

Manage admin users:

```bash
cd /srv/curriculum-designer/repo
INSTANCE_ROOT=/srv/curriculum-designer/instances/site-a npm run admin:users -- set admin
INSTANCE_ROOT=/srv/curriculum-designer/instances/site-a npm run admin:users -- list
INSTANCE_ROOT=/srv/curriculum-designer/instances/site-a npm run admin:users -- delete admin
```

You can also pass a file path explicitly:

```bash
npm run admin:users -- set /srv/curriculum-designer/instances/site-a/admin-users.txt admin
```

## Multiple Instances

Recommended production model:

- one shared repository
- one shared `node_modules`
- one instance directory per site
- one env file per instance
- one systemd unit per instance
- one virtual host per instance

Example:

```txt
/srv/curriculum-designer/repo
/srv/curriculum-designer/instances/site-a
/srv/curriculum-designer/instances/site-b
/etc/curriculum-designer/site-a.env
/etc/curriculum-designer/site-b.env
```

The only values that usually differ per instance are:

- `INSTANCE_ROOT`
- `SESSION_SECRET`
- `ADMIN_PORT`

Separate domains or subdomains are recommended. The admin path is always `/admin`.

## Admin User File

Local admin logins are stored in `INSTANCE_ROOT/admin-users.txt`.

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
INSTANCE_ROOT/theme/admin/schemas/
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

- `root INSTANCE_ROOT/web`
- redirect from `/admin` to `/admin/`
- reverse proxy from `/admin/` to `127.0.0.1:ADMIN_PORT`

You only need to include that snippet in the right `server {}` block.

## Development

Without `INSTANCE_ROOT`, local commands use the repository root as the default instance.

- `npm run build`
- `npm run admin`
- `npm run start`
- `npm run start:admin`

For local work on a separate instance directory:

```bash
INSTANCE_ROOT=/path/to/instance npm run build
INSTANCE_ROOT=/path/to/instance npm run admin
```

The repository `theme/` and `content/` directories are therefore local defaults. Production instances should use their own `INSTANCE_ROOT` outside the repository.
