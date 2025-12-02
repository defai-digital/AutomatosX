/**
 * Agent Template Engine - v5.0+
 *
 * Provides variable substitution for agent templates.
 * Supports:
 * - Simple variables: {{AGENT_NAME}}
 * - Default values: {{ROLE | default: Software Developer}}
 * - Nested objects and arrays
 *
 * @module agents/template-engine
 * @since v5.0.0
 */

/**
 * Template variables for agent creation
 */
export interface TemplateVariables {
  /** Agent name (required) */
  AGENT_NAME: string;

  /** Display name (required) */
  DISPLAY_NAME: string;

  /** Agent role (optional) */
  ROLE?: string;

  /** Agent description (optional) */
  DESCRIPTION?: string;

  /** Team name (optional) */
  TEAM?: string;

  /** Additional custom variables */
  [key: string]: string | undefined;
}

/**
 * Template Engine for agent configuration
 *
 * @example
 * ```typescript
 * const engine = new TemplateEngine();
 * const result = engine.render(template, {
 *   AGENT_NAME: 'backend-api',
 *   DISPLAY_NAME: 'Bob',
 *   ROLE: 'Senior Backend Engineer'
 * });
 * ```
 */
export class TemplateEngine {
  /**
   * Regex for variable placeholders: {{VAR_NAME}} or {{VAR_NAME | default: value}}
   */
  private static readonly VARIABLE_REGEX = /\{\{([^}|]+)(?:\s*\|\s*default:\s*([^}]+))?\}\}/g;

  /**
   * Render template with variables
   *
   * @param template - Template string with {{VARIABLE}} placeholders
   * @param variables - Variables to substitute
   * @returns Rendered string
   *
   * @example
   * ```typescript
   * const result = engine.render(
   *   'Hello {{NAME | default: World}}!',
   *   { NAME: 'Alice' }
   * );
   * // Result: "Hello Alice!"
   * ```
   */
  render(template: string, variables: TemplateVariables): string {
    return template.replace(
      TemplateEngine.VARIABLE_REGEX,
      (match, varName, defaultValue) => {
        const trimmedName = varName.trim();
        const value = variables[trimmedName];

        // Use provided value, or default, or keep original placeholder
        if (value !== undefined && value !== null) {
          return value;
        }

        if (defaultValue !== undefined) {
          return defaultValue.trim();
        }

        // Keep original placeholder if no value and no default
        return match;
      }
    );
  }

  /**
   * Render template object (YAML content parsed as object)
   *
   * Recursively processes all string values in the object.
   *
   * @param obj - Object to render (parsed YAML)
   * @param variables - Variables to substitute
   * @returns Rendered object
   *
   * @example
   * ```typescript
   * const template = {
   *   name: '{{AGENT_NAME}}',
   *   role: '{{ROLE | default: Developer}}'
   * };
   * const result = engine.renderObject(template, { AGENT_NAME: 'backend' });
   * // Result: { name: 'backend', role: 'Developer' }
   * ```
   */
  renderObject<T extends Record<string, any>>(
    obj: T,
    variables: TemplateVariables
  ): T {
    const result: any = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
      const value = obj[key];

      if (typeof value === 'string') {
        // Render string values
        result[key] = this.render(value, variables);
      } else if (typeof value === 'object' && value !== null) {
        // Recursively render nested objects/arrays
        result[key] = this.renderObject(value, variables);
      } else {
        // Keep other types as-is
        result[key] = value;
      }
    }

    return result as T;
  }

  /**
   * Validate that all required variables are provided
   *
   * @param template - Template string
   * @param variables - Provided variables
   * @returns Array of missing required variable names
   *
   * @example
   * ```typescript
   * const missing = engine.validateVariables(
   *   'Name: {{NAME}}, Role: {{ROLE | default: Dev}}',
   *   { ROLE: 'Engineer' }
   * );
   * // Result: ['NAME'] (ROLE is optional because it has default)
   * ```
   */
  validateVariables(
    template: string,
    variables: TemplateVariables
  ): string[] {
    const missing: string[] = [];
    const regex = new RegExp(TemplateEngine.VARIABLE_REGEX, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      if (!match[1]) continue; // Skip if capture group is missing
      const varName = match[1].trim();
      const hasDefault = match[2] !== undefined;

      // Required if no default value and not provided
      if (!hasDefault && variables[varName] === undefined) {
        if (!missing.includes(varName)) {
          missing.push(varName);
        }
      }
    }

    return missing;
  }

  /**
   * Extract all variable names from template
   *
   * @param template - Template string
   * @returns Array of variable names (without {{}} and defaults)
   *
   * @example
   * ```typescript
   * const vars = engine.extractVariables('{{NAME}} and {{ROLE | default: Dev}}');
   * // Result: ['NAME', 'ROLE']
   * ```
   */
  extractVariables(template: string): string[] {
    const variables: string[] = [];
    const regex = new RegExp(TemplateEngine.VARIABLE_REGEX, 'g');

    let match: RegExpExecArray | null;
    while ((match = regex.exec(template)) !== null) {
      if (!match[1]) continue; // Skip if capture group is missing
      const varName = match[1].trim();
      if (!variables.includes(varName)) {
        variables.push(varName);
      }
    }

    return variables;
  }
}

/**
 * Singleton instance for convenience
 */
export const templateEngine = new TemplateEngine();
