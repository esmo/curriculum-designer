"use strict";

const fs = require("node:fs");
const path = require("node:path");

const {
  DEFAULT_ADMIN_PORT,
  deriveInstancePaths,
  parseAdminPort,
} = require("./instance");

const DEFAULT_INSTANCE_REGISTRY_FILE = "/etc/curriculum-designer/instances.json";

function normalizeInstanceName(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("Instance name must not be empty.");
  }

  if (/[^A-Za-z0-9_-]/.test(normalized)) {
    throw new Error(
      `Invalid instance name "${normalized}". Use only letters, numbers, _ and -.`
    );
  }

  return normalized;
}

function resolveRegistryFile(value) {
  const rawValue = String(value || "").trim();
  return path.resolve(rawValue || DEFAULT_INSTANCE_REGISTRY_FILE);
}

function resolveInstanceEnvFile(registryFile, instanceName) {
  return path.join(
    path.dirname(resolveRegistryFile(registryFile)),
    "instances",
    `${normalizeInstanceName(instanceName)}.env`
  );
}

function resolveServiceName(instanceName) {
  return `curriculum-designer-admin-${normalizeInstanceName(instanceName)}.service`;
}

function resolveNginxSnippetName(instanceName) {
  return `curriculum-designer-${normalizeInstanceName(instanceName)}.conf`;
}

function normalizeRegistryEntry(name, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Registry entry for "${name}" must be an object.`);
  }

  const root = String(entry.root || "").trim();
  if (!root) {
    throw new Error(`Registry entry for "${name}" requires "root".`);
  }

  return {
    root: path.resolve(root),
    adminPort: parseAdminPort(entry.adminPort, DEFAULT_ADMIN_PORT),
  };
}

function readRegistryFile(registryFileValue) {
  const filePath = resolveRegistryFile(registryFileValue);

  if (!fs.existsSync(filePath)) {
    return {
      filePath,
      instances: {},
    };
  }

  const rawText = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(rawText);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Registry file ${filePath} must contain a JSON object.`);
  }

  const inputInstances =
    parsed.instances && typeof parsed.instances === "object" && !Array.isArray(parsed.instances)
      ? parsed.instances
      : {};

  const instances = {};
  for (const [rawName, rawEntry] of Object.entries(inputInstances)) {
    const name = normalizeInstanceName(rawName);
    instances[name] = normalizeRegistryEntry(name, rawEntry);
  }

  return {
    filePath,
    instances,
  };
}

function writeRegistryFile(registryFileValue, registry) {
  const filePath = resolveRegistryFile(registryFileValue);
  const instances = registry && registry.instances ? registry.instances : {};
  const sortedInstances = {};

  for (const name of Object.keys(instances).sort()) {
    const normalizedName = normalizeInstanceName(name);
    sortedInstances[normalizedName] = normalizeRegistryEntry(
      normalizedName,
      instances[name]
    );
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        instances: sortedInstances,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  return {
    filePath,
    instances: sortedInstances,
  };
}

function registerInstance(registryFileValue, instanceName, entry) {
  const name = normalizeInstanceName(instanceName);
  const registry = readRegistryFile(registryFileValue);
  registry.instances[name] = normalizeRegistryEntry(name, entry);
  writeRegistryFile(registry.filePath, registry);
  return resolveRegisteredInstance(name, registry.filePath);
}

function resolveRegisteredInstance(instanceName, registryFileValue) {
  const name = normalizeInstanceName(instanceName);
  const registry = readRegistryFile(registryFileValue);
  const entry = registry.instances[name];

  if (!entry) {
    throw new Error(`Instance "${name}" is not registered in ${registry.filePath}.`);
  }

  return {
    instanceName: name,
    registryFile: registry.filePath,
    envFile: resolveInstanceEnvFile(registry.filePath, name),
    serviceName: resolveServiceName(name),
    nginxSnippetName: resolveNginxSnippetName(name),
    root: entry.root,
    adminPort: entry.adminPort,
  };
}

function resolveInstanceRuntime(input) {
  const rootDir = path.resolve(input.rootDir || process.cwd());
  const explicitName = String(input.instanceName || "").trim();
  if (!explicitName) {
    throw new Error("INSTANCE_NAME must be set.");
  }

  const registered = resolveRegisteredInstance(explicitName, input.registryFile);
  return {
    instanceName: registered.instanceName,
    registryFile: registered.registryFile,
    envFile: registered.envFile,
    serviceName: registered.serviceName,
    nginxSnippetName: registered.nginxSnippetName,
    paths: deriveInstancePaths(rootDir, registered.root),
    adminPort: parseAdminPort(input.adminPort, registered.adminPort),
  };
}

module.exports = {
  DEFAULT_INSTANCE_REGISTRY_FILE,
  normalizeInstanceName,
  readRegistryFile,
  registerInstance,
  resolveInstanceEnvFile,
  resolveInstanceRuntime,
  resolveNginxSnippetName,
  resolveRegisteredInstance,
  resolveRegistryFile,
  resolveServiceName,
  writeRegistryFile,
};
