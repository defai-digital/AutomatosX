/**
 * Tests for OutputContracts module
 */

import { describe, it, expect } from 'vitest';
import {
  OutputContracts,
  getOutputContract,
  getContractTemplate,
  getAvailableContracts,
  recommendContract,
  validateResponse,
  extractSections,
} from '../../../../src/agents/cognitive/output-contracts.js';

describe('OutputContracts', () => {
  describe('getOutputContract', () => {
    it('should return standard contract', () => {
      const contract = getOutputContract('standard');

      expect(contract.id).toBe('standard');
      expect(contract.name).toBe('Standard Output');
      expect(contract.sections).toBeDefined();
      expect(contract.template).toBeDefined();
    });

    it('should return minimal contract', () => {
      const contract = getOutputContract('minimal');

      expect(contract.id).toBe('minimal');
      expect(contract.name).toBe('Minimal Output');
    });

    it('should return detailed contract', () => {
      const contract = getOutputContract('detailed');

      expect(contract.id).toBe('detailed');
      expect(contract.name).toBe('Detailed Output');
    });

    it('should throw for unknown contract', () => {
      expect(() => getOutputContract('unknown' as any)).toThrow(
        'Unknown output contract: unknown'
      );
    });
  });

  describe('Standard contract', () => {
    it('should have required sections', () => {
      const contract = getOutputContract('standard');
      const sectionNames = contract.sections.map(s => s.name);

      expect(sectionNames).toContain('Context');
      expect(sectionNames).toContain('Plan');
      expect(sectionNames).toContain('Actions');
      expect(sectionNames).toContain('Verification');
      expect(sectionNames).toContain('Risks');
      expect(sectionNames).toContain('Next Steps');
    });

    it('should have all sections marked as required', () => {
      const contract = getOutputContract('standard');

      for (const section of contract.sections) {
        expect(section.required).toBe(true);
      }
    });

    it('should have failure sections', () => {
      const contract = getOutputContract('standard');

      expect(contract.failureSections).toBeDefined();
      expect(contract.failureSections?.length).toBeGreaterThan(0);
    });

    it('should have format examples for each section', () => {
      const contract = getOutputContract('standard');

      for (const section of contract.sections) {
        expect(section.format).toBeDefined();
        expect(section.format.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Minimal contract', () => {
    it('should have fewer sections than standard', () => {
      const minimal = getOutputContract('minimal');
      const standard = getOutputContract('standard');

      expect(minimal.sections.length).toBeLessThan(standard.sections.length);
    });

    it('should have Done and Verified sections', () => {
      const contract = getOutputContract('minimal');
      const sectionNames = contract.sections.map(s => s.name);

      expect(sectionNames).toContain('Done');
      expect(sectionNames).toContain('Verified');
    });

    it('should have optional Note section', () => {
      const contract = getOutputContract('minimal');
      const noteSection = contract.sections.find(s => s.name === 'Note');

      expect(noteSection).toBeDefined();
      expect(noteSection?.required).toBe(false);
    });

    it('should not have failure sections', () => {
      const contract = getOutputContract('minimal');

      expect(contract.failureSections).toBeUndefined();
    });
  });

  describe('Detailed contract', () => {
    it('should have more sections than standard', () => {
      const detailed = getOutputContract('detailed');
      const standard = getOutputContract('standard');

      expect(detailed.sections.length).toBeGreaterThan(standard.sections.length);
    });

    it('should have additional sections', () => {
      const contract = getOutputContract('detailed');
      const sectionNames = contract.sections.map(s => s.name);

      expect(sectionNames).toContain('Options Considered');
      expect(sectionNames).toContain('Dependencies');
      expect(sectionNames).toContain('Rollback Plan');
    });

    it('should have optional additional sections', () => {
      const contract = getOutputContract('detailed');
      const optionalSection = contract.sections.find(s => s.name === 'Options Considered');

      expect(optionalSection?.required).toBe(false);
    });

    it('should have failure sections', () => {
      const contract = getOutputContract('detailed');

      expect(contract.failureSections).toBeDefined();
    });
  });

  describe('getContractTemplate', () => {
    it('should return standard template', () => {
      const template = getContractTemplate('standard');

      expect(template).toContain('OUTPUT FORMAT');
      expect(template).toContain('**Context**');
      expect(template).toContain('**Plan**');
      expect(template).toContain('**Actions**');
    });

    it('should return minimal template', () => {
      const template = getContractTemplate('minimal');

      expect(template).toContain('OUTPUT FORMAT (MINIMAL)');
      expect(template).toContain('**Done**');
      expect(template).toContain('**Verified**');
    });

    it('should return detailed template', () => {
      const template = getContractTemplate('detailed');

      expect(template).toContain('OUTPUT FORMAT (DETAILED)');
      expect(template).toContain('**Options Considered**');
    });
  });

  describe('getAvailableContracts', () => {
    it('should return all contract types', () => {
      const contracts = getAvailableContracts();

      expect(contracts).toContain('standard');
      expect(contracts).toContain('minimal');
      expect(contracts).toContain('detailed');
      expect(contracts).toHaveLength(3);
    });
  });

  describe('recommendContract', () => {
    describe('should recommend minimal for simple tasks', () => {
      it('with typo keyword', () => {
        expect(recommendContract('fix typo in readme')).toBe('minimal');
      });

      it('with comment keyword', () => {
        expect(recommendContract('update comment')).toBe('minimal');
      });

      it('with rename keyword', () => {
        expect(recommendContract('rename variable')).toBe('minimal');
      });

      it('with simple keyword', () => {
        expect(recommendContract('simple change')).toBe('minimal');
      });

      it('with quick keyword', () => {
        expect(recommendContract('quick fix')).toBe('minimal');
      });

      it('with minor fix keyword', () => {
        expect(recommendContract('minor fix to button')).toBe('minimal');
      });

      it('with update version keyword', () => {
        expect(recommendContract('update version number')).toBe('minimal');
      });
    });

    describe('should recommend detailed for complex tasks', () => {
      it('with architect keyword', () => {
        expect(recommendContract('architect new system')).toBe('detailed');
      });

      it('with design keyword', () => {
        expect(recommendContract('design the api')).toBe('detailed');
      });

      it('with migration keyword', () => {
        expect(recommendContract('database migration plan')).toBe('detailed');
      });

      it('with breaking change keyword', () => {
        expect(recommendContract('breaking change to api')).toBe('detailed');
      });

      it('with major keyword', () => {
        expect(recommendContract('major refactoring')).toBe('detailed');
      });

      it('with complex keyword', () => {
        expect(recommendContract('complex feature implementation')).toBe('detailed');
      });

      it('with multi-team keyword', () => {
        expect(recommendContract('multi-team coordination')).toBe('detailed');
      });
    });

    it('should recommend standard for typical tasks', () => {
      expect(recommendContract('implement user authentication')).toBe('standard');
      expect(recommendContract('add new feature')).toBe('standard');
      expect(recommendContract('fix bug in login')).toBe('standard');
    });

    it('should be case-insensitive', () => {
      expect(recommendContract('FIX TYPO')).toBe('minimal');
      expect(recommendContract('ARCHITECT SYSTEM')).toBe('detailed');
    });
  });

  describe('validateResponse', () => {
    it('should validate complete standard response', () => {
      const response = `
**Context**
- Goal: Test goal
- Constraints: None

**Plan**
1. Step 1

**Actions**
- Action 1: \`file.ts:1\`

**Verification**
- Validated:
  - [x] Tests pass
- Gaps: None

**Risks**
Risks: None identified

**Next Steps**
Ready for review
`;
      const result = validateResponse(response, 'standard');

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing sections', () => {
      const response = `
**Context**
- Goal: Test goal

**Actions**
- Action 1
`;
      const result = validateResponse(response, 'standard');

      expect(result.valid).toBe(false);
      expect(result.missing).toContain('Plan');
      expect(result.missing).toContain('Verification');
      expect(result.missing).toContain('Risks');
      expect(result.missing).toContain('Next Steps');
    });

    it('should validate minimal response', () => {
      const response = `
**Done**
- Updated file

**Verified**
Tests pass
`;
      const result = validateResponse(response, 'minimal');

      expect(result.valid).toBe(true);
    });

    it('should warn about missing backticks for file paths', () => {
      const response = `
**Done**
- Updated src/file.ts

**Verified**
Visual check
`;
      const result = validateResponse(response, 'minimal');

      expect(result.warnings.some(w => w.includes('backticks'))).toBe(true);
    });

    it('should warn about placeholders', () => {
      const response = `
**Done**
- [TODO] Complete implementation

**Verified**
[TBD]
`;
      const result = validateResponse(response, 'minimal');

      expect(result.warnings.some(w => w.includes('placeholder'))).toBe(true);
    });

    it('should warn about incomplete verification section', () => {
      const response = `
**Context**
- Goal: Test

**Plan**
1. Step

**Actions**
- Action

**Verification**
Some text here without proper format

**Risks**
None

**Next Steps**
Done
`;
      const result = validateResponse(response, 'standard');

      expect(result.warnings.some(w => w.includes('Verification'))).toBe(true);
    });
  });

  describe('extractSections', () => {
    it('should extract all sections from response', () => {
      const response = `
**Context**
Goal statement here

**Plan**
1. Step 1
2. Step 2

**Actions**
- Did thing 1
- Did thing 2
`;
      const sections = extractSections(response);

      expect(sections['Context']).toBe('Goal statement here');
      expect(sections['Plan']).toContain('Step 1');
      expect(sections['Actions']).toContain('Did thing 1');
    });

    it('should handle empty response', () => {
      const sections = extractSections('');

      expect(Object.keys(sections)).toHaveLength(0);
    });

    it('should handle response without sections', () => {
      const sections = extractSections('Just plain text without any sections');

      expect(Object.keys(sections)).toHaveLength(0);
    });

    it('should trim section content', () => {
      const response = `
**Context**

   Goal with whitespace

**Plan**
Steps
`;
      const sections = extractSections(response);

      expect(sections['Context']).toBe('Goal with whitespace');
    });

    it('should handle sections with special characters', () => {
      const response = `
**Options Considered**
| Option | Pros | Cons |
|--------|------|------|
| A | Fast | Hard |

**Next Steps**
Done
`;
      const sections = extractSections(response);

      expect(sections['Options Considered']).toContain('Option');
      expect(sections['Next Steps']).toBe('Done');
    });
  });

  describe('OutputContracts namespace', () => {
    it('should expose get function', () => {
      const contract = OutputContracts.get('standard');
      expect(contract.id).toBe('standard');
    });

    it('should expose getTemplate function', () => {
      const template = OutputContracts.getTemplate('minimal');
      expect(template).toContain('MINIMAL');
    });

    it('should expose getAvailable function', () => {
      const available = OutputContracts.getAvailable();
      expect(available).toHaveLength(3);
    });

    it('should expose recommend function', () => {
      // Use a task that doesn't match any indicators (defaults to standard)
      const recommended = OutputContracts.recommend('implement user feature');
      expect(recommended).toBe('standard');
    });

    it('should expose validate function', () => {
      const result = OutputContracts.validate('**Done**\nText', 'minimal');
      expect(result).toBeDefined();
    });

    it('should expose extractSections function', () => {
      const sections = OutputContracts.extractSections('**Test**\nContent');
      expect(sections['Test']).toBe('Content');
    });

    it('should expose contract constants', () => {
      expect(OutputContracts.STANDARD.id).toBe('standard');
      expect(OutputContracts.MINIMAL.id).toBe('minimal');
      expect(OutputContracts.DETAILED.id).toBe('detailed');
    });
  });
});
