/**
 * Template Engine Tests
 */

import { describe, it, expect } from 'vitest';
import { TemplateEngine, type TemplateVariables } from '../../src/agents/template-engine.js';

describe('TemplateEngine', () => {
  const engine = new TemplateEngine();

  describe('render()', () => {
    it('should replace simple variables', () => {
      const template = 'Hello {{NAME}}!';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        NAME: 'Alice'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Hello Alice!');
    });

    it('should use default values when variable is missing', () => {
      const template = 'Role: {{ROLE | default: Developer}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Role: Developer');
    });

    it('should use provided value over default', () => {
      const template = 'Role: {{ROLE | default: Developer}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        ROLE: 'Senior Engineer'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Role: Senior Engineer');
    });

    it('should handle multiple variables', () => {
      const template = '{{AGENT_NAME}} - {{DISPLAY_NAME}} ({{ROLE}})';
      const variables: TemplateVariables = {
        AGENT_NAME: 'backend-api',
        DISPLAY_NAME: 'Bob',
        ROLE: 'Backend Engineer'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('backend-api - Bob (Backend Engineer)');
    });

    it('should trim whitespace in variable names and defaults', () => {
      const template = '{{ NAME  |  default:  Default Value  }}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Default Value');
    });

    it('should keep placeholder if no value and no default', () => {
      const template = 'Name: {{UNKNOWN_VAR}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Name: {{UNKNOWN_VAR}}');
    });

    it('should handle empty string as valid value', () => {
      const template = 'Value: {{VAR | default: Default}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        VAR: ''
      };

      const result = engine.render(template, variables);
      expect(result).toBe('Value: ');
    });
  });

  describe('renderObject()', () => {
    it('should render all string values in object', () => {
      const template = {
        name: '{{AGENT_NAME}}',
        displayName: '{{DISPLAY_NAME}}',
        role: '{{ROLE}}'
      };
      const variables: TemplateVariables = {
        AGENT_NAME: 'backend',
        DISPLAY_NAME: 'Bob',
        ROLE: 'Engineer'
      };

      const result = engine.renderObject(template, variables);
      expect(result).toEqual({
        name: 'backend',
        displayName: 'Bob',
        role: 'Engineer'
      });
    });

    it('should handle nested objects', () => {
      const template = {
        agent: {
          name: '{{AGENT_NAME}}',
          config: {
            team: '{{TEAM}}'
          }
        }
      };
      const variables: TemplateVariables = {
        AGENT_NAME: 'backend',
        DISPLAY_NAME: 'Test',
        TEAM: 'engineering'
      };

      const result = engine.renderObject(template, variables);
      expect(result).toEqual({
        agent: {
          name: 'backend',
          config: {
            team: 'engineering'
          }
        }
      });
    });

    it('should handle arrays', () => {
      const template = {
        abilities: [
          'coding',
          '{{CUSTOM_ABILITY | default: testing}}'
        ]
      };
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const result = engine.renderObject(template, variables);
      expect(result).toEqual({
        abilities: [
          'coding',
          'testing'
        ]
      });
    });

    it('should preserve non-string values', () => {
      const template = {
        name: '{{AGENT_NAME}}',
        enabled: true,
        priority: 1,
        config: null,
        undefined: undefined
      };
      const variables: TemplateVariables = {
        AGENT_NAME: 'backend',
        DISPLAY_NAME: 'Test'
      };

      const result = engine.renderObject(template, variables);
      expect(result).toEqual({
        name: 'backend',
        enabled: true,
        priority: 1,
        config: null,
        undefined: undefined
      });
    });
  });

  describe('validateVariables()', () => {
    it('should return empty array when all required variables are provided', () => {
      const template = 'Name: {{NAME}}, Role: {{ROLE}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        NAME: 'Alice',
        ROLE: 'Engineer'
      };

      const missing = engine.validateVariables(template, variables);
      expect(missing).toEqual([]);
    });

    it('should return missing required variables', () => {
      const template = 'Name: {{NAME}}, Role: {{ROLE}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        NAME: 'Alice'
        // ROLE is missing
      };

      const missing = engine.validateVariables(template, variables);
      expect(missing).toEqual(['ROLE']);
    });

    it('should not require variables with default values', () => {
      const template = 'Name: {{NAME}}, Role: {{ROLE | default: Developer}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test',
        NAME: 'Alice'
        // ROLE is optional because it has default
      };

      const missing = engine.validateVariables(template, variables);
      expect(missing).toEqual([]);
    });

    it('should handle multiple missing variables', () => {
      const template = '{{VAR1}}, {{VAR2}}, {{VAR3 | default: X}}';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const missing = engine.validateVariables(template, variables);
      expect(missing).toEqual(['VAR1', 'VAR2']);
    });

    it('should not include duplicates in missing variables', () => {
      const template = '{{NAME}} and {{NAME}} again';
      const variables: TemplateVariables = {
        AGENT_NAME: 'test',
        DISPLAY_NAME: 'Test'
      };

      const missing = engine.validateVariables(template, variables);
      expect(missing).toEqual(['NAME']);
    });
  });

  describe('extractVariables()', () => {
    it('should extract all variable names', () => {
      const template = '{{NAME}}, {{ROLE}}, {{TEAM}}';
      const variables = engine.extractVariables(template);

      expect(variables).toEqual(['NAME', 'ROLE', 'TEAM']);
    });

    it('should extract variables with defaults', () => {
      const template = '{{NAME}}, {{ROLE | default: Dev}}';
      const variables = engine.extractVariables(template);

      expect(variables).toEqual(['NAME', 'ROLE']);
    });

    it('should not include duplicates', () => {
      const template = '{{NAME}} and {{NAME}} again';
      const variables = engine.extractVariables(template);

      expect(variables).toEqual(['NAME']);
    });

    it('should return empty array for template without variables', () => {
      const template = 'No variables here';
      const variables = engine.extractVariables(template);

      expect(variables).toEqual([]);
    });
  });

  describe('Complex Templates', () => {
    it('should render complete agent template', () => {
      const template = `name: "{{AGENT_NAME}}"
displayName: "{{DISPLAY_NAME}}"
team: {{TEAM}}
role: "{{ROLE | default: Software Developer}}"
description: "{{DESCRIPTION | default: Expert software developer}}"

systemPrompt: |
  You are {{DISPLAY_NAME}}, a {{ROLE | default: Software Developer}}.

  {{DESCRIPTION | default: You are an expert software developer.}}

  Your primary responsibilities include:
  - Writing clean code
  - Code review
  - Testing
`;

      const variables: TemplateVariables = {
        AGENT_NAME: 'backend-api',
        DISPLAY_NAME: 'Bob',
        TEAM: 'engineering',
        ROLE: 'Senior Backend Engineer',
        DESCRIPTION: 'Expert in API design and microservices'
      };

      const result = engine.render(template, variables);

      expect(result).toContain('name: "backend-api"');
      expect(result).toContain('displayName: "Bob"');
      expect(result).toContain('team: engineering');
      expect(result).toContain('role: "Senior Backend Engineer"');
      expect(result).toContain('description: "Expert in API design and microservices"');
      expect(result).toContain('You are Bob, a Senior Backend Engineer.');
      expect(result).toContain('Expert in API design and microservices');
    });
  });
});
