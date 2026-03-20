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
    adminBasePath,
    adminDir,
    auth,
    schemaService,
    entryService,
    renderMarkdown,
    vendorAssetsDir,
  } = input;
  const adminRootUrl = `${adminBasePath}/`;
  const adminApiBasePath = `${adminBasePath}/api`;

  app.register(fastifyStatic, {
    root: adminDir,
    prefix: adminRootUrl,
    index: ["index.html"],
  });

  app.register(fastifyStatic, {
    root: vendorAssetsDir,
    prefix: `${adminBasePath}/assets/vendor/tiny-mde/`,
    decorateReply: false,
  });

  app.get(adminBasePath, async (_, reply) => {
    reply.redirect(adminRootUrl);
  });

  app.get(`${adminBasePath}/session`, async (request, reply) => {
    const userName = auth.requestAuthUser(request) || "";
    reply.header("cache-control", "no-store");
    return sessionPayload(userName);
  });

  app.post(`${adminBasePath}/login`, async (request, reply) => {
    if (!auth.hasLocalUserFile()) {
      reply.code(503).send({
        error: "No admin user file configured on the server.",
      });
      return;
    }

    try {
      const username = request.body?.username;
      const password = request.body?.password;
      if (!(await auth.verifyCredentials(username, password))) {
        reply.code(401).send({
          error: "Invalid username or password.",
        });
        return;
      }

      auth.setSessionUser(request, username);
      reply.header("cache-control", "no-store");
      return sessionPayload(auth.requestSessionUser(request));
    } catch (error) {
      sendError(reply, error);
    }
  });

  app.post(`${adminBasePath}/logout`, async (request, reply) => {
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
    `${adminApiBasePath}/schemas`,
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
    `${adminApiBasePath}/entries/:entryType/:slug`,
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
    `${adminApiBasePath}/preview`,
    {
      preHandler: auth.requireAdminAuth,
    },
    async (request, reply) => {
      try {
        const markdown = String(request.body?.markdown || "");
        reply.header("cache-control", "no-store");
        reply.send({
          ok: true,
          html: renderMarkdown(markdown),
        });
      } catch (error) {
        sendError(reply, error);
      }
    }
  );

  app.post(
    `${adminApiBasePath}/entries`,
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
    `${adminApiBasePath}/entries/:entryType/:slug`,
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
