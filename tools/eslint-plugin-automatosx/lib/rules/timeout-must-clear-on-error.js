/**
 * ESLint Rule: timeout-must-clear-on-error
 *
 * Detects setTimeout usage in Promise contexts where the timeout is not
 * cleared in the error/reject path.
 *
 * Why: If a promise rejects before the timeout fires, but the timeout
 * is not cleared, it will fire later and potentially cause unexpected behavior
 * or resource leaks.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require clearTimeout in both success and error paths of promise timeouts',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/defai-digital/automatosx/blob/main/tools/eslint-plugin-automatosx/docs/rules/timeout-must-clear-on-error.md'
    },
    fixable: null, // Cannot auto-fix - complex control flow
    hasSuggestions: true,
    schema: [],
    messages: {
      timeoutNotCleared: 'setTimeout in promise/async context should be cleared in both success and error paths. Consider using withTimeout() from "@/shared/utils".',
      suggestWithTimeout: 'Use withTimeout() utility for automatic cleanup',
      suggestTryFinally: 'Wrap in try/finally with clearTimeout in finally block'
    }
  },

  create(context) {
    // Track setTimeout assignments in promise/async contexts
    const timeoutVars = new Map(); // variableName -> { node, cleared: { success: boolean, error: boolean } }

    return {
      // Track setTimeout assignments
      VariableDeclarator(node) {
        if (
          node.init &&
          node.init.type === 'CallExpression' &&
          node.init.callee.type === 'Identifier' &&
          node.init.callee.name === 'setTimeout' &&
          node.id.type === 'Identifier'
        ) {
          // Check if we're in a Promise or async context
          if (isInPromiseOrAsyncContext(node)) {
            timeoutVars.set(node.id.name, {
              node: node.init,
              declarationNode: node,
              cleared: { success: false, error: false }
            });
          }
        }
      },

      // Track clearTimeout calls
      CallExpression(node) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'clearTimeout' &&
          node.arguments.length > 0 &&
          node.arguments[0].type === 'Identifier'
        ) {
          const varName = node.arguments[0].name;

          if (timeoutVars.has(varName)) {
            const info = timeoutVars.get(varName);

            // Determine if this clearTimeout is in a success or error path
            const pathInfo = getClearTimeoutContext(node);

            if (pathInfo.isSuccess) {
              info.cleared.success = true;
            }
            if (pathInfo.isError) {
              info.cleared.error = true;
            }
            if (pathInfo.isFinally) {
              // finally block covers both paths
              info.cleared.success = true;
              info.cleared.error = true;
            }
          }
        }
      },

      // Check at end of function scope
      'FunctionDeclaration:exit': checkTimeoutClearing,
      'FunctionExpression:exit': checkTimeoutClearing,
      'ArrowFunctionExpression:exit': checkTimeoutClearing,
      'Program:exit': checkTimeoutClearing
    };

    function checkTimeoutClearing(node) {
      // Only check if this is an async function or contains promises
      if (!isAsyncFunction(node) && !containsPromise(node)) {
        return;
      }

      for (const [varName, info] of timeoutVars.entries()) {
        // Check if this timeout is in this scope
        if (!isInScope(info.declarationNode, node)) {
          continue;
        }

        // Check if timeout was cleared in both paths
        if (!info.cleared.success || !info.cleared.error) {
          const missingPaths = [];
          if (!info.cleared.success) missingPaths.push('success');
          if (!info.cleared.error) missingPaths.push('error/catch');

          context.report({
            node: info.node,
            messageId: 'timeoutNotCleared',
            data: { varName, missingPaths: missingPaths.join(' and ') },
            suggest: [
              {
                messageId: 'suggestWithTimeout',
                fix: null // Complex, manual fix needed
              },
              {
                messageId: 'suggestTryFinally',
                fix: null // Complex, manual fix needed
              }
            ]
          });
        }
      }

      // Clear tracked timeouts for this scope
      for (const [varName, info] of timeoutVars.entries()) {
        if (isInScope(info.declarationNode, node)) {
          timeoutVars.delete(varName);
        }
      }
    }
  }
};

/**
 * Check if a node is within a Promise or async context
 */
function isInPromiseOrAsyncContext(node) {
  let current = node.parent;

  while (current) {
    // Check for async function
    if (
      (current.type === 'FunctionDeclaration' ||
       current.type === 'FunctionExpression' ||
       current.type === 'ArrowFunctionExpression') &&
      current.async
    ) {
      return true;
    }

    // Check for Promise constructor
    if (
      current.type === 'NewExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === 'Promise'
    ) {
      return true;
    }

    // Check for .then() or .catch() callback
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'MemberExpression' &&
      current.callee.property.type === 'Identifier' &&
      ['then', 'catch', 'finally'].includes(current.callee.property.name)
    ) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

/**
 * Determine the context of a clearTimeout call
 */
function getClearTimeoutContext(node) {
  let current = node.parent;
  const result = { isSuccess: false, isError: false, isFinally: false };

  while (current) {
    // Check for try/catch/finally
    if (current.type === 'TryStatement') {
      // Determine which block we're in
      if (isInBlock(node, current.block)) {
        result.isSuccess = true;
      }
      if (current.handler && isInBlock(node, current.handler.body)) {
        result.isError = true;
      }
      if (current.finalizer && isInBlock(node, current.finalizer)) {
        result.isFinally = true;
      }
      break;
    }

    // Check for .catch() callback
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'MemberExpression' &&
      current.callee.property.type === 'Identifier'
    ) {
      const methodName = current.callee.property.name;

      if (methodName === 'catch') {
        result.isError = true;
        break;
      }
      if (methodName === 'finally') {
        result.isFinally = true;
        break;
      }
      if (methodName === 'then') {
        // Could be success or error callback
        // then(onSuccess, onError)
        const callbackIndex = getCallbackIndex(node, current);
        if (callbackIndex === 0) {
          result.isSuccess = true;
        } else if (callbackIndex === 1) {
          result.isError = true;
        }
        break;
      }
    }

    // Check for Promise executor
    if (
      current.type === 'NewExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === 'Promise'
    ) {
      // Inside Promise constructor - could be either path
      // Check if we're in a reject call's scope
      if (isInRejectPath(node, current)) {
        result.isError = true;
      } else {
        result.isSuccess = true;
      }
      break;
    }

    current = current.parent;
  }

  // Default to success if we couldn't determine
  if (!result.isSuccess && !result.isError && !result.isFinally) {
    result.isSuccess = true;
  }

  return result;
}

/**
 * Check if a node is inside a block
 */
function isInBlock(node, block) {
  if (!block) return false;

  let current = node;
  while (current) {
    if (current === block) return true;
    current = current.parent;
  }
  return false;
}

/**
 * Get which callback argument index a node is in
 */
function getCallbackIndex(node, callExpression) {
  let current = node;

  while (current && current.parent !== callExpression) {
    current = current.parent;
  }

  if (!current) return -1;

  return callExpression.arguments.indexOf(current);
}

/**
 * Check if we're in a reject path within a Promise constructor
 */
function isInRejectPath(node, promiseNode) {
  // This is a simplified check - look for reject() call in the path
  let current = node;

  while (current && current !== promiseNode) {
    if (
      current.type === 'CallExpression' &&
      current.callee.type === 'Identifier' &&
      current.callee.name === 'reject'
    ) {
      return true;
    }
    current = current.parent;
  }

  return false;
}

/**
 * Check if a function is async
 */
function isAsyncFunction(node) {
  return (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) && node.async;
}

/**
 * Check if a node contains a Promise
 */
function containsPromise(node) {
  // Simplified check - look for Promise in the source
  // A more thorough check would traverse the AST
  return true; // Always check for now
}

/**
 * Check if a declaration is in a function scope
 */
function isInScope(declaration, functionNode) {
  let current = declaration;

  while (current) {
    if (current === functionNode) return true;
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      return false; // In a different function scope
    }
    current = current.parent;
  }

  return functionNode.type === 'Program'; // Global scope
}
