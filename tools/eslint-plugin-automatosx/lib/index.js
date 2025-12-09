/**
 * ESLint Plugin: eslint-plugin-automatosx
 *
 * Custom ESLint rules for AutomatosX to prevent common bugs:
 * - Timer leaks (setInterval without .unref())
 * - EventEmitter memory leaks (missing destroy())
 * - Promise timeout leaks (setTimeout not cleared on error)
 *
 * @module eslint-plugin-automatosx
 * @since v12.4.0
 */

'use strict';

const noIntervalWithoutUnref = require('./rules/no-interval-without-unref');
const eventemitterRequiresDestroy = require('./rules/eventemitter-requires-destroy');
const timeoutMustClearOnError = require('./rules/timeout-must-clear-on-error');

module.exports = {
  meta: {
    name: 'eslint-plugin-automatosx',
    version: '1.0.0'
  },

  rules: {
    'no-interval-without-unref': noIntervalWithoutUnref,
    'eventemitter-requires-destroy': eventemitterRequiresDestroy,
    'timeout-must-clear-on-error': timeoutMustClearOnError
  },

  configs: {
    /**
     * Recommended configuration - enable all rules as errors
     */
    recommended: {
      plugins: ['automatosx'],
      rules: {
        'automatosx/no-interval-without-unref': 'error',
        'automatosx/eventemitter-requires-destroy': 'error',
        'automatosx/timeout-must-clear-on-error': 'warn'
      }
    },

    /**
     * Strict configuration - all rules as errors, stricter options
     */
    strict: {
      plugins: ['automatosx'],
      rules: {
        'automatosx/no-interval-without-unref': ['error', { allowWithUnref: false }],
        'automatosx/eventemitter-requires-destroy': ['error', { allowAbstract: false }],
        'automatosx/timeout-must-clear-on-error': 'error'
      }
    },

    /**
     * Lenient configuration - warnings only
     */
    lenient: {
      plugins: ['automatosx'],
      rules: {
        'automatosx/no-interval-without-unref': 'warn',
        'automatosx/eventemitter-requires-destroy': 'warn',
        'automatosx/timeout-must-clear-on-error': 'off'
      }
    }
  }
};
