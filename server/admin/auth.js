"use strict";

const { sanitizeSingleLine } = require("./lib/content-utils");

function createAuth(input) {
  const { requireProxyAuth } = input;

  function requireProxyAuthHandler(request, reply, done) {
    if (!requireProxyAuth) {
      done();
      return;
    }

    const remoteUser = request.headers["x-remote-user"];
    if (!remoteUser) {
      reply.code(401).send({
        error: "Unauthorized. Missing X-Remote-User header.",
      });
      return;
    }

    done();
  }

  function requestRemoteUser(request) {
    return sanitizeSingleLine(request.headers["x-remote-user"]);
  }

  return {
    requestRemoteUser,
    requireProxyAuth: requireProxyAuthHandler,
  };
}

module.exports = {
  createAuth,
};
