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

function normalizeServerName(instanceName, value) {
  const fallback = normalizeInstanceName(instanceName);
  const serverName = String(value || "").trim();

  if (!serverName) {
    throw new Error(`Registry entry for "${fallback}" requires "serverName".`);
  }

  if (/[;\r\n]/.test(serverName)) {
    throw new Error(
      `Invalid serverName for "${fallback}". Semicolons and line breaks are not allowed.`
    );
  }

  return serverName;
}

function normalizeOptionalPath(instanceName, fieldName, value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  if (/[;\r\n]/.test(trimmed)) {
    throw new Error(
      `Invalid ${fieldName} for "${normalizeInstanceName(instanceName)}". Semicolons and line breaks are not allowed.`
    );
  }

  return path.resolve(trimmed);
}

function resolveNginxSiteName(instanceName) {
  return `curriculum-designer-${normalizeInstanceName(instanceName)}.conf`;
}

function normalizeContentRoot(instanceName, root, value) {
  const normalizedRoot = path.resolve(root);
  const defaultContentRoot = path.join(normalizedRoot, "content");
  const contentRoot = normalizeOptionalPath(instanceName, "contentRoot", value);

  if (!contentRoot || contentRoot === defaultContentRoot) {
    return "";
  }

  return contentRoot;
}

function normalizeRegistryEntry(name, entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Registry entry for "${name}" must be an object.`);
  }

  const root = String(entry.root || "").trim();
  if (!root) {
    throw new Error(`Registry entry for "${name}" requires "root".`);
  }

  const sslCertificate = normalizeOptionalPath(name, "sslCertificate", entry.sslCertificate);
  const sslCertificateKey = normalizeOptionalPath(
    name,
    "sslCertificateKey",
    entry.sslCertificateKey
  );

  if (Boolean(sslCertificate) !== Boolean(sslCertificateKey)) {
    throw new Error(
      `Registry entry for "${name}" must define both "sslCertificate" and "sslCertificateKey" or neither.`
    );
  }

  const contentRoot = normalizeContentRoot(name, root, entry.contentRoot);
  const normalizedEntry = {
    root: path.resolve(root),
    adminPort: parseAdminPort(entry.adminPort, DEFAULT_ADMIN_PORT),
    serverName: normalizeServerName(name, entry.serverName),
    sslCertificate,
    sslCertificateKey,
  };

  if (contentRoot) {
    normalizedEntry.contentRoot = contentRoot;
  }

  return normalizedEntry;
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

function unregisterInstance(registryFileValue, instanceName) {
  const name = normalizeInstanceName(instanceName);
  const registry = readRegistryFile(registryFileValue);

  if (!registry.instances[name]) {
    throw new Error(`Instance "${name}" is not registered in ${registry.filePath}.`);
  }

  delete registry.instances[name];
  return writeRegistryFile(registry.filePath, registry);
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
    nginxSiteName: resolveNginxSiteName(name),
    root: entry.root,
    contentRoot: entry.contentRoot || path.join(entry.root, "content"),
    adminPort: entry.adminPort,
    serverName: entry.serverName,
    sslCertificate: entry.sslCertificate,
    sslCertificateKey: entry.sslCertificateKey,
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
    nginxSiteName: registered.nginxSiteName,
    paths: deriveInstancePaths(rootDir, registered.root, {
      contentRoot: registered.contentRoot,
    }),
    adminPort: parseAdminPort(input.adminPort, registered.adminPort),
    serverName: registered.serverName,
    sslCertificate: registered.sslCertificate,
    sslCertificateKey: registered.sslCertificateKey,
  };
}

module.exports = {
  DEFAULT_INSTANCE_REGISTRY_FILE,
  normalizeInstanceName,
  normalizeServerName,
  readRegistryFile,
  registerInstance,
  resolveInstanceEnvFile,
  resolveInstanceRuntime,
  resolveNginxSiteName,
  resolveRegisteredInstance,
  resolveRegistryFile,
  resolveServiceName,
  unregisterInstance,
  writeRegistryFile,
};
