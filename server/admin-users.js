"use strict";

const path = require("node:path");

const {
  deleteUserByName,
  listUsers,
  promptPasswordTwice,
  resolveInstanceAdminUserFile,
  setUserPassword,
} = require("../lib/admin-users");

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npm run admin:users -- list <instance-name> [--registry <file>]",
      "  npm run admin:users -- set <instance-name> <username> [--registry <file>]",
      "  npm run admin:users -- delete <instance-name> <username> [--registry <file>]",
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

function parseOptions(args) {
  const positionals = [];
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    const name = current.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${name}.`);
    }

    options[name] = value;
    index += 1;
  }

  return {
    positionals,
    options,
  };
}

function resolveUserFile(rootDir, instanceName, registryFile) {
  return resolveInstanceAdminUserFile(rootDir, instanceName, registryFile);
}

async function main() {
  const rootDir = path.resolve(__dirname, "..");
  const { positionals, options } = parseOptions(process.argv.slice(2));
  const command = requiredArg(positionals, 0, "command");
  const instanceName = requiredArg(positionals, 1, "instance name");
  const filePath = resolveUserFile(rootDir, instanceName, options.registry);

  if (command === "list") {
    const users = await listUsers(filePath);
    for (const userName of users) {
      process.stdout.write(`${userName}\n`);
    }
    return;
  }

  if (command === "set") {
    const userName = requiredArg(positionals, 2, "user name");
    const password = await promptPasswordTwice();
    const result = await setUserPassword(filePath, userName, password);
    process.stdout.write(
      `${result.updated ? "Updated" : "Added"} user "${result.userName}" in ${result.filePath}\n`
    );
    return;
  }

  if (command === "delete") {
    const userName = requiredArg(positionals, 2, "user name");
    const result = await deleteUserByName(filePath, userName);
    process.stdout.write(`Deleted user "${result.userName}" from ${result.filePath}\n`);
    return;
  }

  throw new Error(`Unknown command "${command}".`);
}

main().catch((error) => {
  usage();
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
