"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const THEME_ROOT = path.resolve(
  process.env.BLENDER_CURRICULUM_THEME_ROOT || path.join(ROOT_DIR, "theme")
);
const CONTENT_ROOT = path.resolve(
  process.env.BLENDER_CURRICULUM_CONTENT_ROOT || path.join(ROOT_DIR, "content")
);
const OUTPUT_DIR = path.join(ROOT_DIR, "build");
const CONTENT_DIRS = ["lessons", "tasks", "topics"];

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
  for (const dirName of CONTENT_DIRS) {
    ensureDirectory(path.join(CONTENT_ROOT, dirName));
  }
}

function prepareInputDirectory() {
  ensureThemeDirectory();
  ensureContentDirectory();

  const tempInputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "blender-curriculum-input-")
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

function main() {
  const { inputDir, cleanup } = prepareInputDirectory();

  process.stdout.write(`Using theme root: ${THEME_ROOT}\n`);
  process.stdout.write(`Using content root: ${CONTENT_ROOT}\n`);

  try {
    runBuild(inputDir);
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}

main();
