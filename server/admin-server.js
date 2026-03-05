"use strict";

const path = require("path");
const fs = require("node:fs/promises");
const { spawn } = require("node:child_process");
const Fastify = require("fastify");
const fastifyStatic = require("@fastify/static");

const ROOT_DIR = path.resolve(__dirname, "..");
const CONTENT_ROOT = path.resolve(
  process.env.BLENDER_CURRICULUM_CONTENT_ROOT || path.join(ROOT_DIR, "content")
);
const WEB_ROOT = process.env.BLENDER_CURRICULUM_WEB_ROOT
  ? path.resolve(process.env.BLENDER_CURRICULUM_WEB_ROOT)
  : "";
const ADMIN_DIR = path.join(ROOT_DIR, "admin");
const NPM_BINARY = process.platform === "win32" ? "npm.cmd" : "npm";
const RSYNC_BINARY = "rsync";

const ADMIN_PORT = Number.parseInt(
  process.env.BLENDER_CURRICULUM_ADMIN_PORT || "8787",
  10
);
const ADMIN_HOST = process.env.BLENDER_CURRICULUM_ADMIN_HOST || "127.0.0.1";
const REQUIRE_PROXY_AUTH = process.env.BLENDER_CURRICULUM_REQUIRE_PROXY_AUTH === "true";

const TYPE_CONFIG = {
  lesson: {
    dir: path.join(CONTENT_ROOT, "lessons"),
    typeValue: "Lesson",
  },
  task: {
    dir: path.join(CONTENT_ROOT, "tasks"),
    typeValue: "Task",
  },
  topic: {
    dir: path.join(CONTENT_ROOT, "topics"),
    typeValue: "Topic",
  },
};

const app = Fastify({
  logger: true,
  trustProxy: true,
});

let buildQueue = Promise.resolve();

function sanitizeSingleLine(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function yamlString(value) {
  const text = String(value ?? "");
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function normalizeSlug(rawSlug) {
  const slug = String(rawSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug;
}

function parseOptionalInteger(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const asString = String(value).trim();
  if (!/^-?\d+$/.test(asString)) {
    throw new Error(`Field "${fieldName}" must be an integer or empty.`);
  }

  const parsed = Number.parseInt(asString, 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Field "${fieldName}" must be an integer or empty.`);
  }
  if (parsed < 0) {
    throw new Error(`Field "${fieldName}" must be greater than or equal to 0.`);
  }

  return parsed;
}

function normalizeTags(rawTags) {
  if (Array.isArray(rawTags)) {
    return rawTags.map(sanitizeSingleLine).filter(Boolean);
  }

  return String(rawTags || "")
    .split(",")
    .map((tag) => sanitizeSingleLine(tag))
    .filter(Boolean);
}

function toMarkdownDocument(input) {
  const tags = normalizeTags(input.tags);
  const lines = [
    "---",
    `track: ${yamlString(input.track)}`,
    `type: ${yamlString(input.typeValue)}`,
    `title: ${yamlString(input.title)}`,
    `description: ${yamlString(input.description)}`,
    `stage: ${input.stage === null ? "" : input.stage}`,
    `level: ${input.level === null ? "" : input.level}`,
  ];

  if (tags.length > 0) {
    const tagList = tags.map((tag) => yamlString(tag)).join(", ");
    lines.push(`tags: [${tagList}]`);
  }

  lines.push("---", "");
  const body = String(input.content || "").trimEnd();
  return `${lines.join("\n")}\n${body}\n`;
}

function runBuild() {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn(NPM_BINARY, ["run", "build"], {
      cwd: ROOT_DIR,
      env: process.env,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        code: null,
        startedAt,
        endedAt: new Date().toISOString(),
        error: error.message,
      });
    });

    child.on("close", (code) => {
      const buildResult = {
        ok: code === 0,
        code,
        startedAt,
        endedAt: new Date().toISOString(),
        error: code === 0 ? null : stderr.trim() || `Build exited with code ${code}`,
      };

      if (!buildResult.ok) {
        resolve({
          ...buildResult,
          sync: {
            ok: false,
            skipped: true,
            code: null,
            startedAt: null,
            endedAt: null,
            error: "Build failed. Sync skipped.",
          },
        });
        return;
      }

      runSyncToWebRoot().then((syncResult) => {
        resolve({
          ...buildResult,
          sync: syncResult,
        });
      });
    });
  });
}

function runSyncToWebRoot() {
  return new Promise((resolve) => {
    if (!WEB_ROOT) {
      resolve({
        ok: true,
        skipped: true,
        code: null,
        startedAt: null,
        endedAt: null,
        error: null,
      });
      return;
    }

    const startedAt = new Date().toISOString();
    const child = spawn(RSYNC_BINARY, ["-az", "--delete", path.join(ROOT_DIR, "build/"), `${WEB_ROOT}/`], {
      cwd: ROOT_DIR,
      env: process.env,
    });

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({
        ok: false,
        skipped: false,
        code: null,
        startedAt,
        endedAt: new Date().toISOString(),
        error: error.message,
      });
    });

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        skipped: false,
        code,
        startedAt,
        endedAt: new Date().toISOString(),
        error: code === 0 ? null : stderr.trim() || `Sync exited with code ${code}`,
      });
    });
  });
}

function enqueueBuild() {
  buildQueue = buildQueue
    .then(() => runBuild())
    .catch((error) => ({
      ok: false,
      code: null,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      error: error.message,
    }));

  return buildQueue;
}

function requireProxyAuth(request, reply, done) {
  if (!REQUIRE_PROXY_AUTH) {
    done();
    return;
  }

  const remoteUser = request.headers["x-remote-user"];
  if (!remoteUser) {
    reply.code(401).send({
      error: "Unauthorized. Missing X-Remote-User header.",
    });
    return;
  }

  done();
}

app.register(fastifyStatic, {
  root: ADMIN_DIR,
  prefix: "/admin/",
  index: ["index.html"],
});

app.get("/admin", async (_, reply) => {
  reply.redirect("/admin/");
});

app.get("/admin-api/health", { preHandler: requireProxyAuth }, async () => ({
  ok: true,
}));

app.post(
  "/admin-api/entries",
  {
    preHandler: requireProxyAuth,
    schema: {
      body: {
        type: "object",
        required: ["entryType", "title", "track", "description"],
        additionalProperties: false,
        properties: {
          entryType: { type: "string" },
          slug: { type: "string" },
          title: { type: "string" },
          track: { type: "string" },
          description: { type: "string" },
          stage: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
          },
          level: {
            anyOf: [{ type: "string" }, { type: "number" }, { type: "null" }],
          },
          tags: {
            anyOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
          },
          content: { type: "string" },
          overwrite: { type: "boolean" },
        },
      },
    },
  },
  async (request, reply) => {
    try {
      const payload = request.body;
      const entryType = sanitizeSingleLine(payload.entryType).toLowerCase();
      const config = TYPE_CONFIG[entryType];

      if (!config) {
        reply.code(400).send({
          error: "entryType must be one of: lesson, task, topic.",
        });
        return;
      }

      const title = sanitizeSingleLine(payload.title);
      const track = sanitizeSingleLine(payload.track);
      const description = sanitizeSingleLine(payload.description);
      const stage = parseOptionalInteger(payload.stage, "stage");
      const level = parseOptionalInteger(payload.level, "level");
      const slugCandidate = sanitizeSingleLine(payload.slug) || title;
      const slug = normalizeSlug(slugCandidate);

      if (!title || !track || !description || !slug) {
        reply.code(400).send({
          error: "title, track, description and a valid slug are required.",
        });
        return;
      }

      const filePath = path.resolve(config.dir, `${slug}.md`);
      if (!filePath.startsWith(`${config.dir}${path.sep}`)) {
        reply.code(400).send({
          error: "Invalid slug.",
        });
        return;
      }

      const markdown = toMarkdownDocument({
        typeValue: config.typeValue,
        title,
        track,
        description,
        stage,
        level,
        tags: payload.tags,
        content: payload.content || "",
      });

      try {
        if (!payload.overwrite) {
          await fs.access(filePath);
          reply.code(409).send({
            error: "A file with this slug already exists. Enable overwrite to replace it.",
            file: path.relative(ROOT_DIR, filePath),
          });
          return;
        }
      } catch {
        // File does not exist, continue.
      }

      await fs.mkdir(config.dir, { recursive: true });
      await fs.writeFile(filePath, markdown, "utf8");

      const build = await enqueueBuild();
      const deployOk = build.ok && (build.sync ? build.sync.ok : true);
      const statusCode = deployOk ? 201 : 202;

      reply.code(statusCode).send({
        ok: true,
        file: path.relative(ROOT_DIR, filePath),
        build,
      });
    } catch (error) {
      reply.code(400).send({
        error: error.message,
      });
    }
  }
);

async function start() {
  try {
    await app.listen({
      host: ADMIN_HOST,
      port: ADMIN_PORT,
    });

    app.log.info({
      adminUrl: `http://${ADMIN_HOST}:${ADMIN_PORT}/admin/`,
      requireProxyAuth: REQUIRE_PROXY_AUTH,
      contentRoot: CONTENT_ROOT,
      webRoot: WEB_ROOT || null,
      syncToWebRoot: Boolean(WEB_ROOT),
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

start();
