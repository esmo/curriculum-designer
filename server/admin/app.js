"use strict";

const path = require("path");
const Fastify = require("fastify");
const fastifyCookie = require("@fastify/cookie");
const fastifySession = require("@fastify/session");

const { createAuth } = require("./auth");
const { registerRoutes } = require("./routes");
const { createBuildService } = require("./services/build-service");
const { createEntryService } = require("./services/entry-service");
const { createSchemaService } = require("./services/schema-service");
const { createMarkdownLib } = require("../../lib/create-markdown-lib");

function createAdminApp(config) {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  app.register(fastifyCookie);
  app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: config.sessionCookieName,
    cookie: {
      httpOnly: true,
      path: config.adminBasePath,
      sameSite: "lax",
      secure: config.sessionCookieSecure,
      maxAge: config.sessionTtlSeconds * 1000,
    },
  });

  const auth = createAuth({
    adminUserFile: config.adminUserFile,
  });

  const schemaService = createSchemaService({
    schemaRoot: config.schemaRoot,
    contentRoot: config.contentRoot,
    allowedFieldInputs: config.allowedFieldInputs,
  });

  const buildService = createBuildService({
    rootDir: config.rootDir,
    instanceRoot: config.instanceRoot,
    webRoot: config.webRoot,
    buildRoot: config.buildRoot,
    npmBinary: config.npmBinary,
    rsyncBinary: config.rsyncBinary,
  });

  const entryService = createEntryService({
    rootDir: config.rootDir,
    schemaService,
    enqueueBuild: buildService.enqueueBuild,
  });

  const markdownLib = createMarkdownLib();

  registerRoutes(app, {
    adminBasePath: config.adminBasePath,
    adminDir: config.adminRuntimeRoot,
    auth,
    schemaService,
    entryService,
    renderMarkdown: (value) => markdownLib.render(String(value || "")),
    vendorAssetsDir: path.join(
      config.rootDir,
      "node_modules",
      "tiny-markdown-editor",
      "dist"
    ),
  });

  async function start() {
    await schemaService.loadEntrySchemas();
    await auth.validateLocalAuthConfig();

    await app.listen({
      host: config.adminHost,
      port: config.adminPort,
    });

    if (config.usingDefaultSessionSecret) {
      app.log.warn(
        "SESSION_SECRET is not set. Using an insecure development fallback secret."
      );
    }

    app.log.info({
      adminUrl: `http://${config.adminHost}:${config.adminPort}${config.adminBasePath}/`,
      instanceRoot: config.instanceRoot,
      adminUserFile: config.adminUserFile || null,
      themeRoot: config.themeRoot,
      contentRoot: config.contentRoot,
      webRoot: config.webRoot || null,
      buildRoot: config.buildRoot,
      adminRuntimeRoot: config.adminRuntimeRoot,
      adminBasePath: config.adminBasePath,
      syncToWebRoot: true,
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
