"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { deriveInstancePaths } = require("../lib/instance");

const ROOT_DIR = path.resolve(__dirname, "..");
const INSTANCE = deriveInstancePaths(ROOT_DIR, process.env.INSTANCE_ROOT);
const THEME_ROOT = INSTANCE.themeRoot;
const CONTENT_ROOT = INSTANCE.contentRoot;
const OUTPUT_DIR = INSTANCE.buildRoot;
const ADMIN_RUNTIME_DIR = INSTANCE.adminRuntimeRoot;
const ADMIN_OUTPUT_DIR = path.join(OUTPUT_DIR, "admin");

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function ensureThemeDirectory() {
  if (!fs.existsSync(THEME_ROOT) || !fs.statSync(THEME_ROOT).isDirectory()) {
    throw new Error(`Theme root is missing or invalid: ${THEME_ROOT}`);
  }
}

function ensureContentDirectory() {
  ensureDirectory(CONTENT_ROOT);
}

function prepareInputDirectory() {
  ensureThemeDirectory();
  ensureContentDirectory();

  const tempInputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "curriculum-designer-input-")
  );

  fs.cpSync(THEME_ROOT, tempInputDir, { recursive: true });
  fs.cpSync(CONTENT_ROOT, tempInputDir, { recursive: true, force: true });

  return {
    inputDir: tempInputDir,
    cleanup: () => fs.rmSync(tempInputDir, { recursive: true, force: true }),
  };
}

function eleventyBinaryPath() {
  const binaryName = process.platform === "win32" ? "eleventy.cmd" : "eleventy";
  return path.join(ROOT_DIR, "node_modules", ".bin", binaryName);
}

function runBuild(inputDir) {
  const env = {
    ...process.env,
    ELEVENTY_INPUT_DIR: inputDir,
    ELEVENTY_OUTPUT_DIR: OUTPUT_DIR,
  };

  const result = spawnSync(eleventyBinaryPath(), [], {
    cwd: ROOT_DIR,
    env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function syncAdminFrontend() {
  const builtAdminDir = ADMIN_OUTPUT_DIR;
  const builtAdminIndex = path.join(builtAdminDir, "index.html");
  if (!fs.existsSync(builtAdminIndex)) {
    throw new Error(
      `Admin template build output is missing: ${builtAdminIndex}`
    );
  }

  ensureDirectory(ADMIN_RUNTIME_DIR);
  fs.copyFileSync(builtAdminIndex, path.join(ADMIN_RUNTIME_DIR, "index.html"));
  fs.rmSync(path.join(ADMIN_RUNTIME_DIR, "assets"), {
    recursive: true,
    force: true,
  });

  const builtAdminAssets = path.join(builtAdminDir, "assets");
  if (fs.existsSync(builtAdminAssets) && fs.statSync(builtAdminAssets).isDirectory()) {
    fs.cpSync(builtAdminAssets, path.join(ADMIN_RUNTIME_DIR, "assets"), {
      recursive: true,
      force: true,
    });
  }
}

function main() {
  const { inputDir, cleanup } = prepareInputDirectory();

  process.stdout.write(`Using instance root: ${INSTANCE.instanceRoot}\n`);
  process.stdout.write(`Using theme root: ${THEME_ROOT}\n`);
  process.stdout.write(`Using content root: ${CONTENT_ROOT}\n`);
  process.stdout.write(`Using build root: ${OUTPUT_DIR}\n`);
  process.stdout.write(`Using admin runtime root: ${ADMIN_RUNTIME_DIR}\n`);

  try {
    runBuild(inputDir);
    syncAdminFrontend();
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}

main();
