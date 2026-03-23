"use strict";

const path = require("node:path");
const {
  ADMIN_HOST,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
} = require("../../lib/instance");
const { resolveInstanceRuntime } = require("../../lib/instance-registry");
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
  const runtime = resolveInstanceRuntime({
    rootDir,
    instanceName: env.INSTANCE_NAME,
    registryFile: env.INSTANCE_REGISTRY_FILE,
    adminPort: env.ADMIN_PORT,
  });
  const schemaRoot = path.join(runtime.paths.themeRoot, "admin", "schemas");
  const {
    sessionSecret,
    usingDefaultSessionSecret,
  } = resolveSessionSecret(env.SESSION_SECRET);

  return {
    rootDir,
    instanceName: runtime.instanceName,
    registryFile: runtime.registryFile,
    instanceRoot: runtime.paths.instanceRoot,
    themeRoot: runtime.paths.themeRoot,
    contentRoot: runtime.paths.contentRoot,
    webRoot: runtime.paths.webRoot,
    buildRoot: runtime.paths.buildRoot,
    adminRuntimeRoot: runtime.paths.adminRuntimeRoot,
    adminBasePath: runtime.paths.adminBasePath,
    schemaRoot,
    npmBinary: process.platform === "win32" ? "npm.cmd" : "npm",
    rsyncBinary: "rsync",
    adminPort: runtime.adminPort,
    adminHost: ADMIN_HOST,
    adminUserFile: sanitizeSingleLine(runtime.paths.adminUserFile),
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
