"use strict";

const { sanitizeSingleLine } = require("./lib/content-utils");
const { isArgon2idHash, verifyPassword } = require("./password-hash");
const { configError, readAdminUserFile } = require("./user-file");

function createAuth(input) {
  const { requireProxyAuth, adminUserFile } = input;

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

  function hasLocalUserFile() {
    return Boolean(adminUserFile);
  }

  async function verifyCredentials(username, password) {
    const normalizedUser = sanitizeSingleLine(username);
    if (!normalizedUser) {
      return false;
    }

    if (!hasLocalUserFile()) {
      return false;
    }

    const { users } = await readAdminUserFile(adminUserFile);
    const entry = users.get(normalizedUser);
    if (!entry) {
      return false;
    }

    if (!isArgon2idHash(entry.passwordHash)) {
      throw configError(
        `Unsupported hash format for user "${normalizedUser}" in ${adminUserFile}. Expected an argon2id hash.`
      );
    }

    return verifyPassword(entry.passwordHash, password);
  }

  async function validateLocalAuthConfig() {
    if (!hasLocalUserFile()) {
      throw configError(
        "No admin user file configured. Set BLENDER_CURRICULUM_ADMIN_USER_FILE."
      );
    }

    const { users } = await readAdminUserFile(adminUserFile);
    if (users.size < 1) {
      throw configError(
        `Admin user file ${adminUserFile} does not contain any users.`
      );
    }

    for (const [userName, entry] of users.entries()) {
      if (!isArgon2idHash(entry.passwordHash)) {
        throw configError(
          `Unsupported hash format for user "${userName}" in ${adminUserFile}. Expected an argon2id hash.`
        );
      }
    }
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
    hasLocalUserFile,
    requestAuthUser,
    requestRemoteUser,
    requestSessionUser,
    requireAdminAuth,
    setSessionUser,
    validateLocalAuthConfig,
    verifyCredentials,
  };
}

module.exports = {
  createAuth,
};
