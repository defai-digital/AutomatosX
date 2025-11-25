/**
 * Configuration Module
 *
 * Loads and validates AutomatosX configuration from files and environment.
 *
 * @module @ax/core/config
 * @license Apache-2.0
 * @copyright 2024 DEFAI Private Limited
 */

export {
  loadConfig,
  loadConfigSync,
  getDefaultConfig,
  isValidConfig,
  type ConfigLoaderOptions,
  type LoadedConfig,
} from './loader.js';
