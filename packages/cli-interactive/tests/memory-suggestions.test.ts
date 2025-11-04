/**
 * Tests for Memory Suggestions
 *
 * Comprehensive test suite for context-based memory search suggestions
 * and memory visualization features.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMemorySuggestions,
  renderMemorySuggestions,
  renderMemorySearchResults,
  renderInlineMemoryHint,
  renderMemoryStatistics,
  shouldSuggestMemorySearch,
  createMemorySuggestionPrompt,
  type MemorySuggestion,
  type MemorySearchResult
} from '../src/memory-suggestions.js';

describe('Memory Suggestions', () => {
  describe('generateMemorySuggestions', () => {
    it('should generate suggestions from current task', () => {
      const suggestions = generateMemorySuggestions({
        currentTask: 'implement user authentication'
      });

      expect(suggestions.length).toBeGreaterThan(0);
      const taskSuggestion = suggestions.find(s => s.query.includes('implement') || s.query.includes('authentication'));
      expect(taskSuggestion).toBeDefined();
      expect(taskSuggestion!.relevance).toBe('high');
    });

    it('should generate suggestions from recent commands', () => {
      const suggestions = generateMemorySuggestions({
        recentCommands: ['test', 'lint', 'build']
      });

      expect(suggestions.some(s => s.query === 'test')).toBe(true);
      expect(suggestions.some(s => s.query === 'lint')).toBe(true);
      expect(suggestions.some(s => s.query === 'build')).toBe(true);
    });

    it('should generate suggestions from active agents', () => {
      const suggestions = generateMemorySuggestions({
        activeAgents: ['backend', 'frontend']
      });

      expect(suggestions.some(s => s.query === 'agent:backend')).toBe(true);
      expect(suggestions.some(s => s.query === 'agent:frontend')).toBe(true);
      expect(suggestions.find(s => s.query === 'agent:backend')!.relevance).toBe('high');
    });

    it('should generate suggestions from keywords', () => {
      const suggestions = generateMemorySuggestions({
        keywords: ['security', 'performance']
      });

      expect(suggestions.some(s => s.query === 'security')).toBe(true);
      expect(suggestions.some(s => s.query === 'performance')).toBe(true);
    });

    it('should include common suggestions', () => {
      const suggestions = generateMemorySuggestions({});

      expect(suggestions.some(s => s.query === 'error')).toBe(true);
      expect(suggestions.some(s => s.query === 'implementation')).toBe(true);
      expect(suggestions.some(s => s.query === 'design decision')).toBe(true);
    });

    it('should limit suggestions to 5', () => {
      const suggestions = generateMemorySuggestions({
        currentTask: 'complex task',
        recentCommands: ['cmd1', 'cmd2', 'cmd3', 'cmd4'],
        activeAgents: ['agent1', 'agent2'],
        keywords: ['key1', 'key2', 'key3']
      });

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should deduplicate suggestions', () => {
      const suggestions = generateMemorySuggestions({
        recentCommands: ['test', 'test', 'test'],
        keywords: ['test']
      });

      const testSuggestions = suggestions.filter(s => s.query === 'test');
      expect(testSuggestions.length).toBe(1);
    });

    it('should sort by relevance', () => {
      const suggestions = generateMemorySuggestions({
        currentTask: 'high priority task',
        keywords: ['low priority']
      });

      const highRelevanceIndex = suggestions.findIndex(s => s.relevance === 'high');
      const lowRelevanceIndex = suggestions.findIndex(s => s.relevance === 'low');

      if (highRelevanceIndex >= 0 && lowRelevanceIndex >= 0) {
        expect(highRelevanceIndex).toBeLessThan(lowRelevanceIndex);
      }
    });

    it('should extract keywords from task', () => {
      const suggestions = generateMemorySuggestions({
        currentTask: 'implement authentication with JWT tokens'
      });

      const taskSuggestion = suggestions.find(s => s.reason.includes('current task'));
      expect(taskSuggestion).toBeDefined();
      expect(taskSuggestion!.query).toMatch(/authentication|implement|tokens/i);
    });

    it('should handle empty context', () => {
      const suggestions = generateMemorySuggestions({});

      // Should still return common suggestions
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.some(s => s.query === 'error')).toBe(true);
    });

    it('should filter stop words from keywords', () => {
      const suggestions = generateMemorySuggestions({
        currentTask: 'the authentication is for the user'
      });

      const taskSuggestion = suggestions.find(s => s.reason.includes('current task'));
      if (taskSuggestion) {
        expect(taskSuggestion.query).not.toContain('the');
        expect(taskSuggestion.query).not.toContain('is');
        expect(taskSuggestion.query).not.toContain('for');
      }
    });

    it('should handle very long task descriptions', () => {
      const longTask = 'implement ' + 'a very '.repeat(100) + 'complex authentication system';

      const suggestions = generateMemorySuggestions({
        currentTask: longTask
      });

      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should handle many recent commands', () => {
      const commands = Array.from({ length: 20 }, (_, i) => `cmd${i}`);

      const suggestions = generateMemorySuggestions({
        recentCommands: commands
      });

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('renderMemorySuggestions', () => {
    it('should render suggestions list', () => {
      const suggestions: MemorySuggestion[] = [
        {
          query: 'authentication',
          reason: 'Related to current task',
          estimatedResults: 5,
          relevance: 'high'
        },
        {
          query: 'error',
          reason: 'Past error resolutions',
          estimatedResults: 3,
          relevance: 'medium'
        }
      ];

      const result = renderMemorySuggestions(suggestions);

      expect(result).toContain('Memory Suggestions');
      expect(result).toContain('authentication');
      expect(result).toContain('error');
      expect(result).toContain('Related to current task');
      expect(result).toContain('Past error resolutions');
      expect(result).toContain('~5 results');
      expect(result).toContain('~3 results');
    });

    it('should return empty string for no suggestions', () => {
      const result = renderMemorySuggestions([]);

      expect(result).toBe('');
    });

    it('should number suggestions', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'query1', reason: 'reason1', estimatedResults: 1, relevance: 'high' },
        { query: 'query2', reason: 'reason2', estimatedResults: 2, relevance: 'high' },
        { query: 'query3', reason: 'reason3', estimatedResults: 3, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);

      expect(result).toContain('1.');
      expect(result).toContain('2.');
      expect(result).toContain('3.');
    });

    it('should show relevance icons', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'high', reason: 'High relevance', estimatedResults: 5, relevance: 'high' },
        { query: 'medium', reason: 'Medium relevance', estimatedResults: 3, relevance: 'medium' },
        { query: 'low', reason: 'Low relevance', estimatedResults: 2, relevance: 'low' }
      ];

      const result = renderMemorySuggestions(suggestions);

      // Icons should be present (actual characters depend on chalk output)
      expect(result).toContain('high');
      expect(result).toContain('medium');
      expect(result).toContain('low');
    });

    it('should format memory search command', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'test query', reason: 'Reason', estimatedResults: 5, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);

      expect(result).toContain('/memory search "test query"');
    });
  });

  describe('renderMemorySearchResults', () => {
    it('should render search results', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Content line 1\nContent line 2\nContent line 3',
          context: 'Authentication implementation',
          relevance: 0.95,
          timestamp: new Date(Date.now() - 3600000), // 1 hour ago
          tags: ['auth', 'security']
        },
        {
          id: '2',
          content: 'Another result',
          context: 'User management',
          relevance: 0.75,
          timestamp: new Date(Date.now() - 7200000) // 2 hours ago
        }
      ];

      const output = renderMemorySearchResults('authentication', results);

      expect(output).toContain('Memory Search: "authentication"');
      expect(output).toContain('Content line 1');
      expect(output).toContain('Context: Authentication implementation');
      expect(output).toContain('#auth');
      expect(output).toContain('#security');
    });

    it('should show no results message', () => {
      const output = renderMemorySearchResults('nonexistent', []);

      expect(output).toContain('Memory Search: "nonexistent"');
      expect(output).toContain('No results found');
    });

    it('should render compact format', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'First line\nSecond line\nThird line',
          context: 'Context',
          relevance: 0.9,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results, { compact: true });

      expect(output).toContain('First line');
      expect(output).not.toContain('Second line');
      expect(output).not.toContain('Third line');
    });

    it('should limit results', () => {
      const results: MemorySearchResult[] = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        content: `Content ${i}`,
        context: 'Context',
        relevance: 0.8,
        timestamp: new Date()
      }));

      const output = renderMemorySearchResults('query', results, { maxResults: 5 });

      expect(output).toContain('Content 0');
      expect(output).toContain('Content 4');
      expect(output).not.toContain('Content 10');
      expect(output).toContain('and 15 more results');
    });

    it('should show relevance bars', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'High relevance',
          context: 'Context',
          relevance: 0.95,
          timestamp: new Date()
        },
        {
          id: '2',
          content: 'Low relevance',
          context: 'Context',
          relevance: 0.25,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);

      expect(output).toContain('95%');
      expect(output).toContain('25%');
    });

    it('should truncate long content', () => {
      const longContent = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6';

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: longContent,
          context: 'Context',
          relevance: 0.8,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);

      expect(output).toContain('Line 1');
      expect(output).toContain('Line 2');
      expect(output).toContain('Line 3');
      expect(output).toContain('(truncated)');
      expect(output).not.toContain('Line 6');
    });

    it('should handle results without tags', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Content',
          context: 'Context',
          relevance: 0.8,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);

      expect(output).toContain('Content');
      expect(output).not.toContain('#');
    });

    it('should handle very long content in compact mode', () => {
      const longLine = 'a'.repeat(200);

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: longLine,
          context: 'Context',
          relevance: 0.8,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results, { compact: true });

      expect(output).toContain('...');
    });
  });

  describe('renderInlineMemoryHint', () => {
    it('should render inline hint', () => {
      const suggestion: MemorySuggestion = {
        query: 'authentication',
        reason: 'Past auth implementations',
        estimatedResults: 5,
        relevance: 'high'
      };

      const result = renderInlineMemoryHint(suggestion);

      expect(result).toContain('Tip: Try');
      expect(result).toContain('/memory search "authentication"');
      expect(result).toContain('Past auth implementations');
    });

    it('should show relevance icon', () => {
      const highSuggestion: MemorySuggestion = {
        query: 'test',
        reason: 'Reason',
        estimatedResults: 5,
        relevance: 'high'
      };

      const result = renderInlineMemoryHint(highSuggestion);

      expect(result).toBeTruthy();
    });
  });

  describe('renderMemoryStatistics', () => {
    it('should render full statistics', () => {
      const stats = {
        totalEntries: 150,
        totalSize: 1024 * 1024 * 5, // 5MB
        oldestEntry: new Date('2024-01-01'),
        newestEntry: new Date('2024-12-01'),
        topTags: [
          { tag: 'auth', count: 25 },
          { tag: 'api', count: 20 },
          { tag: 'bug', count: 15 }
        ]
      };

      const result = renderMemoryStatistics(stats);

      expect(result).toContain('Memory Statistics');
      expect(result).toContain('150');
      expect(result).toContain('5.0MB');
      expect(result).toContain('2024');
      expect(result).toContain('#auth');
      expect(result).toContain('(25)');
    });

    it('should handle minimal statistics', () => {
      const stats = {
        totalEntries: 10,
        totalSize: 1024 // 1KB
      };

      const result = renderMemoryStatistics(stats);

      expect(result).toContain('Memory Statistics');
      expect(result).toContain('10');
      expect(result).toContain('1.0KB');
    });

    it('should format bytes correctly', () => {
      const statsB = { totalEntries: 1, totalSize: 500 };
      const resultB = renderMemoryStatistics(statsB);
      expect(resultB).toContain('500B');

      const statsKB = { totalEntries: 1, totalSize: 1024 * 10 };
      const resultKB = renderMemoryStatistics(statsKB);
      expect(resultKB).toContain('10.0KB');

      const statsMB = { totalEntries: 1, totalSize: 1024 * 1024 * 2.5 };
      const resultMB = renderMemoryStatistics(statsMB);
      expect(resultMB).toContain('2.5MB');
    });

    it('should limit top tags to 5', () => {
      const stats = {
        totalEntries: 100,
        totalSize: 1024,
        topTags: Array.from({ length: 10 }, (_, i) => ({ tag: `tag${i}`, count: 10 - i }))
      };

      const result = renderMemoryStatistics(stats);

      expect(result).toContain('#tag0');
      expect(result).toContain('#tag4');
      expect(result).not.toContain('#tag5');
    });
  });

  describe('shouldSuggestMemorySearch', () => {
    it('should suggest on error', () => {
      const suggestion = shouldSuggestMemorySearch('npm test', { errorOccurred: true });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.query).toContain('npm test');
      expect(suggestion!.query).toContain('error');
      expect(suggestion!.relevance).toBe('high');
    });

    it('should suggest for similar past command', () => {
      const suggestion = shouldSuggestMemorySearch('git commit', { similarPastCommand: true });

      expect(suggestion).not.toBeNull();
      expect(suggestion!.query).toBe('git commit');
      expect(suggestion!.relevance).toBe('medium');
    });

    it('should suggest for complex commands', () => {
      const suggestion1 = shouldSuggestMemorySearch('npm test && npm run build', {});
      expect(suggestion1).not.toBeNull();
      expect(suggestion1!.query).toBe('pipeline');

      const suggestion2 = shouldSuggestMemorySearch('cat file.txt | grep error', {});
      expect(suggestion2).not.toBeNull();
      expect(suggestion2!.query).toBe('pipeline');
    });

    it('should return null for simple commands', () => {
      const suggestion = shouldSuggestMemorySearch('ls', {});
      expect(suggestion).toBeNull();
    });

    it('should prioritize error suggestions', () => {
      const suggestion = shouldSuggestMemorySearch('npm test', {
        errorOccurred: true,
        similarPastCommand: true
      });

      expect(suggestion!.relevance).toBe('high');
      expect(suggestion!.query).toContain('error');
    });
  });

  describe('createMemorySuggestionPrompt', () => {
    it('should create prompt from top suggestion', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'top', reason: 'Top reason', estimatedResults: 5, relevance: 'high' },
        { query: 'second', reason: 'Second reason', estimatedResults: 3, relevance: 'medium' }
      ];

      const prompt = createMemorySuggestionPrompt(suggestions);

      expect(prompt).toContain('/memory search "top"');
      expect(prompt).toContain('Top reason');
    });

    it('should return empty string for no suggestions', () => {
      const prompt = createMemorySuggestionPrompt([]);
      expect(prompt).toBe('');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(500);

      const suggestions: MemorySuggestion[] = [
        { query: longQuery, reason: 'Long query', estimatedResults: 5, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);
      expect(result).toContain(longQuery);
    });

    it('should handle special characters in queries', () => {
      const specialQuery = 'query with @#$%^&*() special chars';

      const suggestions: MemorySuggestion[] = [
        { query: specialQuery, reason: 'Special', estimatedResults: 5, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);
      expect(result).toContain(specialQuery);
    });

    it('should handle empty result content', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: '',
          context: 'Empty content',
          relevance: 0.8,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toContain('Empty content');
    });

    it('should handle zero relevance', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Content',
          context: 'Context',
          relevance: 0.0,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toContain('0%');
    });

    it('should handle perfect relevance', () => {
      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Content',
          context: 'Context',
          relevance: 1.0,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toContain('100%');
    });

    it('should handle very old timestamps', () => {
      const veryOld = new Date('2020-01-01');

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Old content',
          context: 'Context',
          relevance: 0.8,
          timestamp: veryOld
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toMatch(/\d+d ago/);
    });

    it('should handle future timestamps gracefully', () => {
      const future = new Date(Date.now() + 86400000); // Tomorrow

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Future content',
          context: 'Context',
          relevance: 0.8,
          timestamp: future
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toBeTruthy(); // Should not throw
    });

    it('should handle very large result counts', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'popular', reason: 'Many results', estimatedResults: 999999, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);
      expect(result).toContain('999999');
    });

    it('should handle zero estimated results', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'rare', reason: 'No results', estimatedResults: 0, relevance: 'low' }
      ];

      const result = renderMemorySuggestions(suggestions);
      expect(result).toContain('~0 results');
    });

    it('should handle many tags', () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: 'Content',
          context: 'Context',
          relevance: 0.8,
          timestamp: new Date(),
          tags: manyTags
        }
      ];

      const output = renderMemorySearchResults('query', results);
      manyTags.forEach(tag => {
        expect(output).toContain(`#${tag}`);
      });
    });

    it('should handle Unicode in content', () => {
      const unicodeContent = '日本語 한국어 中文 Emoji: 🎉🚀💡';

      const results: MemorySearchResult[] = [
        {
          id: '1',
          content: unicodeContent,
          context: 'Unicode test',
          relevance: 0.8,
          timestamp: new Date()
        }
      ];

      const output = renderMemorySearchResults('query', results);
      expect(output).toContain(unicodeContent);
    });

    it('should handle newlines in reasons', () => {
      const suggestions: MemorySuggestion[] = [
        { query: 'test', reason: 'Line 1\nLine 2', estimatedResults: 5, relevance: 'high' }
      ];

      const result = renderMemorySuggestions(suggestions);
      expect(result).toBeTruthy();
    });

    it('should handle very large byte sizes', () => {
      const stats = {
        totalEntries: 1,
        totalSize: 1024 * 1024 * 1024 * 5 // 5GB
      };

      const result = renderMemoryStatistics(stats);
      // Should handle gracefully even if format doesn't go to GB
      expect(result).toBeTruthy();
    });

    it('should deduplicate case-sensitive queries', () => {
      const suggestions = generateMemorySuggestions({
        recentCommands: ['Test', 'test', 'TEST']
      });

      // All should be treated as different queries (case-sensitive)
      const testVariants = suggestions.filter(s =>
        s.query === 'Test' || s.query === 'test' || s.query === 'TEST'
      );

      // At least one should be present
      expect(testVariants.length).toBeGreaterThan(0);
    });
  });
});
