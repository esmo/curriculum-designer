#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const { deriveInstancePaths, parseAdminPort } = require("../lib/instance");
const {
  readRegistryFile,
  registerInstance,
  resolveInstanceEnvFile,
  resolveInstanceRuntime,
  resolveNginxSnippetName,
  resolveRegistryFile,
  resolveServiceName,
  unregisterInstance,
} = require("../lib/instance-registry");

const REPO_DIR = path.resolve(__dirname, "..");
const SYSTEMD_DIR = "/etc/systemd/system";
const NGINX_DIR = "/etc/nginx/snippets";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function usage() {
  process.stderr.write(
    [
      "Usage:",
      "  npm run instance:create -- <name> <root> [--admin-port <port>] [--service-user <user>] [--service-group <group>] [--session-secret <secret>] [--registry <file>]",
      "  npm run instance:delete -- <name> [--registry <file>]",
      "  npm run instance:resolve -- <name> [--registry <file>]",
      "  npm run instance:list",
      "  npm run instances -- resolve <name> [--shell] [--registry <file>]",
      "",
    ].join("\n")
  );
}

function defaultServiceUser() {
  const sudoUser = String(process.env.SUDO_USER || "").trim();
  return sudoUser || os.userInfo().username;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function requireRoot() {
  if (typeof process.getuid === "function" && process.getuid() !== 0) {
    fail("Run this command with sudo or as root.");
  }
}

function requireCleanRepo() {
  if (!fs.existsSync(path.join(REPO_DIR, ".git"))) {
    fail(`Repository is not a git repository: ${REPO_DIR}`);
  }
}

function requireCommand(name) {
  const result = spawnSync("sh", ["-lc", `command -v ${name}`], {
    stdio: "ignore",
  });
  if (result.status !== 0) {
    fail(`Missing required command: ${name}`);
  }
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`${command} exited with code ${result.status}.`);
  }
}

function runCommandQuiet(command, args) {
  const result = spawnSync(command, args, {
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  return typeof result.status === "number" ? result.status : 0;
}

function parseOptions(args) {
  const positionals = [];
  const options = {};
  const booleanOptions = new Set(["shell"]);

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    const name = current.slice(2);
    if (booleanOptions.has(name)) {
      options[name] = true;
      continue;
    }

    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      fail(`Missing value for --${name}.`);
    }

    options[name] = value;
    index += 1;
  }

  return {
    positionals,
    options,
  };
}

function writeEnvFile(envFile, instanceName, registryFile, sessionSecret) {
  fs.mkdirSync(path.dirname(envFile), { recursive: true });
  fs.writeFileSync(
    envFile,
    [
      `INSTANCE_NAME=${shellQuote(instanceName)}`,
      `INSTANCE_REGISTRY_FILE=${shellQuote(resolveRegistryFile(registryFile))}`,
      `SESSION_SECRET=${shellQuote(sessionSecret)}`,
      "",
    ].join("\n"),
    "utf8"
  );
  fs.chmodSync(envFile, 0o600);
}

function writeSystemdUnit(serviceName, envFile, serviceUser, serviceGroup) {
  const target = path.join(SYSTEMD_DIR, serviceName);
  fs.writeFileSync(
    target,
    [
      "[Unit]",
      `Description=Curriculum Designer Admin Server (${serviceName})`,
      "After=network-online.target",
      "Wants=network-online.target",
      "",
      "[Service]",
      "Type=simple",
      `User=${serviceUser}`,
      `Group=${serviceGroup}`,
      `WorkingDirectory=${REPO_DIR}`,
      `EnvironmentFile=${envFile}`,
      "ExecStart=/usr/bin/env npm run admin",
      "Restart=always",
      "RestartSec=3",
      "",
      "[Install]",
      "WantedBy=multi-user.target",
      "",
    ].join("\n"),
    "utf8"
  );
}

function writeNginxSnippet(snippetName, webRoot, adminPort) {
  const target = path.join(NGINX_DIR, snippetName);
  fs.mkdirSync(NGINX_DIR, { recursive: true });
  fs.writeFileSync(
    target,
    [
      `root ${webRoot};`,
      "index index.html;",
      "",
      "location = /admin {",
      "  return 301 /admin/;",
      "}",
      "",
      "location /admin/ {",
      `  proxy_pass http://127.0.0.1:${adminPort}/admin/;`,
      "  proxy_set_header Host $host;",
      "  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
      "  proxy_set_header X-Forwarded-Proto $scheme;",
      "}",
      "",
    ].join("\n"),
    "utf8"
  );
}

function ensureInstanceLayout(instanceRoot, serviceUser, serviceGroup) {
  const paths = deriveInstancePaths(REPO_DIR, instanceRoot);

  fs.mkdirSync(paths.themeRoot, { recursive: true });
  fs.mkdirSync(paths.contentRoot, { recursive: true });
  fs.mkdirSync(paths.buildRoot, { recursive: true });
  fs.mkdirSync(paths.webRoot, { recursive: true });
  fs.mkdirSync(paths.adminRuntimeRoot, { recursive: true });

  const themeEntries = fs.existsSync(paths.themeRoot)
    ? fs.readdirSync(paths.themeRoot)
    : [];
  if (themeEntries.length === 0) {
    fs.cpSync(path.join(REPO_DIR, "theme"), paths.themeRoot, { recursive: true });
  }

  if (!fs.existsSync(paths.adminUserFile)) {
    fs.writeFileSync(
      paths.adminUserFile,
      "# One user per line:\n# username:$argon2id$...\n",
      "utf8"
    );
  }

  fs.chmodSync(paths.adminUserFile, 0o600);
  runCommand("chown", ["-R", `${serviceUser}:${serviceGroup}`, paths.instanceRoot]);

  return paths;
}

function createInstance(args) {
  requireRoot();
  requireCleanRepo();
  requireCommand("chown");
  requireCommand("systemctl");

  const { positionals, options } = parseOptions(args);
  const instanceName = positionals[0];
  const instanceRoot = positionals[1];

  if (!instanceName || !instanceRoot) {
    usage();
    process.exit(1);
  }

  const registryFile = resolveRegistryFile(options.registry);
  const resolvedRoot = path.resolve(instanceRoot);
  const adminPort = parseAdminPort(options["admin-port"], 8787);
  const sessionSecret =
    String(options["session-secret"] || "").trim() ||
    crypto.randomBytes(32).toString("hex");
  const serviceUser = String(options["service-user"] || "").trim() || defaultServiceUser();
  const serviceGroup =
    String(options["service-group"] || "").trim() || serviceUser;

  if (adminPort < 1) {
    fail("Admin port must be between 1 and 65535.");
  }

  if (sessionSecret.length < 32) {
    fail("Session secret must be at least 32 characters long.");
  }

  const registry = readRegistryFile(registryFile);
  if (registry.instances[instanceName]) {
    fail(`Instance "${instanceName}" already exists in ${registry.filePath}.`);
  }

  for (const [otherName, otherEntry] of Object.entries(registry.instances)) {
    if (otherEntry.root === resolvedRoot) {
      fail(`Instance root ${resolvedRoot} is already used by "${otherName}".`);
    }
  }

  const envFile = resolveInstanceEnvFile(registry.filePath, instanceName);
  if (fs.existsSync(envFile)) {
    fail(`Instance env file already exists: ${envFile}`);
  }

  const paths = ensureInstanceLayout(resolvedRoot, serviceUser, serviceGroup);
  const registered = registerInstance(registry.filePath, instanceName, {
    root: resolvedRoot,
    adminPort,
  });

  writeEnvFile(envFile, instanceName, registry.filePath, sessionSecret);
  writeSystemdUnit(
    registered.serviceName,
    envFile,
    serviceUser,
    serviceGroup
  );
  writeNginxSnippet(
    registered.nginxSnippetName,
    paths.webRoot,
    registered.adminPort
  );
  runCommand("systemctl", ["daemon-reload"]);

  process.stdout.write(
    [
      `Created instance "${registered.instanceName}".`,
      `Registry: ${registered.registryFile}`,
      `Root: ${registered.root}`,
      `Env file: ${registered.envFile}`,
      `Service: ${registered.serviceName}`,
      `Nginx snippet: /etc/nginx/snippets/${registered.nginxSnippetName}`,
      "",
      "Next steps:",
      `  cd ${shellQuote(REPO_DIR)}`,
      `  INSTANCE_NAME=${shellQuote(registered.instanceName)} npm run admin:users -- set admin`,
      `  systemctl enable --now ${shellQuote(registered.serviceName)}`,
      `  include /etc/nginx/snippets/${registered.nginxSnippetName};`,
      "  nginx -t && systemctl reload nginx",
      `  npm run deploy -- ${shellQuote(registered.instanceName)}`,
      "",
    ].join("\n")
  );
}

function removeFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.rmSync(filePath, { force: true });
  return true;
}

function deleteInstance(args) {
  requireRoot();
  requireCommand("systemctl");

  const { positionals, options } = parseOptions(args);
  const instanceName = positionals[0];
  if (!instanceName) {
    usage();
    process.exit(1);
  }

  const runtime = resolveInstanceRuntime({
    rootDir: REPO_DIR,
    instanceName,
    registryFile: options.registry,
  });

  const removedFiles = [];
  const missingFiles = [];

  runCommandQuiet("systemctl", ["disable", "--now", runtime.serviceName]);

  for (const filePath of [
    runtime.envFile,
    path.join(SYSTEMD_DIR, runtime.serviceName),
    path.join(NGINX_DIR, runtime.nginxSnippetName),
    runtime.paths.adminUserFile,
  ]) {
    if (removeFileIfExists(filePath)) {
      removedFiles.push(filePath);
    } else {
      missingFiles.push(filePath);
    }
  }

  unregisterInstance(runtime.registryFile, runtime.instanceName);
  runCommand("systemctl", ["daemon-reload"]);

  process.stdout.write(
    [
      `Deleted instance "${runtime.instanceName}".`,
      `Registry: ${runtime.registryFile}`,
      `Root kept: ${runtime.paths.instanceRoot}`,
      "",
      "Removed files:",
      ...(removedFiles.length > 0 ? removedFiles.map((filePath) => `  ${filePath}`) : ["  none"]),
      "",
      "Missing files:",
      ...(missingFiles.length > 0 ? missingFiles.map((filePath) => `  ${filePath}`) : ["  none"]),
      "",
      "Before reloading nginx, remove any matching include line from your server config:",
      `  include /etc/nginx/snippets/${runtime.nginxSnippetName};`,
      "",
    ].join("\n")
  );
}

function resolveInstance(args) {
  const { positionals, options } = parseOptions(args);
  const instanceName = positionals[0];
  if (!instanceName) {
    usage();
    process.exit(1);
  }

  const runtime = resolveInstanceRuntime({
    rootDir: REPO_DIR,
    instanceName,
    registryFile: options.registry,
  });

  if (options.shell) {
    const values = {
      INSTANCE_NAME: runtime.instanceName,
      INSTANCE_REGISTRY_FILE: runtime.registryFile,
      INSTANCE_ENV_FILE: runtime.envFile || resolveInstanceEnvFile(runtime.registryFile, runtime.instanceName),
      ADMIN_PORT: String(runtime.adminPort),
      BUILD_ROOT: runtime.paths.buildRoot,
      WEB_ROOT: runtime.paths.webRoot,
      ADMIN_RUNTIME_ROOT: runtime.paths.adminRuntimeRoot,
      ADMIN_USER_FILE: runtime.paths.adminUserFile,
      SERVICE_NAME:
        runtime.serviceName || resolveServiceName(runtime.instanceName),
      NGINX_SNIPPET_NAME:
        runtime.nginxSnippetName || resolveNginxSnippetName(runtime.instanceName),
    };

    for (const [name, value] of Object.entries(values)) {
      process.stdout.write(`${name}=${shellQuote(value)}\n`);
    }
    return;
  }

  process.stdout.write(
    JSON.stringify(
      {
        instanceName: runtime.instanceName,
        registryFile: runtime.registryFile,
        envFile: runtime.envFile || resolveInstanceEnvFile(runtime.registryFile, runtime.instanceName),
        root: runtime.paths.instanceRoot,
        adminPort: runtime.adminPort,
      },
      null,
      2
    ) + "\n"
  );
}

function listInstances(args) {
  const { options } = parseOptions(args);
  const registry = readRegistryFile(options.registry);
  for (const [instanceName, entry] of Object.entries(registry.instances)) {
    process.stdout.write(
      `${instanceName}\t${entry.root}\t${entry.adminPort}\n`
    );
  }
}

function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command) {
    usage();
    process.exit(1);
  }

  try {
    if (command === "create") {
      createInstance(rest);
      return;
    }

    if (command === "resolve") {
      resolveInstance(rest);
      return;
    }

    if (command === "delete") {
      deleteInstance(rest);
      return;
    }

    if (command === "list") {
      listInstances(rest);
      return;
    }
  } catch (error) {
    fail(error.message);
  }

  usage();
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  createInstance,
  deleteInstance,
  listInstances,
  resolveInstance,
};
