"use strict";

const fastifyStatic = require("@fastify/static");

function sendError(reply, error) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 400;
  const payload = {
    error: error?.message || "Unknown error.",
  };

  if (error && Object.prototype.hasOwnProperty.call(error, "file")) {
    payload.file = error.file;
  }

  reply.code(statusCode).send(payload);
}

function registerRoutes(app, input) {
  const {
    adminDir,
    auth,
    schemaService,
    entryService,
  } = input;

  app.register(fastifyStatic, {
    root: adminDir,
    prefix: "/admin/",
    index: ["index.html"],
  });

  app.get("/admin", async (_, reply) => {
    reply.redirect("/admin/");
  });

  app.get("/admin-api/health", { preHandler: auth.requireProxyAuth }, async (request) => ({
    ok: true,
    user: {
      name: auth.requestRemoteUser(request) || "",
    },
  }));

  app.get("/admin-api/schemas", { preHandler: auth.requireProxyAuth }, async () => ({
    ok: true,
    defaultEntryType: schemaService.getDefaultEntryType(),
    schemas: schemaService.getPublicSchemas(),
  }));

  app.get(
    "/admin-api/entries/:entryType/:slug",
    {
      preHandler: auth.requireProxyAuth,
    },
    async (request, reply) => {
      try {
        const body = await entryService.readEntry(request.params || {});
        reply.send(body);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    "/admin-api/entries",
    {
      preHandler: auth.requireProxyAuth,
    },
    async (request, reply) => {
      try {
        const result = await entryService.saveEntry(
          request.body,
          auth.requestRemoteUser(request)
        );
        reply.code(result.statusCode).send(result.body);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.delete(
    "/admin-api/entries/:entryType/:slug",
    {
      preHandler: auth.requireProxyAuth,
    },
    async (request, reply) => {
      try {
        const result = await entryService.deleteEntry(request.params || {});
        reply.code(result.statusCode).send(result.body);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );
}

module.exports = {
  registerRoutes,
};
