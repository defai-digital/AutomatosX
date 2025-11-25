// src/config/loader.ts
import { readFile, stat } from "fs/promises";
import { join, resolve } from "path";
import { parse as parseYaml } from "yaml";
import {
  ConfigSchema,
  DEFAULT_CONFIG,
  validateConfig,
  mergeConfig
} from "@ax/schemas";
var CONFIG_FILE_NAMES = ["ax.config.json", "ax.config.yaml", "ax.config.yml"];
var MAX_PARENT_SEARCH = 10;
var MAX_TIMEOUT_MS = 36e5;
var DEBUG_TRUE_VALUES = ["true", "1"];
async function findConfigFile(startDir, searchParents = true) {
  let currentDir = resolve(startDir);
  let searchCount = 0;
  while (searchCount < MAX_PARENT_SEARCH) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const configPath = join(currentDir, fileName);
      try {
        const stats = await stat(configPath);
        if (stats.isFile()) {
          return configPath;
        }
      } catch {
      }
    }
    if (!searchParents) {
      break;
    }
    const parentDir = resolve(currentDir, "..");
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
    searchCount++;
  }
  return null;
}
async function parseConfigFile(configPath) {
  const content = await readFile(configPath, "utf-8");
  if (configPath.endsWith(".json")) {
    return JSON.parse(content);
  } else if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
    return parseYaml(content);
  }
  throw new Error(`Unsupported config file format: ${configPath}`);
}
function getEnvOverrides(prefix = "AX") {
  const overrides = {};
  const provider = process.env[`${prefix}_PROVIDER`];
  if (provider) {
    overrides["providers"] = { default: provider };
  }
  const debug = process.env[`${prefix}_DEBUG`];
  if (debug && DEBUG_TRUE_VALUES.includes(debug)) {
    overrides["logging"] = { level: "debug" };
  }
  const timeout = process.env[`${prefix}_TIMEOUT`];
  if (timeout) {
    const timeoutMs = parseInt(timeout, 10);
    if (!isNaN(timeoutMs) && timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS) {
      overrides["execution"] = { timeout: timeoutMs };
    } else {
      console.warn(
        `[ax/config] Invalid ${prefix}_TIMEOUT value "${timeout}". Expected positive integer between 1 and ${MAX_TIMEOUT_MS} (ms). Using default.`
      );
    }
  }
  return overrides;
}
async function loadConfig(options = {}) {
  const {
    baseDir = process.cwd(),
    fileName,
    envPrefix = "AX",
    searchParents = true
  } = options;
  let configPath = null;
  let fileConfig = {};
  if (fileName) {
    configPath = join(baseDir, fileName);
    try {
      fileConfig = await parseConfigFile(configPath);
    } catch (error) {
      console.warn(
        `[ax/config] Failed to parse specified config file ${configPath}: ${error instanceof Error ? error.message : "Unknown error"}. Using defaults.`
      );
      configPath = null;
    }
  } else {
    configPath = await findConfigFile(baseDir, searchParents);
    if (configPath) {
      try {
        fileConfig = await parseConfigFile(configPath);
      } catch (error) {
        throw new Error(
          `Failed to parse config file ${configPath}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }
  const envOverrides = getEnvOverrides(envPrefix);
  const mergeSection = (key) => ({
    ...DEFAULT_CONFIG[key],
    ...fileConfig[key] ?? {},
    ...envOverrides[key] ?? {}
  });
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envOverrides,
    // Deep merge for all nested objects using helper
    providers: mergeSection("providers"),
    execution: mergeSection("execution"),
    memory: mergeSection("memory"),
    session: mergeSection("session"),
    checkpoint: mergeSection("checkpoint"),
    router: mergeSection("router"),
    workspace: mergeSection("workspace"),
    logging: mergeSection("logging")
  };
  const config = validateConfig(mergedConfig);
  let source = "default";
  if (Object.keys(envOverrides).length > 0) {
    source = "env";
  } else if (configPath) {
    source = "file";
  }
  return {
    config,
    configPath,
    source
  };
}
function loadConfigSync() {
  const envOverrides = getEnvOverrides("AX");
  return mergeConfig(envOverrides);
}
function getDefaultConfig() {
  return { ...DEFAULT_CONFIG };
}
function isValidConfig(config) {
  try {
    ConfigSchema.parse(config);
    return true;
  } catch {
    return false;
  }
}
export {
  getDefaultConfig,
  isValidConfig,
  loadConfig,
  loadConfigSync
};
/**
 * Configuration Loader
 *
 * Loads and validates AutomatosX configuration from ax.config.json
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
/**
 * Configuration Module
 *
 * Loads and validates AutomatosX configuration from files and environment.
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */
//# sourceMappingURL=index.js.map