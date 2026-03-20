"use strict";

const path = require("path");
const { sanitizeSingleLine } = require("./lib/content-utils");

function parseBoolean(value, fallback = false) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return fallback;
}

function parseCookieSecure(value) {
  if (typeof value !== "string") {
    return "auto";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "true") {
    return true;
  }
  if (normalized === "false") {
    return false;
  }
  return "auto";
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function resolveSessionSecret(value) {
  const rawSecret = String(value || "").trim();
  if (!rawSecret) {
    return {
      sessionSecret: "blender-curriculum-dev-session-secret-change-me-at-least-32",
      usingDefaultSessionSecret: true,
    };
  }

  if (rawSecret.length < 32) {
    throw new Error(
      "BLENDER_CURRICULUM_SESSION_SECRET must be at least 32 characters long."
    );
  }

  return {
    sessionSecret: rawSecret,
    usingDefaultSessionSecret: false,
  };
}

function loadConfig(env = process.env) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const themeRoot = path.resolve(
    env.BLENDER_CURRICULUM_THEME_ROOT || path.join(rootDir, "theme")
  );
  const contentRoot = path.resolve(
    env.BLENDER_CURRICULUM_CONTENT_ROOT || path.join(rootDir, "content")
  );
  const webRoot = env.BLENDER_CURRICULUM_WEB_ROOT
    ? path.resolve(env.BLENDER_CURRICULUM_WEB_ROOT)
    : "";
  const schemaRoot = path.join(themeRoot, "admin", "schemas");
  const {
    sessionSecret,
    usingDefaultSessionSecret,
  } = resolveSessionSecret(env.BLENDER_CURRICULUM_SESSION_SECRET);

  return {
    rootDir,
    themeRoot,
    contentRoot,
    webRoot,
    schemaRoot,
    adminDir: path.join(rootDir, "admin"),
    npmBinary: process.platform === "win32" ? "npm.cmd" : "npm",
    rsyncBinary: "rsync",
    adminPort: Number.parseInt(env.BLENDER_CURRICULUM_ADMIN_PORT || "8787", 10),
    adminHost: env.BLENDER_CURRICULUM_ADMIN_HOST || "127.0.0.1",
    requireProxyAuth: parseBoolean(env.BLENDER_CURRICULUM_REQUIRE_PROXY_AUTH, false),
    adminUserFile: sanitizeSingleLine(env.BLENDER_CURRICULUM_ADMIN_USER_FILE)
      ? path.resolve(env.BLENDER_CURRICULUM_ADMIN_USER_FILE)
      : "",
    sessionSecret,
    usingDefaultSessionSecret,
    sessionCookieName:
      sanitizeSingleLine(env.BLENDER_CURRICULUM_SESSION_COOKIE_NAME) ||
      "bc_admin_session",
    sessionCookieSecure: parseCookieSecure(
      env.BLENDER_CURRICULUM_SESSION_COOKIE_SECURE
    ),
    sessionTtlSeconds: parsePositiveInteger(
      env.BLENDER_CURRICULUM_SESSION_TTL_SECONDS,
      60 * 60 * 12
    ),
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
