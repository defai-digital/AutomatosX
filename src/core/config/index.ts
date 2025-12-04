// Core config barrel export
// Note: loader.js and validator.js both export validateConfig - use explicit re-exports
export {
  loadConfig,
  loadConfigFile,
  clearConfigCache,
  validateConfigWithZod,
  validateConfig as validateConfigLegacy,
  saveConfigFile
} from './loader.js';
export * from './schemas.js';
export {
  validateConfig,
  formatValidationErrors,
  type ValidationResult,
  type ValidationError
} from './validator.js';
export * from './generated.js';
