"use strict";

const Fastify = require("fastify");
const fastifyCookie = require("@fastify/cookie");
const fastifySession = require("@fastify/session");

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

  app.register(fastifyCookie);
  app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: config.sessionCookieName,
    cookie: {
      httpOnly: true,
      path: "/admin",
      sameSite: "lax",
      secure: config.sessionCookieSecure,
      maxAge: config.sessionTtlSeconds * 1000,
    },
  });

  const auth = createAuth({
    requireProxyAuth: config.requireProxyAuth,
    adminCredentials: config.adminCredentials,
  });

  if (!config.requireProxyAuth && !auth.hasLocalCredentials()) {
    throw new Error(
      "No admin credentials configured. Set BLENDER_CURRICULUM_ADMIN_USERNAME and BLENDER_CURRICULUM_ADMIN_PASSWORD (or BLENDER_CURRICULUM_ADMIN_USERS)."
    );
  }

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

    if (config.usingDefaultSessionSecret) {
      app.log.warn(
        "BLENDER_CURRICULUM_SESSION_SECRET is not set. Using an insecure development fallback secret."
      );
    }

    app.log.info({
      adminUrl: `http://${config.adminHost}:${config.adminPort}/admin/`,
      requireProxyAuth: config.requireProxyAuth,
      localCredentialCount: config.adminCredentials.length,
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
