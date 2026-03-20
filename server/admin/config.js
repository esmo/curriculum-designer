"use strict";

const path = require("node:path");
const {
  ADMIN_HOST,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
  deriveInstancePaths,
  parseAdminPort,
} = require("../../lib/instance");
const { sanitizeSingleLine } = require("./lib/content-utils");

function resolveSessionSecret(value) {
  const rawSecret = String(value || "").trim();
  if (!rawSecret) {
    return {
      sessionSecret: "curriculum-designer-dev-session-secret-change-me-at-least-32",
      usingDefaultSessionSecret: true,
    };
  }

  if (rawSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  return {
    sessionSecret: rawSecret,
    usingDefaultSessionSecret: false,
  };
}

function loadConfig(env = process.env) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const instance = deriveInstancePaths(rootDir, env.INSTANCE_ROOT);
  const schemaRoot = path.join(instance.themeRoot, "admin", "schemas");
  const {
    sessionSecret,
    usingDefaultSessionSecret,
  } = resolveSessionSecret(env.SESSION_SECRET);

  return {
    rootDir,
    instanceRoot: instance.instanceRoot,
    themeRoot: instance.themeRoot,
    contentRoot: instance.contentRoot,
    webRoot: instance.webRoot,
    buildRoot: instance.buildRoot,
    adminRuntimeRoot: instance.adminRuntimeRoot,
    adminBasePath: instance.adminBasePath,
    schemaRoot,
    npmBinary: process.platform === "win32" ? "npm.cmd" : "npm",
    rsyncBinary: "rsync",
    adminPort: parseAdminPort(env.ADMIN_PORT),
    adminHost: ADMIN_HOST,
    adminUserFile: sanitizeSingleLine(instance.adminUserFile),
    sessionSecret,
    usingDefaultSessionSecret,
    sessionCookieName: SESSION_COOKIE_NAME,
    sessionCookieSecure: SESSION_COOKIE_SECURE,
    sessionTtlSeconds: SESSION_TTL_SECONDS,
    allowedFieldInputs: new Set([
      "text",
      "textarea",
      "markdown",
      "number",
      "tags",
      "select",
      "section",
    ]),
  };
}

module.exports = {
  loadConfig,
};
