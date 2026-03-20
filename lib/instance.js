"use strict";

const path = require("node:path");

const ADMIN_BASE_PATH = "/admin";
const ADMIN_HOST = "127.0.0.1";
const DEFAULT_ADMIN_PORT = 8787;
const SESSION_COOKIE_NAME = "bc_admin_session";
const SESSION_COOKIE_SECURE = "auto";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function resolveInstanceRoot(rootDir, value) {
  const rawValue = String(value || "").trim();
  return path.resolve(rawValue || rootDir);
}

function sanitizeInstanceId(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "default";
}

function deriveInstancePaths(rootDir, instanceRootValue) {
  const instanceRoot = resolveInstanceRoot(rootDir, instanceRootValue);

  return {
    instanceId: sanitizeInstanceId(path.basename(instanceRoot)),
    instanceRoot,
    themeRoot: path.join(instanceRoot, "theme"),
    contentRoot: path.join(instanceRoot, "content"),
    buildRoot: path.join(instanceRoot, "build"),
    webRoot: path.join(instanceRoot, "web"),
    adminRuntimeRoot: path.join(instanceRoot, "admin"),
    adminUserFile: path.join(instanceRoot, "admin-users.txt"),
    adminBasePath: ADMIN_BASE_PATH,
  };
}

function parseAdminPort(value, fallback = DEFAULT_ADMIN_PORT) {
  const text = String(value || "").trim();
  if (!text) {
    return fallback;
  }

  const parsed = Number.parseInt(text, 10);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error("ADMIN_PORT must be an integer between 0 and 65535.");
  }

  return parsed;
}

module.exports = {
  ADMIN_BASE_PATH,
  ADMIN_HOST,
  DEFAULT_ADMIN_PORT,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_SECURE,
  SESSION_TTL_SECONDS,
  deriveInstancePaths,
  parseAdminPort,
  resolveInstanceRoot,
  sanitizeInstanceId,
};
