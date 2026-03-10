"use strict";

const fs = require("node:fs/promises");
const path = require("path");

const { sanitizeSingleLine } = require("./lib/content-utils");

function configError(message) {
  const error = new Error(message);
  error.statusCode = 500;
  return error;
}

function normalizeUserName(value) {
  const userName = sanitizeSingleLine(value);
  if (!userName) {
    throw configError("User names must not be empty.");
  }

  if (userName.includes(":")) {
    throw configError(`Invalid user name "${userName}". ":" is not allowed.`);
  }

  return userName;
}

function parseAdminUserFile(content, sourcePath) {
  const entries = [];
  const users = new Map();
  const lines = String(content || "").split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const lineNumber = index + 1;
    const trimmedLine = rawLine.trim();

    if (!trimmedLine) {
      entries.push({
        type: "blank",
      });
      continue;
    }

    if (trimmedLine.startsWith("#")) {
      entries.push({
        type: "comment",
        value: rawLine,
      });
      continue;
    }

    const separatorIndex = rawLine.indexOf(":");
    if (separatorIndex <= 0) {
      throw configError(
        `Invalid admin user file line ${lineNumber} in ${sourcePath}. Expected "username:hash".`
      );
    }

    const userName = normalizeUserName(rawLine.slice(0, separatorIndex));
    const passwordHash = rawLine.slice(separatorIndex + 1).trim();
    if (!passwordHash) {
      throw configError(
        `Missing password hash for user "${userName}" in ${sourcePath}:${lineNumber}.`
      );
    }

    if (users.has(userName)) {
      throw configError(
        `Duplicate user "${userName}" in ${sourcePath}:${lineNumber}.`
      );
    }

    const entry = {
      type: "user",
      userName,
      passwordHash,
    };
    entries.push(entry);
    users.set(userName, entry);
  }

  return {
    entries,
    users,
  };
}

async function readAdminUserFile(filePath, input = {}) {
  const options = {
    allowMissing: false,
    ...input,
  };

  let content = "";
  try {
    content = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT" && options.allowMissing) {
      return {
        entries: [],
        users: new Map(),
      };
    }

    if (error && error.code === "ENOENT") {
      throw configError(`Admin user file not found: ${filePath}`);
    }

    throw configError(
      `Failed to read admin user file ${filePath}: ${error?.message || "Unknown error."}`
    );
  }

  return parseAdminUserFile(content, filePath);
}

function serializeAdminUserFile(entries) {
  return `${entries
    .map((entry) => {
      if (entry.type === "comment") {
        return entry.value;
      }

      if (entry.type === "user") {
        return `${entry.userName}:${entry.passwordHash}`;
      }

      return "";
    })
    .join("\n")}\n`;
}

async function writeAdminUserFile(filePath, entries) {
  const directory = path.dirname(filePath);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(filePath, serializeAdminUserFile(entries), {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.chmod(filePath, 0o600).catch(() => {});
}

module.exports = {
  configError,
  normalizeUserName,
  parseAdminUserFile,
  readAdminUserFile,
  serializeAdminUserFile,
  writeAdminUserFile,
};
