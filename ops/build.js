"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = path.resolve(__dirname, "..");
const APP_SRC_DIR = path.join(ROOT_DIR, "src");
const OUTPUT_DIR = path.join(ROOT_DIR, "build");
const CONTENT_ROOT = process.env.CONTENT_ROOT
  ? path.resolve(process.env.CONTENT_ROOT)
  : "";
const CONTENT_DIRS = ["lessons", "tasks", "topics"];

function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function prepareInputDirectory() {
  if (!CONTENT_ROOT) {
    return {
      inputDir: APP_SRC_DIR,
      cleanup: null,
    };
  }

  const tempInputDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "blender-curriculum-src-")
  );

  fs.cpSync(APP_SRC_DIR, tempInputDir, { recursive: true });

  ensureDirectory(CONTENT_ROOT);

  for (const contentDir of CONTENT_DIRS) {
    const sourceDir = path.join(CONTENT_ROOT, contentDir);
    const targetDir = path.join(tempInputDir, contentDir);

    ensureDirectory(sourceDir);
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true });
  }

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

  if (CONTENT_ROOT) {
    process.stdout.write(`Using external content root: ${CONTENT_ROOT}\n`);
  }

  try {
    runBuild(inputDir);
  } finally {
    if (cleanup) {
      cleanup();
    }
  }
}

main();
