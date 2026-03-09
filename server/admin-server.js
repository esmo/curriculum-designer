"use strict";

const { createAdminApp } = require("./admin/app");
const { loadConfig } = require("./admin/config");

const config = loadConfig();
const { app, start } = createAdminApp(config);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

start().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
