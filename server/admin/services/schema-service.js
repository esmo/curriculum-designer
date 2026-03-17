"use strict";

const path = require("path");
const fs = require("node:fs/promises");

const {
  parseYamlDocument,
  sanitizeEntryType,
  sanitizeSingleLine,
} = require("../lib/content-utils");

function createSchemaService(input) {
  const {
    schemaRoot,
    contentRoot,
    allowedFieldInputs,
  } = input;

  let entrySchemasByType = new Map();
  let defaultEntryType = "";

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

    const inputType = sanitizeEntryType(field.input || "text");
    if (!allowedFieldInputs.has(inputType)) {
      throw new Error(
        `Field "${name}" in ${sourcePath} uses unsupported input "${inputType}".`
      );
    }

    let options = undefined;
    if (inputType === "select") {
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
    const list = field.list === true;

    if (list && inputType !== "textarea" && inputType !== "markdown") {
      throw new Error(
        `Field "${name}" in ${sourcePath} uses list=true but is not a textarea or markdown field.`
      );
    }

    return {
      name,
      label,
      input: inputType,
      list,
      required: field.required === true,
      placeholder: sanitizeSingleLine(field.placeholder || ""),
      hint: sanitizeSingleLine(field.hint || ""),
      width: normalizedWidth,
      rows:
        (inputType === "textarea" || inputType === "markdown") &&
        Number.isInteger(field.rows) &&
        field.rows > 0
          ? field.rows
          : undefined,
      min:
        inputType === "number" && Number.isFinite(field.min)
          ? Number(field.min)
          : undefined,
      options,
    };
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
      dir: path.join(contentRoot, outputDir),
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
    const dirEntries = await fs.readdir(schemaRoot, {
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
      throw new Error(`No schema files found in ${schemaRoot}.`);
    }

    const schemaMap = new Map();

    for (const entry of schemaEntries) {
      const schemaPath = path.join(schemaRoot, entry.name);
      const yamlText = await fs.readFile(schemaPath, "utf8");
      const schema = parseSchemaYaml(yamlText, schemaPath);

      if (schemaMap.has(schema.id)) {
        throw new Error(
          `Duplicate schema id "${schema.id}" found in ${schemaRoot}.`
        );
      }
      schemaMap.set(schema.id, schema);
    }

    entrySchemasByType = schemaMap;
    defaultEntryType = schemaMap.keys().next().value || "";
  }

  function getSchema(entryType) {
    return entrySchemasByType.get(entryType);
  }

  function getPublicSchemas() {
    return Array.from(entrySchemasByType.values()).map(publicSchema);
  }

  function getDefaultEntryType() {
    return defaultEntryType;
  }

  function getSchemaCount() {
    return entrySchemasByType.size;
  }

  return {
    getDefaultEntryType,
    getPublicSchemas,
    getSchema,
    getSchemaCount,
    loadEntrySchemas,
  };
}

module.exports = {
  createSchemaService,
};
