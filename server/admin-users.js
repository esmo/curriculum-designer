"use strict";

const readline = require("node:readline");

const { hashPassword } = require("./admin/password-hash");
const {
  normalizeUserName,
  readAdminUserFile,
  writeAdminUserFile,
} = require("./admin/user-file");

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npm run admin:users -- list <file>",
      "  npm run admin:users -- set <file> <username>",
      "  npm run admin:users -- delete <file> <username>",
      "",
    ].join("\n")
  );
}

function requiredArg(args, index, label) {
  const value = String(args[index] || "").trim();
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }
  return value;
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

async function promptPasswordTwice() {
  const password = await readHiddenLine("Password: ");
  if (!password) {
    throw new Error("Password must not be empty.");
  }

  const confirmation = await readHiddenLine("Repeat password: ");
  if (password !== confirmation) {
    throw new Error("Passwords do not match.");
  }

  return password;
}

async function main() {
  const args = process.argv.slice(2);
  const command = requiredArg(args, 0, "command");

  if (command === "list") {
    const filePath = requiredArg(args, 1, "file path");
    const { users } = await readAdminUserFile(filePath);
    for (const userName of users.keys()) {
      process.stdout.write(`${userName}\n`);
    }
    return;
  }

  if (command === "set") {
    const filePath = requiredArg(args, 1, "file path");
    const userName = normalizeUserName(requiredArg(args, 2, "user name"));
    const password = await promptPasswordTwice();
    const passwordHash = await hashPassword(password);
    const { entries } = await readAdminUserFile(filePath, {
      allowMissing: true,
    });
    const result = setUser(entries, userName, passwordHash);
    await writeAdminUserFile(filePath, result.entries);
    process.stdout.write(
      `${result.updated ? "Updated" : "Added"} user "${userName}" in ${filePath}\n`
    );
    return;
  }

  if (command === "delete") {
    const filePath = requiredArg(args, 1, "file path");
    const userName = normalizeUserName(requiredArg(args, 2, "user name"));
    const { entries } = await readAdminUserFile(filePath);
    const result = deleteUser(entries, userName);
    if (!result.deleted) {
      throw new Error(`User "${userName}" not found in ${filePath}.`);
    }
    await writeAdminUserFile(filePath, result.entries);
    process.stdout.write(`Deleted user "${userName}" from ${filePath}\n`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  usage();
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
