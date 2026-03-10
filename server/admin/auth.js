"use strict";

const { sanitizeSingleLine } = require("./lib/content-utils");

function createAuth(input) {
  const { requireProxyAuth, adminCredentials } = input;
  const credentialMap = new Map();

  for (const credential of adminCredentials || []) {
    const username = sanitizeSingleLine(credential?.username);
    const password = String(credential?.password || "");
    if (!username || !password) {
      continue;
    }
    credentialMap.set(username, password);
  }

  function requestSessionUser(request) {
    return sanitizeSingleLine(request.session?.user?.name);
  }

  function requestRemoteUser(request) {
    return sanitizeSingleLine(request.headers["x-remote-user"]);
  }

  function requestAuthUser(request) {
    const sessionUser = requestSessionUser(request);
    if (sessionUser) {
      return sessionUser;
    }

    if (requireProxyAuth) {
      return requestRemoteUser(request);
    }

    return "";
  }

  function hasLocalCredentials() {
    return credentialMap.size > 0;
  }

  function verifyCredentials(username, password) {
    const normalizedUser = sanitizeSingleLine(username);
    if (!normalizedUser) {
      return false;
    }

    const expectedPassword = credentialMap.get(normalizedUser);
    if (!expectedPassword) {
      return false;
    }

    return String(password || "") === expectedPassword;
  }

  function setSessionUser(request, userName) {
    const normalizedUser = sanitizeSingleLine(userName);
    if (!normalizedUser || !request.session) {
      return;
    }

    request.session.user = {
      name: normalizedUser,
    };
  }

  async function clearSession(request) {
    if (!request.session) {
      return;
    }

    await new Promise((resolve, reject) => {
      request.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  function requireAdminAuth(request, reply, done) {
    const userName = requestAuthUser(request);
    if (!userName) {
      reply.code(401).send({
        error: "Unauthorized.",
      });
      return;
    }

    done();
  }

  return {
    clearSession,
    hasLocalCredentials,
    requestAuthUser,
    requestRemoteUser,
    requestSessionUser,
    requireAdminAuth,
    setSessionUser,
    verifyCredentials,
  };
}

module.exports = {
  createAuth,
};
