"use strict";

const { spawn } = require("node:child_process");

function createBuildService(input) {
  const {
    rootDir,
    instanceRoot,
    webRoot,
    buildRoot,
    npmBinary,
    rsyncBinary,
  } = input;

  let buildQueue = Promise.resolve();

  function runSyncToWebRoot() {
    return new Promise((resolve) => {
      if (!webRoot) {
        resolve({
          ok: true,
          skipped: true,
          code: null,
          startedAt: null,
          endedAt: null,
          error: null,
        });
        return;
      }

      const startedAt = new Date().toISOString();
      const child = spawn(
        rsyncBinary,
        ["-az", "--delete", `${buildRoot}/`, `${webRoot}/`],
        {
          cwd: rootDir,
          env: process.env,
        }
      );

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        resolve({
          ok: false,
          skipped: false,
          code: null,
          startedAt,
          endedAt: new Date().toISOString(),
          error: error.message,
        });
      });

      child.on("close", (code) => {
        resolve({
          ok: code === 0,
          skipped: false,
          code,
          startedAt,
          endedAt: new Date().toISOString(),
          error: code === 0 ? null : stderr.trim() || `Sync exited with code ${code}`,
        });
      });
    });
  }

  function runBuild() {
    return new Promise((resolve) => {
      const startedAt = new Date().toISOString();
      const buildEnv = {
        ...process.env,
        INSTANCE_ROOT: instanceRoot,
      };
      const child = spawn(npmBinary, ["run", "build"], {
        cwd: rootDir,
        env: buildEnv,
      });

      let stderr = "";

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        resolve({
          ok: false,
          code: null,
          startedAt,
          endedAt: new Date().toISOString(),
          error: error.message,
        });
      });

      child.on("close", (code) => {
        const buildResult = {
          ok: code === 0,
          code,
          startedAt,
          endedAt: new Date().toISOString(),
          error: code === 0 ? null : stderr.trim() || `Build exited with code ${code}`,
        };

        if (!buildResult.ok) {
          resolve({
            ...buildResult,
            sync: {
              ok: false,
              skipped: true,
              code: null,
              startedAt: null,
              endedAt: null,
              error: "Build failed. Sync skipped.",
            },
          });
          return;
        }

        runSyncToWebRoot().then((syncResult) => {
          resolve({
            ...buildResult,
            sync: syncResult,
          });
        });
      });
    });
  }

  function enqueueBuild() {
    buildQueue = buildQueue
      .then(() => runBuild())
      .catch((error) => ({
        ok: false,
        code: null,
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        error: error.message,
      }));

    return buildQueue;
  }

  return {
    enqueueBuild,
  };
}

module.exports = {
  createBuildService,
};
