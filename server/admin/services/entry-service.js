"use strict";

const path = require("path");
const fs = require("node:fs/promises");

const { httpError } = require("../lib/http-error");
const {
  buildListUrl,
  buildViewUrl,
  extractFrontmatterMetadata,
  frontmatterFieldValueForForm,
  normalizeSlug,
  parseFieldValue,
  parseMarkdownDocument,
  sanitizeEntryType,
  sanitizeSingleLine,
  toMarkdownDocument,
} = require("../lib/content-utils");

function createEntryService(input) {
  const {
    rootDir,
    schemaService,
    enqueueBuild,
  } = input;

  function resolveEntryFilePath(schema, slug) {
    const filePath = path.resolve(schema.dir, `${slug}.md`);
    if (!filePath.startsWith(`${schema.dir}${path.sep}`)) {
      throw httpError(400, "Invalid slug.");
    }

    return filePath;
  }

  function requireSchema(entryTypeRaw) {
    const entryType = sanitizeEntryType(entryTypeRaw);
    const schema = schemaService.getSchema(entryType);
    if (!schema) {
      throw httpError(400, `Unknown entryType "${entryType}".`);
    }

    return {
      entryType,
      schema,
    };
  }

  function requireSlug(slugRaw) {
    const slug = normalizeSlug(slugRaw);
    if (!slug) {
      throw httpError(400, "A valid slug is required.");
    }

    return slug;
  }

  async function readEntry(params) {
    const { schema } = requireSchema(params.entryType);
    const slug = requireSlug(params.slug);
    const filePath = resolveEntryFilePath(schema, slug);

    let markdown = "";
    try {
      markdown = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw httpError(404, "Entry not found.");
      }
      throw error;
    }

    const parsed = parseMarkdownDocument(markdown, filePath);
    const fields = {};
    for (const field of schema.fields) {
      if (field.input === "section") {
        continue;
      }

      fields[field.name] = frontmatterFieldValueForForm(
        field,
        parsed.frontmatter,
        parsed.body
      );
    }

    return {
      ok: true,
      entryType: schema.id,
      slug,
      fields,
      file: path.relative(rootDir, filePath),
      viewUrl: buildViewUrl(schema.viewBasePath, slug),
      metadata: {
        createdBy: sanitizeSingleLine(parsed.frontmatter.created_by),
        createdAt: sanitizeSingleLine(parsed.frontmatter.created_at),
        updatedBy: sanitizeSingleLine(parsed.frontmatter.updated_by),
        updatedAt: sanitizeSingleLine(parsed.frontmatter.updated_at),
      },
    };
  }

  async function saveEntry(payload, remoteUser) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw httpError(400, "Request body must be an object.");
    }

    const { schema } = requireSchema(payload.entryType);

    const fieldPayload = payload.fields;
    if (!fieldPayload || typeof fieldPayload !== "object" || Array.isArray(fieldPayload)) {
      throw httpError(400, "fields must be an object.");
    }

    const values = {};
    for (const field of schema.fields) {
      if (field.input === "section") {
        continue;
      }

      values[field.name] = parseFieldValue(field, fieldPayload[field.name]);
    }

    const title = sanitizeSingleLine(values.title);
    const track = sanitizeSingleLine(values.track);
    const description = sanitizeSingleLine(values.description);
    const slugCandidate = sanitizeSingleLine(values.slug) || title;
    const slug = normalizeSlug(slugCandidate);

    if (!title || !track || !description || !slug) {
      throw httpError(400, "title, track, description and a valid slug are required by schema.");
    }

    const filePath = resolveEntryFilePath(schema, slug);

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
      throw httpError(
        409,
        "A file with this slug already exists. Enable overwrite to replace it.",
        {
          file: path.relative(rootDir, filePath),
        }
      );
    }

    const updatedBy = sanitizeSingleLine(remoteUser) || "local-admin";
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

    return {
      statusCode,
      body: {
        ok: true,
        file: path.relative(rootDir, filePath),
        build,
        deployOk,
        viewUrl: buildViewUrl(schema.viewBasePath, slug),
        createdBy,
        createdAt,
        updatedBy,
        updatedAt,
      },
    };
  }

  async function deleteEntry(params) {
    const { schema } = requireSchema(params.entryType);
    const slug = requireSlug(params.slug);
    const filePath = resolveEntryFilePath(schema, slug);

    try {
      await fs.unlink(filePath);
    } catch (error) {
      if (error && error.code === "ENOENT") {
        throw httpError(404, "Entry not found.");
      }
      throw error;
    }

    const build = await enqueueBuild();
    const deployOk = build.ok && (build.sync ? build.sync.ok : true);
    const statusCode = deployOk ? 200 : 202;

    return {
      statusCode,
      body: {
        ok: true,
        file: path.relative(rootDir, filePath),
        build,
        deployOk,
        listUrl: buildListUrl(schema.viewBasePath),
      },
    };
  }

  return {
    deleteEntry,
    readEntry,
    saveEntry,
  };
}

module.exports = {
  createEntryService,
};
