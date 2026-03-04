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
