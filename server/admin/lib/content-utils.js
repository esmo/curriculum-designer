"use strict";

function sanitizeSingleLine(value) {
  return String(value || "")
    .replace(/\r?\n/g, " ")
    .trim();
}

function sanitizeMultiLine(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function yamlString(value) {
  const text = String(value ?? "");
  return `"${text
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, "\\n")}"`;
}

function normalizeSlug(rawSlug) {
  const slug = String(rawSlug || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

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

function normalizeLineList(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => sanitizeSingleLine(item)).filter(Boolean);
  }

  return String(rawValue || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((item) => sanitizeSingleLine(item))
    .filter(Boolean);
}

function sanitizeEntryType(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseYamlInlineArray(text) {
  const inner = text.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const parts = [];
  let token = "";
  let quote = "";
  let escaped = false;

  for (const char of inner) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      token += char;
      escaped = true;
      continue;
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      token += char;
      continue;
    }

    if (char === quote) {
      quote = "";
      token += char;
      continue;
    }

    if (char === "," && !quote) {
      if (token.trim()) {
        parts.push(token.trim());
      }
      token = "";
      continue;
    }

    token += char;
  }

  if (token.trim()) {
    parts.push(token.trim());
  }

  return parts.map((part) => parseYamlScalar(part));
}

function parseYamlScalar(value) {
  const text = String(value || "").trim();
  if (text === "") {
    return "";
  }

  if (text.startsWith("[") && text.endsWith("]")) {
    return parseYamlInlineArray(text);
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

function parseMarkdownDocument(markdown, sourcePath) {
  const text = String(markdown || "");
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!match) {
    return {
      frontmatter: {},
      body: text.trimEnd(),
    };
  }

  const frontmatter = parseYamlDocument(match[1], sourcePath);
  if (!frontmatter || typeof frontmatter !== "object" || Array.isArray(frontmatter)) {
    throw new Error(`Frontmatter in ${sourcePath} must be a YAML object.`);
  }

  return {
    frontmatter,
    body: text.slice(match[0].length).trimEnd(),
  };
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

function buildListUrl(viewBasePath) {
  return `${normalizeBasePath(viewBasePath)}/`;
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

function frontmatterFieldValueForForm(field, frontmatter, body) {
  if (field.name === "content") {
    return body;
  }

  const raw = frontmatter[field.name];
  if (raw === null || raw === undefined) {
    return "";
  }

  if (field.input === "tags") {
    if (Array.isArray(raw)) {
      return raw.map((item) => sanitizeSingleLine(item)).filter(Boolean).join(", ");
    }
    return sanitizeSingleLine(raw);
  }

  if (field.list) {
    if (Array.isArray(raw)) {
      return raw.map((item) => sanitizeSingleLine(item)).filter(Boolean).join("\n");
    }
    return sanitizeMultiLine(raw);
  }

  if (field.input === "number") {
    return String(raw);
  }

  return String(raw);
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

  if (field.list) {
    const values = normalizeLineList(rawValue);
    if (field.required && values.length === 0) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return values;
  }

  if (field.name === "content") {
    const content = String(rawValue || "");
    if (field.required && content.trim().length === 0) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return content;
  }

  if (field.input === "textarea" || field.input === "markdown") {
    const value = sanitizeMultiLine(rawValue);
    if (field.required && !value) {
      throw new Error(`Field "${field.name}" is required.`);
    }
    return value;
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

function toMarkdownDocument(input) {
  const lines = ["---"];

  for (const field of input.schema.fields) {
    if (field.name === "slug" || field.name === "content") {
      continue;
    }

    const value = input.values[field.name];

    if (field.input === "tags") {
      if (Array.isArray(value) && value.length > 0) {
        lines.push(`${field.name}: [${value.map((tag) => yamlString(tag)).join(", ")}]`);
      }
      continue;
    }

    if (field.input === "number") {
      lines.push(`${field.name}: ${value === null ? "" : value}`);
      continue;
    }

    if (field.list) {
      if (Array.isArray(value) && value.length > 0) {
        lines.push(`${field.name}:`);
        value.forEach((item) => {
          lines.push(`  - ${yamlString(item)}`);
        });
      }
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

module.exports = {
  buildListUrl,
  buildViewUrl,
  extractFrontmatterMetadata,
  frontmatterFieldValueForForm,
  normalizeSlug,
  parseFieldValue,
  parseMarkdownDocument,
  parseYamlDocument,
  sanitizeEntryType,
  sanitizeSingleLine,
  normalizeLineList,
  toMarkdownDocument,
};
