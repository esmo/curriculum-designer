"use strict";

const Fastify = require("fastify");

const { createAuth } = require("./auth");
const { registerRoutes } = require("./routes");
const { createBuildService } = require("./services/build-service");
const { createEntryService } = require("./services/entry-service");
const { createSchemaService } = require("./services/schema-service");

function createAdminApp(config) {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  const auth = createAuth({
    requireProxyAuth: config.requireProxyAuth,
  });

  const schemaService = createSchemaService({
    schemaRoot: config.schemaRoot,
    contentRoot: config.contentRoot,
    allowedFieldInputs: config.allowedFieldInputs,
  });

  const buildService = createBuildService({
    rootDir: config.rootDir,
    webRoot: config.webRoot,
    npmBinary: config.npmBinary,
    rsyncBinary: config.rsyncBinary,
  });

  const entryService = createEntryService({
    rootDir: config.rootDir,
    schemaService,
    enqueueBuild: buildService.enqueueBuild,
  });

  registerRoutes(app, {
    adminDir: config.adminDir,
    auth,
    schemaService,
    entryService,
  });

  async function start() {
    await schemaService.loadEntrySchemas();

    await app.listen({
      host: config.adminHost,
      port: config.adminPort,
    });

    app.log.info({
      adminUrl: `http://${config.adminHost}:${config.adminPort}/admin/`,
      requireProxyAuth: config.requireProxyAuth,
      contentRoot: config.contentRoot,
      webRoot: config.webRoot || null,
      syncToWebRoot: Boolean(config.webRoot),
      schemaRoot: config.schemaRoot,
      schemaCount: schemaService.getSchemaCount(),
      defaultEntryType: schemaService.getDefaultEntryType(),
    });
  }

  return {
    app,
    start,
  };
}

module.exports = {
  createAdminApp,
};
