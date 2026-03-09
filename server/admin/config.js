"use strict";

const path = require("path");

function loadConfig(env = process.env) {
  const rootDir = path.resolve(__dirname, "..", "..");
  const contentRoot = path.resolve(
    env.BLENDER_CURRICULUM_CONTENT_ROOT || path.join(rootDir, "content")
  );
  const webRoot = env.BLENDER_CURRICULUM_WEB_ROOT
    ? path.resolve(env.BLENDER_CURRICULUM_WEB_ROOT)
    : "";
  const schemaRoot = path.resolve(
    env.BLENDER_CURRICULUM_SCHEMA_ROOT || path.join(rootDir, "admin", "schemas")
  );

  return {
    rootDir,
    contentRoot,
    webRoot,
    schemaRoot,
    adminDir: path.join(rootDir, "admin"),
    npmBinary: process.platform === "win32" ? "npm.cmd" : "npm",
    rsyncBinary: "rsync",
    adminPort: Number.parseInt(env.BLENDER_CURRICULUM_ADMIN_PORT || "8787", 10),
    adminHost: env.BLENDER_CURRICULUM_ADMIN_HOST || "127.0.0.1",
    requireProxyAuth: env.BLENDER_CURRICULUM_REQUIRE_PROXY_AUTH === "true",
    allowedFieldInputs: new Set(["text", "textarea", "number", "tags", "select"]),
  };
}

module.exports = {
  loadConfig,
};
