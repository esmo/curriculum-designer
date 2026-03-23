"use strict";

const readline = require("node:readline");

const { resolveInstanceRuntime } = require("./instance-registry");
const { hashPassword } = require("../server/admin/password-hash");
const {
  normalizeUserName,
  readAdminUserFile,
  writeAdminUserFile,
} = require("../server/admin/user-file");

function resolveInstanceAdminUserFile(rootDir, instanceName, registryFile) {
  return resolveInstanceRuntime({
    rootDir,
    instanceName,
    registryFile,
  }).paths.adminUserFile;
}

function setUser(entries, userName, passwordHash) {
  let updated = false;
  const nextEntries = entries.map((entry) => {
    if (entry.type === "user" && entry.userName === userName) {
      updated = true;
      return {
        ...entry,
        passwordHash,
      };
    }
    return entry;
  });

  if (!updated) {
    nextEntries.push({
      type: "user",
      userName,
      passwordHash,
    });
  }

  return {
    updated,
    entries: nextEntries,
  };
}

function deleteUser(entries, userName) {
  let deleted = false;
  const nextEntries = entries.filter((entry) => {
    if (entry.type === "user" && entry.userName === userName) {
      deleted = true;
      return false;
    }
    return true;
  });

  return {
    deleted,
    entries: nextEntries,
  };
}

function readHiddenLine(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error("Interactive terminal required for password input."));
      return;
    }

    let value = "";
    const previousRawMode = stdin.isRaw;

    function cleanup() {
      stdin.removeListener("keypress", onKeypress);
      if (stdin.setRawMode) {
        stdin.setRawMode(Boolean(previousRawMode));
      }
    }

    function onKeypress(char, key) {
      if (key && key.ctrl && key.name === "c") {
        stdout.write("\n");
        cleanup();
        reject(new Error("Cancelled."));
        return;
      }

      if (key && (key.name === "return" || key.name === "enter")) {
        stdout.write("\n");
        cleanup();
        resolve(value);
        return;
      }

      if (key && key.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }

      if (key && (key.ctrl || key.meta)) {
        return;
      }

      if (typeof char === "string" && char.length > 0) {
        value += char;
      }
    }

    readline.emitKeypressEvents(stdin);
    stdout.write(prompt);
    if (stdin.setRawMode) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.on("keypress", onKeypress);
  });
}

async function promptPasswordTwice(prompts = {}) {
  const password = await readHiddenLine(prompts.password || "Password: ");
  if (!password) {
    throw new Error("Password must not be empty.");
  }

  const confirmation = await readHiddenLine(
    prompts.confirmation || "Repeat password: "
  );
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  return password;
}

async function listUsers(filePath) {
  const { users } = await readAdminUserFile(filePath);
  return [...users.keys()];
}

async function setUserPassword(filePath, userName, password) {
  const normalizedUserName = normalizeUserName(userName);
  const passwordHash = await hashPassword(password);
  const { entries } = await readAdminUserFile(filePath, {
    allowMissing: true,
  });
  const result = setUser(entries, normalizedUserName, passwordHash);
  await writeAdminUserFile(filePath, result.entries);

  return {
    filePath,
    updated: result.updated,
    userName: normalizedUserName,
  };
}

async function deleteUserByName(filePath, userName) {
  const normalizedUserName = normalizeUserName(userName);
  const { entries } = await readAdminUserFile(filePath);
  const result = deleteUser(entries, normalizedUserName);
  if (!result.deleted) {
    throw new Error(`User "${normalizedUserName}" not found in ${filePath}.`);
  }

  await writeAdminUserFile(filePath, result.entries);
  return {
    filePath,
    userName: normalizedUserName,
  };
}

module.exports = {
  deleteUser,
  deleteUserByName,
  listUsers,
  promptPasswordTwice,
  resolveInstanceAdminUserFile,
  setUser,
  setUserPassword,
};
