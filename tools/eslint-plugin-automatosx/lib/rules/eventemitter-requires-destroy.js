/**
 * ESLint Rule: eventemitter-requires-destroy
 *
 * Detects classes extending EventEmitter that don't have a destroy() method.
 *
 * Why: EventEmitter instances that register listeners (on, once, addListener)
 * need a destroy() method that calls removeAllListeners() to prevent memory leaks.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Require destroy() method in classes extending EventEmitter',
      category: 'Possible Errors',
      recommended: true,
      url: 'https://github.com/defai-digital/automatosx/blob/main/tools/eslint-plugin-automatosx/docs/rules/eventemitter-requires-destroy.md'
    },
    fixable: null, // Cannot auto-fix - requires implementation
    hasSuggestions: true,
    schema: [
      {
        type: 'object',
        properties: {
          baseClasses: {
            type: 'array',
            items: { type: 'string' },
            default: ['EventEmitter', 'DisposableEventEmitter'],
            description: 'Base class names to check for'
          },
          allowAbstract: {
            type: 'boolean',
            default: true,
            description: 'Allow abstract classes without destroy()'
          }
        },
        additionalProperties: false
      }
    ],
    messages: {
      missingDestroy: 'Class "{{className}}" extends {{baseClass}} but does not have a destroy() method. Add destroy() that calls removeAllListeners() or extend DisposableEventEmitter.',
      suggestDisposable: 'Extend DisposableEventEmitter instead of EventEmitter for automatic cleanup',
      suggestDestroy: 'Add destroy() method with removeAllListeners()'
    }
  },

  create(context) {
    const options = context.options[0] || {};
    const baseClasses = options.baseClasses || ['EventEmitter', 'DisposableEventEmitter'];
    const allowAbstract = options.allowAbstract !== false;

    return {
      ClassDeclaration(node) {
        checkClass(node, context, baseClasses, allowAbstract);
      },
      ClassExpression(node) {
        checkClass(node, context, baseClasses, allowAbstract);
      }
    };
  }
};

/**
 * Check a class for destroy() method
 */
function checkClass(node, context, baseClasses, allowAbstract) {
  // Check if class extends one of the base classes
  if (!node.superClass) {
    return;
  }

  const superClassName = getSuperClassName(node.superClass);
  if (!superClassName || !baseClasses.includes(superClassName)) {
    return;
  }

  // Skip DisposableEventEmitter (it has destroy() built-in)
  if (superClassName === 'DisposableEventEmitter') {
    return;
  }

  // Check if this is an abstract class (has abstract keyword in TypeScript)
  // Note: ESLint parses TypeScript with @typescript-eslint/parser
  if (allowAbstract && isAbstractClass(node)) {
    return;
  }

  const className = node.id ? node.id.name : '(anonymous)';

  // Check if class has destroy() method
  const hasDestroy = node.body.body.some(member => {
    if (member.type === 'MethodDefinition' && member.key) {
      const methodName = member.key.type === 'Identifier'
        ? member.key.name
        : member.key.type === 'Literal'
          ? member.key.value
          : null;

      return methodName === 'destroy';
    }
    return false;
  });

  if (!hasDestroy) {
    context.report({
      node: node.id || node,
      messageId: 'missingDestroy',
      data: {
        className,
        baseClass: superClassName
      },
      suggest: [
        {
          messageId: 'suggestDisposable',
          fix(fixer) {
            // Replace EventEmitter with DisposableEventEmitter
            if (node.superClass && node.superClass.type === 'Identifier') {
              return fixer.replaceText(node.superClass, 'DisposableEventEmitter');
            }
            return null;
          }
        },
        {
          messageId: 'suggestDestroy',
          fix(fixer) {
            // Add a destroy() method stub
            // Find the last method in the class body
            const classBody = node.body;
            const lastMember = classBody.body[classBody.body.length - 1];

            if (lastMember) {
              const sourceCode = context.getSourceCode();
              const indent = getIndentation(sourceCode, lastMember);

              const destroyMethod = `\n\n${indent}/**\n${indent} * Clean up resources and remove all event listeners.\n${indent} */\n${indent}destroy(): void {\n${indent}  this.removeAllListeners();\n${indent}}`;

              return fixer.insertTextAfter(lastMember, destroyMethod);
            }

            return null;
          }
        }
      ]
    });
  }
}

/**
 * Get the super class name from a node
 */
function getSuperClassName(superClass) {
  if (superClass.type === 'Identifier') {
    return superClass.name;
  }

  // Handle MemberExpression like events.EventEmitter
  if (superClass.type === 'MemberExpression' && superClass.property.type === 'Identifier') {
    return superClass.property.name;
  }

  return null;
}

/**
 * Check if a class is abstract (TypeScript)
 */
function isAbstractClass(node) {
  // Check for TypeScript abstract modifier
  // The node may have `abstract: true` if using @typescript-eslint/parser
  if (node.abstract) {
    return true;
  }

  // Check decorators or modifiers array
  if (node.modifiers) {
    return node.modifiers.some(mod =>
      mod.type === 'TSAbstractKeyword' ||
      (mod.type === 'Keyword' && mod.name === 'abstract')
    );
  }

  return false;
}

/**
 * Get the indentation of a node
 */
function getIndentation(sourceCode, node) {
  const lines = sourceCode.getText(node).split('\n');
  const firstLine = sourceCode.lines[node.loc.start.line - 1] || '';
  const match = firstLine.match(/^(\s*)/);
  return match ? match[1] : '  ';
}
