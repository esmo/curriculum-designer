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
const SCHEMA_ROOT = path.resolve(
  process.env.BLENDER_CURRICULUM_SCHEMA_ROOT ||
    path.join(ROOT_DIR, "admin", "schemas")
);
const ADMIN_DIR = path.join(ROOT_DIR, "admin");
const NPM_BINARY = process.platform === "win32" ? "npm.cmd" : "npm";
const RSYNC_BINARY = "rsync";

const ADMIN_PORT = Number.parseInt(
  process.env.BLENDER_CURRICULUM_ADMIN_PORT || "8787",
  10
);
const ADMIN_HOST = process.env.BLENDER_CURRICULUM_ADMIN_HOST || "127.0.0.1";
const REQUIRE_PROXY_AUTH = process.env.BLENDER_CURRICULUM_REQUIRE_PROXY_AUTH === "true";
const ALLOWED_FIELD_INPUTS = new Set(["text", "textarea", "number", "tags", "select"]);

const app = Fastify({
  logger: true,
  trustProxy: true,
});

let buildQueue = Promise.resolve();
let entrySchemasByType = new Map();
let defaultEntryType = "";

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

function sanitizeEntryType(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function ensureValidSchemaField(field, fieldIndex, sourcePath) {
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    throw new Error(`Invalid field definition at index ${fieldIndex} in ${sourcePath}.`);
  }

  const name = sanitizeEntryType(field.name);
  if (!name) {
    throw new Error(`Invalid field name at index ${fieldIndex} in ${sourcePath}.`);
  }

  const label = sanitizeSingleLine(field.label);
  if (!label) {
    throw new Error(`Field "${name}" in ${sourcePath} requires a non-empty label.`);
  }

  const input = sanitizeEntryType(field.input || "text");
  if (!ALLOWED_FIELD_INPUTS.has(input)) {
    throw new Error(
      `Field "${name}" in ${sourcePath} uses unsupported input "${input}".`
    );
  }

  let options = undefined;
  if (input === "select") {
    if (!Array.isArray(field.options) || field.options.length === 0) {
      throw new Error(`Field "${name}" in ${sourcePath} must define select options.`);
    }

    options = field.options.map((option, optionIndex) => {
      const value =
        typeof option === "string"
          ? sanitizeSingleLine(option)
          : sanitizeSingleLine(option.value);
      const optionLabel =
        typeof option === "string"
          ? sanitizeSingleLine(option)
          : sanitizeSingleLine(option.label || option.value);

      if (!value || !optionLabel) {
        throw new Error(
          `Invalid select option ${optionIndex} for field "${name}" in ${sourcePath}.`
        );
      }

      return {
        value,
        label: optionLabel,
      };
    });
  }

  const width = sanitizeEntryType(field.width || "full");
  const normalizedWidth =
    width === "half" || width === "third" || width === "full" ? width : "full";

  return {
    name,
    label,
    input,
    required: field.required === true,
    placeholder: sanitizeSingleLine(field.placeholder || ""),
    hint: sanitizeSingleLine(field.hint || ""),
    width: normalizedWidth,
    rows:
      input === "textarea" && Number.isInteger(field.rows) && field.rows > 0
        ? field.rows
        : undefined,
    min:
      input === "number" && Number.isFinite(field.min)
        ? Number(field.min)
        : undefined,
    options,
  };
}

function parseYamlScalar(value) {
  const text = String(value || "").trim();
  if (text === "") {
    return "";
  }

  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith("'") && text.endsWith("'"))
  ) {
    const quote = text[0];
    const inner = text.slice(1, -1);
    if (quote === '"') {
      return inner
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
        .replace(/\\n/g, "\n");
    }
    return inner.replace(/''/g, "'");
  }

  if (text === "true") return true;
  if (text === "false") return false;
  if (text === "null" || text === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    return Number(text);
  }

  return text;
}

function parseYamlDocument(source, sourcePath) {
  const root = {};
  const stack = [{ type: "object", value: root, indent: -1, pendingKey: null }];
  const lines = source.split(/\r?\n/);

  for (const rawLine of lines) {
    if (!rawLine.trim() || rawLine.trim().startsWith("#")) {
      continue;
    }

    const leading = rawLine.match(/^ */)?.[0] ?? "";
    if (rawLine.startsWith("\t")) {
      throw new Error(`Tabs are not supported in YAML: ${sourcePath}`);
    }

    const indent = leading.length;
    if (indent % 2 !== 0) {
      throw new Error(
        `Invalid indentation in ${sourcePath}. Use multiples of 2 spaces.`
      );
    }

    const content = rawLine.slice(indent);

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    let frame = stack[stack.length - 1];
    if (frame.type === "object" && frame.pendingKey) {
      const key = frame.pendingKey;
      const child = content.startsWith("- ") ? [] : {};
      frame.value[key] = child;
      frame.pendingKey = null;
      frame = {
        type: Array.isArray(child) ? "array" : "object",
        value: child,
        indent: indent - 1,
        pendingKey: null,
      };
      stack.push(frame);
    }

    if (content.startsWith("- ")) {
      if (frame.type !== "array") {
        throw new Error(`Unexpected list item in ${sourcePath}: "${content}"`);
      }

      const item = content.slice(2).trim();
      if (!item) {
        const obj = {};
        frame.value.push(obj);
        stack.push({ type: "object", value: obj, indent, pendingKey: null });
        continue;
      }

      const colonIndex = item.indexOf(":");
      if (colonIndex > 0) {
        const key = item.slice(0, colonIndex).trim();
        const remainder = item.slice(colonIndex + 1).trim();
        const obj = {};
        frame.value.push(obj);
        const objFrame = { type: "object", value: obj, indent, pendingKey: null };
        stack.push(objFrame);
        if (remainder) {
          obj[key] = parseYamlScalar(remainder);
        } else {
          objFrame.pendingKey = key;
        }
        continue;
      }

      frame.value.push(parseYamlScalar(item));
      continue;
    }

    const colonIndex = content.indexOf(":");
    if (colonIndex <= 0 || frame.type !== "object") {
      throw new Error(`Invalid YAML line in ${sourcePath}: "${content}"`);
    }

    const key = content.slice(0, colonIndex).trim();
    const remainder = content.slice(colonIndex + 1).trim();
    if (remainder) {
      frame.value[key] = parseYamlScalar(remainder);
    } else {
      frame.pendingKey = key;
    }
  }

  for (const frame of stack) {
    if (frame.type === "object" && frame.pendingKey) {
      frame.value[frame.pendingKey] = {};
      frame.pendingKey = null;
    }
  }

  return root;
}

function parseSchemaYaml(yamlText, sourcePath) {
  const parsed = parseYamlDocument(yamlText, sourcePath);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Schema in ${sourcePath} must be a YAML object.`);
  }

  const id = sanitizeEntryType(parsed.id);
  const label = sanitizeSingleLine(parsed.label);
  const typeValue = sanitizeSingleLine(parsed.typeValue);
  const outputDir = sanitizeEntryType(parsed.outputDir);
  const viewBasePath = sanitizeSingleLine(parsed.viewBasePath);

  if (!id || !label || !typeValue || !outputDir) {
    throw new Error(
      `Schema in ${sourcePath} requires id, label, typeValue and outputDir.`
    );
  }

  if (!viewBasePath.startsWith("/")) {
    throw new Error(`Schema "${id}" in ${sourcePath} must use absolute viewBasePath.`);
  }

  if (!Array.isArray(parsed.fields) || parsed.fields.length === 0) {
    throw new Error(`Schema "${id}" in ${sourcePath} must define fields.`);
  }

  const fields = [];
  const names = new Set();
  for (const [fieldIndex, field] of parsed.fields.entries()) {
    const normalized = ensureValidSchemaField(field, fieldIndex, sourcePath);
    if (names.has(normalized.name)) {
      throw new Error(
        `Duplicate field "${normalized.name}" in schema "${id}" (${sourcePath}).`
      );
    }
    names.add(normalized.name);
    fields.push(normalized);
  }

  for (const requiredField of ["title", "track", "description"]) {
    if (!names.has(requiredField)) {
      throw new Error(
        `Schema "${id}" in ${sourcePath} must include "${requiredField}" field.`
      );
    }
  }

  return {
    id,
    label,
    typeValue,
    outputDir,
    viewBasePath,
    fields,
    dir: path.join(CONTENT_ROOT, outputDir),
  };
}

function publicSchema(schema) {
  return {
    id: schema.id,
    label: schema.label,
    fields: schema.fields,
  };
}

async function loadEntrySchemas() {
  const dirEntries = await fs.readdir(SCHEMA_ROOT, {
    withFileTypes: true,
  });

  const schemaEntries = dirEntries
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name.endsWith(".yml") || entry.name.endsWith(".yaml"))
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  if (schemaEntries.length === 0) {
    throw new Error(`No schema files found in ${SCHEMA_ROOT}.`);
  }

  const schemaMap = new Map();

  for (const entry of schemaEntries) {
    const schemaPath = path.join(SCHEMA_ROOT, entry.name);
    const yamlText = await fs.readFile(schemaPath, "utf8");
    const schema = parseSchemaYaml(yamlText, schemaPath);

    if (schemaMap.has(schema.id)) {
      throw new Error(
        `Duplicate schema id "${schema.id}" found in ${SCHEMA_ROOT}.`
      );
    }
    schemaMap.set(schema.id, schema);
  }

  entrySchemasByType = schemaMap;
  defaultEntryType = schemaMap.keys().next().value || "";
}

function parseFieldValue(field, rawValue) {
  if (field.input === "number") {
    const parsed = parseOptionalInteger(rawValue, field.name);
    if (field.required && parsed === null) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return parsed;
  }

  if (field.input === "tags") {
    const tags = normalizeTags(rawValue);
    if (field.required && tags.length === 0) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return tags;
  }

  if (field.name === "content") {
    const content = String(rawValue || "");
    if (field.required && content.trim().length === 0) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return content;
  }

  const value = sanitizeSingleLine(rawValue);
  if (field.required && !value) {
    throw new Error(`Field "${field.name}" is required.`);
  }

  if (field.input === "select" && Array.isArray(field.options) && value) {
    const allowedValues = new Set(field.options.map((option) => option.value));
    if (!allowedValues.has(value)) {
      throw new Error(`Field "${field.name}" has an invalid value.`);
    }
  }

  return value;
}

function normalizeBasePath(input) {
  const clean = String(input || "")
    .trim()
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
  return clean.startsWith("/") ? clean : `/${clean}`;
}

function buildViewUrl(viewBasePath, slug) {
  return `${normalizeBasePath(viewBasePath)}/${slug}/`;
}

function extractFrontmatterMetadata(markdown) {
  const result = {};
  const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return result;
  }

  const lines = match[1].split(/\r?\n/);
  for (const line of lines) {
    const entry = line.match(/^([A-Za-z0-9_]+)\s*:\s*(.*)$/);
    if (!entry) {
      continue;
    }

    const key = entry[1];
    if (key !== "created_by" && key !== "created_at") {
      continue;
    }

    const parsed = parseYamlScalar(entry[2]);
    result[key] = parsed === null || parsed === undefined ? "" : String(parsed);
  }

  return result;
}

function toMarkdownDocument(input) {
  const lines = ["---"];

  for (const field of input.schema.fields) {
    if (field.name === "slug" || field.name === "content") {
      continue;
    }

    const value = input.values[field.name];

    if (field.input === "tags") {
      if (Array.isArray(value) && value.length > 0) {
        lines.push(`tags: [${value.map((tag) => yamlString(tag)).join(", ")}]`);
      }
      continue;
    }

    if (field.input === "number") {
      lines.push(`${field.name}: ${value === null ? "" : value}`);
      continue;
    }

    lines.push(`${field.name}: ${yamlString(value)}`);
  }

  lines.push(`type: ${yamlString(input.schema.typeValue)}`);
  lines.push(`created_by: ${yamlString(input.createdBy)}`);
  lines.push(`created_at: ${yamlString(input.createdAt)}`);
  lines.push(`updated_by: ${yamlString(input.updatedBy)}`);
  lines.push(`updated_at: ${yamlString(input.updatedAt)}`);
  lines.push("---", "");

  const body = String(input.values.content || "").trimEnd();
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

app.get("/admin-api/schemas", { preHandler: requireProxyAuth }, async () => ({
  ok: true,
  defaultEntryType,
  schemas: Array.from(entrySchemasByType.values()).map(publicSchema),
}));

app.post(
  "/admin-api/entries",
  {
    preHandler: requireProxyAuth,
  },
  async (request, reply) => {
    try {
      const payload = request.body;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        reply.code(400).send({
          error: "Request body must be an object.",
        });
        return;
      }

      const entryType = sanitizeEntryType(payload.entryType);
      const schema = entrySchemasByType.get(entryType);
      if (!schema) {
        reply.code(400).send({
          error: `Unknown entryType "${entryType}".`,
        });
        return;
      }

      const fieldPayload = payload.fields;
      if (!fieldPayload || typeof fieldPayload !== "object" || Array.isArray(fieldPayload)) {
        reply.code(400).send({
          error: "fields must be an object.",
        });
        return;
      }

      const values = {};
      for (const field of schema.fields) {
        values[field.name] = parseFieldValue(field, fieldPayload[field.name]);
      }

      const title = sanitizeSingleLine(values.title);
      const track = sanitizeSingleLine(values.track);
      const description = sanitizeSingleLine(values.description);
      const slugCandidate = sanitizeSingleLine(values.slug) || title;
      const slug = normalizeSlug(slugCandidate);

      if (!title || !track || !description || !slug) {
        reply.code(400).send({
          error: "title, track, description and a valid slug are required by schema.",
        });
        return;
      }

      const filePath = path.resolve(schema.dir, `${slug}.md`);
      if (!filePath.startsWith(`${schema.dir}${path.sep}`)) {
        reply.code(400).send({
          error: "Invalid slug.",
        });
        return;
      }

      let fileExists = false;
      let existingMetadata = {};
      try {
        const existingContent = await fs.readFile(filePath, "utf8");
        fileExists = true;
        existingMetadata = extractFrontmatterMetadata(existingContent);
      } catch (error) {
        if (!error || error.code !== "ENOENT") {
          throw error;
        }
      }

      if (fileExists && !payload.overwrite) {
        reply.code(409).send({
          error: "A file with this slug already exists. Enable overwrite to replace it.",
          file: path.relative(ROOT_DIR, filePath),
        });
        return;
      }

      const updatedBy = sanitizeSingleLine(request.headers["x-remote-user"]) || "local-admin";
      const updatedAt = new Date().toISOString();
      const createdBy = fileExists
        ? sanitizeSingleLine(existingMetadata.created_by) || updatedBy
        : updatedBy;
      const createdAt = fileExists
        ? sanitizeSingleLine(existingMetadata.created_at) || updatedAt
        : updatedAt;

      values.slug = slug;
      const markdown = toMarkdownDocument({
        schema,
        values,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
      });

      await fs.mkdir(schema.dir, { recursive: true });
      await fs.writeFile(filePath, markdown, "utf8");

      const build = await enqueueBuild();
      const deployOk = build.ok && (build.sync ? build.sync.ok : true);
      const statusCode = deployOk ? 201 : 202;
      const viewUrl = buildViewUrl(schema.viewBasePath, slug);

      reply.code(statusCode).send({
        ok: true,
        file: path.relative(ROOT_DIR, filePath),
        build,
        deployOk,
        viewUrl,
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
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
    await loadEntrySchemas();

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
      schemaRoot: SCHEMA_ROOT,
      schemaCount: entrySchemasByType.size,
      defaultEntryType,
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
