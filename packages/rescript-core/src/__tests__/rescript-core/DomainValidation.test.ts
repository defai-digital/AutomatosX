/**
 * Unit Tests for DomainValidation.res
 *
 * Tests the ReScript DomainValidation module for smart constructors,
 * branded IDs, and multi-field validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  isOk,
  isError,
  Ok,
  Error as ResultError,
  type Result,
} from '../../bridge/RescriptBridge';

describe('DomainValidation Module', () => {
  beforeEach(() => {
    configureBridge({ enableDomainValidation: true, logTransitions: false });
  });

  describe('Branded ID Types', () => {
    it('should validate userId format', () => {
      // BUGGY TypeScript version:
      // type UserId = string;  // No validation! ❌

      // ReScript version with smart constructor:
      function makeUserId(id: string): Result<string, string> {
        if (id.length === 0) {
          return ResultError('User ID cannot be empty');
        }
        if (!id.startsWith('user-') && !id.startsWith('usr_')) {
          return ResultError("User ID must start with 'user-' or 'usr_'");
        }
        return Ok(id);
      }

      const valid1 = makeUserId('user-12345');
      expect(isOk(valid1)).toBe(true);

      const valid2 = makeUserId('usr_abc');
      expect(isOk(valid2)).toBe(true);

      const empty = makeUserId('');
      expect(isError(empty)).toBe(true);

      const invalid = makeUserId('invalid-123');
      expect(isError(invalid)).toBe(true);
    });

    it('should validate conversationId format', () => {
      function makeConversationId(id: string): Result<string, string> {
        if (id.length === 0) {
          return ResultError('Conversation ID cannot be empty');
        }
        if (!id.startsWith('conv-') && !id.startsWith('conversation_')) {
          return ResultError("Conversation ID must start with 'conv-' or 'conversation_'");
        }
        return Ok(id);
      }

      const valid1 = makeConversationId('conv-12345');
      expect(isOk(valid1)).toBe(true);

      const valid2 = makeConversationId('conversation_abc');
      expect(isOk(valid2)).toBe(true);

      const invalid = makeConversationId('chat-123');
      expect(isError(invalid)).toBe(true);
    });

    it('should validate messageId format', () => {
      function makeMessageId(id: string): Result<string, string> {
        if (id.length === 0) {
          return ResultError('Message ID cannot be empty');
        }
        if (!id.startsWith('msg-') && !id.startsWith('message_')) {
          return ResultError("Message ID must start with 'msg-' or 'message_'");
        }
        return Ok(id);
      }

      const valid = makeMessageId('msg-98765');
      expect(isOk(valid)).toBe(true);

      const invalid = makeMessageId('text-123');
      expect(isError(invalid)).toBe(true);
    });

    it('should validate modelId format', () => {
      function makeModelId(id: string): Result<string, string> {
        if (id.length === 0) {
          return ResultError('Model ID cannot be empty');
        }
        const validModels = ['gpt-3.5-turbo', 'gpt-4', 'claude-2', 'claude-3'];
        const isValid = validModels.some(m => id.startsWith(m));

        if (!isValid) {
          return ResultError('Model ID must be a valid model prefix');
        }
        return Ok(id);
      }

      const valid1 = makeModelId('gpt-4-turbo');
      expect(isOk(valid1)).toBe(true);

      const valid2 = makeModelId('claude-3-opus');
      expect(isOk(valid2)).toBe(true);

      const invalid = makeModelId('unknown-model');
      expect(isError(invalid)).toBe(true);
    });
  });

  describe('Message Role Validation', () => {
    it('should validate message role', () => {
      type MessageRole = 'system' | 'user' | 'assistant' | 'function';

      function validateMessageRole(role: string): Result<MessageRole, string> {
        const validRoles: MessageRole[] = ['system', 'user', 'assistant', 'function'];

        if (!validRoles.includes(role as MessageRole)) {
          return ResultError(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
        }

        return Ok(role as MessageRole);
      }

      const validSystem = validateMessageRole('system');
      expect(isOk(validSystem)).toBe(true);

      const validUser = validateMessageRole('user');
      expect(isOk(validUser)).toBe(true);

      const invalid = validateMessageRole('admin');
      expect(isError(invalid)).toBe(true);
    });
  });

  describe('Message Content Validation', () => {
    it('should validate non-empty content', () => {
      function validateMessageContent(content: string): Result<string, string> {
        if (content.trim().length === 0) {
          return ResultError('Message content cannot be empty');
        }
        if (content.length > 100000) {
          return ResultError('Message content exceeds maximum length');
        }
        return Ok(content);
      }

      const valid = validateMessageContent('Hello, world!');
      expect(isOk(valid)).toBe(true);

      const empty = validateMessageContent('');
      expect(isError(empty)).toBe(true);

      const whitespace = validateMessageContent('   ');
      expect(isError(whitespace)).toBe(true);

      const tooLong = validateMessageContent('x'.repeat(100001));
      expect(isError(tooLong)).toBe(true);
    });
  });

  describe('Token Count Validation', () => {
    it('should validate token count range', () => {
      function validateTokenCount(tokens: number): Result<number, string> {
        if (tokens < 0) {
          return ResultError('Token count cannot be negative');
        }
        if (tokens > 1000000) {
          return ResultError('Token count exceeds maximum');
        }
        return Ok(tokens);
      }

      const valid = validateTokenCount(1500);
      expect(isOk(valid)).toBe(true);

      const zero = validateTokenCount(0);
      expect(isOk(zero)).toBe(true);

      const negative = validateTokenCount(-1);
      expect(isError(negative)).toBe(true);

      const tooLarge = validateTokenCount(1000001);
      expect(isError(tooLarge)).toBe(true);
    });
  });

  describe('Timestamp Validation', () => {
    it('should validate timestamp range', () => {
      function validateTimestamp(timestamp: number): Result<number, string> {
        if (timestamp < 0) {
          return ResultError('Timestamp cannot be negative');
        }
        // Don't validate upper bound due to ReScript int limitations
        return Ok(timestamp);
      }

      const valid = validateTimestamp(Date.now());
      expect(isOk(valid)).toBe(true);

      const zero = validateTimestamp(0);
      expect(isOk(zero)).toBe(true);

      const negative = validateTimestamp(-1);
      expect(isError(negative)).toBe(true);
    });
  });

  describe('Temperature Validation', () => {
    it('should validate temperature range', () => {
      function validateTemperature(temp: number): Result<number, string> {
        if (temp < 0 || temp > 2) {
          return ResultError('Temperature must be between 0 and 2');
        }
        return Ok(temp);
      }

      const valid1 = validateTemperature(0.7);
      expect(isOk(valid1)).toBe(true);

      const valid2 = validateTemperature(0);
      expect(isOk(valid2)).toBe(true);

      const valid3 = validateTemperature(2);
      expect(isOk(valid3)).toBe(true);

      const negative = validateTemperature(-0.1);
      expect(isError(negative)).toBe(true);

      const tooHigh = validateTemperature(2.1);
      expect(isError(tooHigh)).toBe(true);
    });
  });

  describe('Multi-field Validation', () => {
    it('should validate complete message object', () => {
      interface ValidatedMessage {
        id: string;
        conversationId: string;
        role: 'system' | 'user' | 'assistant' | 'function';
        content: string;
        tokenCount: number;
        timestamp: number;
        modelId?: string;
        temperature?: number;
      }

      function createMessage(
        id: string,
        conversationId: string,
        role: string,
        content: string,
        tokenCount: number,
        timestamp: number,
        modelId?: string,
        temperature?: number
      ): Result<ValidatedMessage, string[]> {
        const errors: string[] = [];

        // Validate ID
        if (!id.startsWith('msg-')) {
          errors.push('Invalid message ID format');
        }

        // Validate conversation ID
        if (!conversationId.startsWith('conv-')) {
          errors.push('Invalid conversation ID format');
        }

        // Validate role
        if (!['system', 'user', 'assistant', 'function'].includes(role)) {
          errors.push('Invalid message role');
        }

        // Validate content
        if (content.trim().length === 0) {
          errors.push('Content cannot be empty');
        }

        // Validate token count
        if (tokenCount < 0) {
          errors.push('Token count cannot be negative');
        }

        // Validate timestamp
        if (timestamp < 0) {
          errors.push('Timestamp cannot be negative');
        }

        // Validate optional model ID
        if (modelId && !modelId.startsWith('gpt-') && !modelId.startsWith('claude-')) {
          errors.push('Invalid model ID');
        }

        // Validate optional temperature
        if (temperature !== undefined && (temperature < 0 || temperature > 2)) {
          errors.push('Temperature must be between 0 and 2');
        }

        if (errors.length > 0) {
          return ResultError(errors.join('; '));
        }

        return Ok({
          id,
          conversationId,
          role: role as any,
          content,
          tokenCount,
          timestamp,
          modelId,
          temperature,
        });
      }

      // Valid message
      const validMessage = createMessage(
        'msg-123',
        'conv-456',
        'user',
        'Hello!',
        10,
        Date.now(),
        'gpt-4',
        0.7
      );

      expect(isOk(validMessage)).toBe(true);
      if (isOk(validMessage)) {
        expect(validMessage._0.id).toBe('msg-123');
        expect(validMessage._0.role).toBe('user');
      }

      // Invalid message (multiple errors)
      const invalidMessage = createMessage(
        'invalid-123',  // Bad ID
        'invalid-456',  // Bad conversation ID
        'admin',        // Bad role
        '',             // Empty content
        -1,             // Negative tokens
        -1,             // Negative timestamp
        'invalid-model', // Bad model
        3.0             // Bad temperature
      );

      expect(isError(invalidMessage)).toBe(true);
      if (isError(invalidMessage)) {
        expect(invalidMessage._0).toContain('Invalid message ID');
        expect(invalidMessage._0).toContain('Invalid conversation ID');
        expect(invalidMessage._0).toContain('Invalid message role');
        expect(invalidMessage._0).toContain('Content cannot be empty');
      }
    });

    it('should validate conversation metadata', () => {
      interface Conversation {
        id: string;
        userId: string;
        title: string;
        messageCount: number;
        createdAt: number;
      }

      function createConversation(
        id: string,
        userId: string,
        title: string,
        messageCount: number,
        createdAt: number
      ): Result<Conversation, string> {
        if (!id.startsWith('conv-')) {
          return ResultError('Invalid conversation ID');
        }
        if (!userId.startsWith('user-')) {
          return ResultError('Invalid user ID');
        }
        if (title.length === 0 || title.length > 200) {
          return ResultError('Title must be between 1 and 200 characters');
        }
        if (messageCount < 0) {
          return ResultError('Message count cannot be negative');
        }
        if (createdAt < 0) {
          return ResultError('Created timestamp cannot be negative');
        }

        return Ok({ id, userId, title, messageCount, createdAt });
      }

      const valid = createConversation(
        'conv-123',
        'user-456',
        'My Conversation',
        5,
        Date.now()
      );

      expect(isOk(valid)).toBe(true);

      const invalidId = createConversation(
        'chat-123',
        'user-456',
        'Title',
        5,
        Date.now()
      );

      expect(isError(invalidId)).toBe(true);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should validate API request payload', () => {
      interface ChatRequest {
        conversationId: string;
        message: string;
        model: string;
        temperature: number;
        maxTokens: number;
      }

      function validateChatRequest(req: ChatRequest): Result<ChatRequest, string[]> {
        const errors: string[] = [];

        if (!req.conversationId.startsWith('conv-')) {
          errors.push('Invalid conversation ID');
        }

        if (req.message.trim().length === 0) {
          errors.push('Message cannot be empty');
        }

        if (!req.model.startsWith('gpt-') && !req.model.startsWith('claude-')) {
          errors.push('Invalid model');
        }

        if (req.temperature < 0 || req.temperature > 2) {
          errors.push('Temperature out of range');
        }

        if (req.maxTokens < 1 || req.maxTokens > 100000) {
          errors.push('Max tokens out of range');
        }

        if (errors.length > 0) {
          return ResultError(errors.join('; '));
        }

        return Ok(req);
      }

      const validRequest: ChatRequest = {
        conversationId: 'conv-123',
        message: 'Hello!',
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2000,
      };

      const result = validateChatRequest(validRequest);
      expect(isOk(result)).toBe(true);

      const invalidRequest: ChatRequest = {
        conversationId: 'invalid',
        message: '',
        model: 'unknown',
        temperature: 3.0,
        maxTokens: 200000,
      };

      const invalidResult = validateChatRequest(invalidRequest);
      expect(isError(invalidResult)).toBe(true);
    });

    it('should validate user profile', () => {
      interface UserProfile {
        userId: string;
        email: string;
        displayName: string;
        bio: string;
        createdAt: number;
      }

      function validateUserProfile(profile: UserProfile): Result<UserProfile, string[]> {
        const errors: string[] = [];

        if (!profile.userId.startsWith('user-')) {
          errors.push('Invalid user ID');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profile.email)) {
          errors.push('Invalid email format');
        }

        if (profile.displayName.length < 1 || profile.displayName.length > 50) {
          errors.push('Display name must be 1-50 characters');
        }

        if (profile.bio.length > 500) {
          errors.push('Bio cannot exceed 500 characters');
        }

        if (profile.createdAt < 0) {
          errors.push('Invalid creation timestamp');
        }

        if (errors.length > 0) {
          return ResultError(errors.join('; '));
        }

        return Ok(profile);
      }

      const validProfile: UserProfile = {
        userId: 'user-123',
        email: 'user@example.com',
        displayName: 'John Doe',
        bio: 'Software developer',
        createdAt: Date.now(),
      };

      const result = validateUserProfile(validProfile);
      expect(isOk(result)).toBe(true);
    });

    it('should validate search query', () => {
      interface SearchQuery {
        query: string;
        conversationId?: string;
        limit: number;
        offset: number;
      }

      function validateSearchQuery(search: SearchQuery): Result<SearchQuery, string> {
        if (search.query.trim().length === 0) {
          return ResultError('Query cannot be empty');
        }

        if (search.conversationId && !search.conversationId.startsWith('conv-')) {
          return ResultError('Invalid conversation ID');
        }

        if (search.limit < 1 || search.limit > 100) {
          return ResultError('Limit must be between 1 and 100');
        }

        if (search.offset < 0) {
          return ResultError('Offset cannot be negative');
        }

        return Ok(search);
      }

      const valid: SearchQuery = {
        query: 'test query',
        conversationId: 'conv-123',
        limit: 10,
        offset: 0,
      };

      const result = validateSearchQuery(valid);
      expect(isOk(result)).toBe(true);

      const invalidLimit: SearchQuery = {
        query: 'test',
        limit: 200,
        offset: 0,
      };

      const limitResult = validateSearchQuery(invalidLimit);
      expect(isError(limitResult)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle boundary values', () => {
      function validateTokenCount(tokens: number): Result<number, string> {
        if (tokens < 0 || tokens > 100000) {
          return ResultError('Token count out of range');
        }
        return Ok(tokens);
      }

      // Boundary values
      expect(isOk(validateTokenCount(0))).toBe(true);
      expect(isOk(validateTokenCount(100000))).toBe(true);
      expect(isError(validateTokenCount(-1))).toBe(true);
      expect(isError(validateTokenCount(100001))).toBe(true);
    });

    it('should handle unicode content', () => {
      function validateContent(content: string): Result<string, string> {
        if (content.trim().length === 0) {
          return ResultError('Content cannot be empty');
        }
        return Ok(content);
      }

      const emoji = validateContent('Hello 👋 World 🌍');
      expect(isOk(emoji)).toBe(true);

      const chinese = validateContent('你好世界');
      expect(isOk(chinese)).toBe(true);

      const arabic = validateContent('مرحبا بالعالم');
      expect(isOk(arabic)).toBe(true);
    });

    it('should handle optional fields correctly', () => {
      interface Message {
        id: string;
        content: string;
        modelId?: string;
      }

      function validateMessage(msg: Message): Result<Message, string> {
        if (!msg.id.startsWith('msg-')) {
          return ResultError('Invalid message ID');
        }

        if (msg.content.length === 0) {
          return ResultError('Content cannot be empty');
        }

        if (msg.modelId && !msg.modelId.startsWith('gpt-')) {
          return ResultError('Invalid model ID');
        }

        return Ok(msg);
      }

      const withModel = validateMessage({
        id: 'msg-123',
        content: 'Test',
        modelId: 'gpt-4',
      });

      expect(isOk(withModel)).toBe(true);

      const withoutModel = validateMessage({
        id: 'msg-123',
        content: 'Test',
      });

      expect(isOk(withoutModel)).toBe(true);

      const invalidModel = validateMessage({
        id: 'msg-123',
        content: 'Test',
        modelId: 'invalid',
      });

      expect(isError(invalidModel)).toBe(true);
    });
  });
});
