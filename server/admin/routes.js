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

function sessionPayload(userName) {
  const normalizedUserName = String(userName || "").trim();
  return {
    ok: true,
    loggedIn: normalizedUserName.length > 0,
    user: {
      name: normalizedUserName,
    },
  };
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

  app.get("/admin/session", async (request, reply) => {
    const userName = auth.requestAuthUser(request) || "";
    reply.header("cache-control", "no-store");
    return sessionPayload(userName);
  });

  app.post("/admin/login", async (request, reply) => {
    if (!auth.hasLocalCredentials()) {
      reply.code(503).send({
        error: "No local admin credentials configured on the server.",
      });
      return;
    }

    const username = request.body?.username;
    const password = request.body?.password;
    if (!auth.verifyCredentials(username, password)) {
      reply.code(401).send({
        error: "Invalid username or password.",
      });
      return;
    }

    auth.setSessionUser(request, username);
    reply.header("cache-control", "no-store");
    return sessionPayload(auth.requestSessionUser(request));
  });

  app.post("/admin/logout", async (request, reply) => {
    try {
      await auth.clearSession(request);
    } catch (error) {
      sendError(reply, error);
      return;
    }

    reply.header("cache-control", "no-store");
    return sessionPayload("");
  });

  app.get(
    "/admin/api/schemas",
    {
      preHandler: auth.requireAdminAuth,
    },
    async () => ({
      ok: true,
      defaultEntryType: schemaService.getDefaultEntryType(),
      schemas: schemaService.getPublicSchemas(),
    })
  );

  app.get(
    "/admin/api/entries/:entryType/:slug",
    {
      preHandler: auth.requireAdminAuth,
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
    "/admin/api/entries",
    {
      preHandler: auth.requireAdminAuth,
    },
    async (request, reply) => {
      try {
        const result = await entryService.saveEntry(
          request.body,
          auth.requestAuthUser(request)
        );
        reply.code(result.statusCode).send(result.body);
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.delete(
    "/admin/api/entries/:entryType/:slug",
    {
      preHandler: auth.requireAdminAuth,
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
