/**
 * ESLint Rule: no-interval-without-unref
 *
 * Detects setInterval() calls without .unref() and suggests using createSafeInterval() instead.
 *
 * Why: setInterval() without .unref() prevents Node.js from exiting gracefully,
 * causing processes to hang and tests to timeout.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow setInterval without .unref() - use createSafeInterval() instead',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/defai-digital/automatosx/blob/main/tools/eslint-plugin-automatosx/docs/rules/no-interval-without-unref.md'
    },
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          allowWithUnref: {
            type: 'boolean',
            default: true,
            description: 'Allow setInterval if followed by .unref()'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      noSetInterval: 'setInterval() without .unref() blocks process exit. Use createSafeInterval() from "@/shared/utils" instead.',
      noSetIntervalWithUnref: 'setInterval() should use createSafeInterval() from "@/shared/utils" for automatic cleanup.',
      suggestUnref: 'Add .unref() to prevent blocking process exit',
      suggestSafeInterval: 'Replace with createSafeInterval()'
    }
  },

  create(context) {
    const options = context.options[0] || {};
    const allowWithUnref = options.allowWithUnref !== false;

    return {
      CallExpression(node) {
        // Check if this is a setInterval call
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'setInterval'
        ) {
          // Check if the result is immediately chained with .unref()
          const parent = node.parent;
          const hasUnref =
            parent &&
            parent.type === 'MemberExpression' &&
            parent.property &&
            parent.property.type === 'Identifier' &&
            parent.property.name === 'unref';

          // Check if the result is assigned and later has .unref() called
          const hasAssignmentWithUnref = checkAssignmentForUnref(node, context);

          if (hasUnref || hasAssignmentWithUnref) {
            if (!allowWithUnref) {
              context.report({
                node,
                messageId: 'noSetIntervalWithUnref'
                // Note: No auto-fix for complex transformation to createSafeInterval
              });
            }
            // If allowWithUnref is true, don't report
            return;
          }

          // No .unref() found - report error
          // Note: No auto-fix provided - the transformation to createSafeInterval
          // is complex and requires manual intervention
          context.report({
            node,
            messageId: 'noSetInterval'
          });
        }
      }
    };
  }
};

/**
 * Check if a setInterval result is assigned to a variable
 * and that variable later has .unref() called on it.
 *
 * @param {object} node - The setInterval CallExpression node
 * @param {object} context - ESLint context
 * @returns {boolean} True if .unref() is called on the assigned variable
 */
function checkAssignmentForUnref(node, context) {
  const parent = node.parent;

  // Check if assigned to a variable
  if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    const variableName = parent.id.name;
    const scope = context.getScope();

    // Look for .unref() call on this variable in the same scope
    // This is a simplified check - a full check would use data flow analysis
    const sourceCode = context.getSourceCode();
    const functionScope = getFunctionScope(parent);

    if (functionScope) {
      const functionText = sourceCode.getText(functionScope);

      // Simple regex check for variableName.unref() or variableName?.unref()
      const unrefPattern = new RegExp(
        `${escapeRegExp(variableName)}(?:\\??\\.unref\\(\\)|\\s*&&\\s*${escapeRegExp(variableName)}\\.unref\\(\\))`,
        'g'
      );

      if (unrefPattern.test(functionText)) {
        return true;
      }

      // Check for conditional unref pattern: if (x.unref) x.unref()
      const conditionalPattern = new RegExp(
        `if\\s*\\(\\s*${escapeRegExp(variableName)}\\.unref\\s*\\)`,
        'g'
      );

      if (conditionalPattern.test(functionText)) {
        return true;
      }
    }
  }

  // Check for assignment expression (not declaration)
  if (parent && parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier') {
    // Similar check for assignment expressions
    const variableName = parent.left.name;
    const sourceCode = context.getSourceCode();
    const functionScope = getFunctionScope(parent);

    if (functionScope) {
      const functionText = sourceCode.getText(functionScope);
      const unrefPattern = new RegExp(
        `${escapeRegExp(variableName)}(?:\\??\\.unref\\(\\))`,
        'g'
      );

      if (unrefPattern.test(functionText)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get the function scope containing a node
 */
function getFunctionScope(node) {
  let current = node;

  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'MethodDefinition' ||
      current.type === 'Program'
    ) {
      return current;
    }
    current = current.parent;
  }

  return null;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
