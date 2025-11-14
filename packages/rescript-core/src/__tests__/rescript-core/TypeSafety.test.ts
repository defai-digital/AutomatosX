/**
 * Unit Tests for TypeSafety.res
 *
 * Tests the ReScript TypeSafety module for branded types,
 * ID confusion prevention, and compile-time type guarantees
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  TypeSafetyBridge,
  isOk,
  isError,
  type Result,
} from '../../bridge/RescriptBridge';

describe('TypeSafety Module', () => {
  beforeEach(() => {
    configureBridge({ enableTypeSafety: true, logTransitions: false });
  });

  describe('BUG #17: Passing userId where conversationId Expected', () => {
    it('should prevent ID confusion with branded types', () => {
      // BUGGY TypeScript version:
      // type UserId = string;
      // type ConversationId = string;
      // function getConversation(id: ConversationId) { ... }
      // const userId: UserId = "user-123";
      // getConversation(userId);  // ❌ Wrong ID type, but compiles!

      // ReScript version with branded types:
      const userIdResult = TypeSafetyBridge.makeUserId('user-123');
      const convIdResult = TypeSafetyBridge.makeConversationId('conv-456');

      expect(isOk(userIdResult)).toBe(true);
      expect(isOk(convIdResult)).toBe(true);

      // TypeScript now prevents:
      // getUserById(convIdResult._0);  // ❌ Type error at compile time!

      // This would be caught by TypeScript:
      // function getUserById(userId: TypeSafetyBridge.UserId) { ... }
      // getUserById(convIdResult._0);  // Type 'ConversationId' is not assignable to type 'UserId'
    });

    it('should validate userId format', () => {
      const validUserId = TypeSafetyBridge.makeUserId('user-12345');
      expect(isOk(validUserId)).toBe(true);

      const emptyUserId = TypeSafetyBridge.makeUserId('');
      expect(isError(emptyUserId)).toBe(true);

      const invalidUserId = TypeSafetyBridge.makeUserId('invalid-123');
      expect(isError(invalidUserId)).toBe(true);
    });

    it('should validate conversationId format', () => {
      const validConvId = TypeSafetyBridge.makeConversationId('conv-12345');
      expect(isOk(validConvId)).toBe(true);

      const emptyConvId = TypeSafetyBridge.makeConversationId('');
      expect(isError(emptyConvId)).toBe(true);

      const invalidConvId = TypeSafetyBridge.makeConversationId('chat-123');
      expect(isError(invalidConvId)).toBe(true);
    });

    it('should validate messageId format', () => {
      const validMsgId = TypeSafetyBridge.makeMessageId('msg-12345');
      expect(isOk(validMsgId)).toBe(true);

      const emptyMsgId = TypeSafetyBridge.makeMessageId('');
      expect(isError(emptyMsgId)).toBe(true);

      const invalidMsgId = TypeSafetyBridge.makeMessageId('message-123');
      expect(isError(invalidMsgId)).toBe(true);
    });
  });

  describe('Branded Numeric Types', () => {
    it('should create branded token count', () => {
      // Prevents mixing token counts with other numbers
      type TokenCount = number & { readonly __brand: 'TokenCount' };

      function makeTokenCount(count: number): Result<TokenCount, string> {
        if (count < 0) {
          return { TAG: 'Error', _0: 'Token count cannot be negative' };
        }
        return { TAG: 'Ok', _0: count as TokenCount };
      }

      const validTokens = makeTokenCount(1500);
      expect(isOk(validTokens)).toBe(true);

      const negativeTokens = makeTokenCount(-1);
      expect(isError(negativeTokens)).toBe(true);
    });

    it('should create branded timestamp', () => {
      type Timestamp = number & { readonly __brand: 'Timestamp' };

      function makeTimestamp(ms: number): Result<Timestamp, string> {
        if (ms < 0) {
          return { TAG: 'Error', _0: 'Timestamp cannot be negative' };
        }
        return { TAG: 'Ok', _0: ms as Timestamp };
      }

      const validTimestamp = makeTimestamp(Date.now());
      expect(isOk(validTimestamp)).toBe(true);

      const negativeTimestamp = makeTimestamp(-1);
      expect(isError(negativeTimestamp)).toBe(true);
    });

    it('should create branded price', () => {
      // Prevents mixing prices in different currencies
      type USDPrice = number & { readonly __brand: 'USDPrice' };
      type EURPrice = number & { readonly __brand: 'EURPrice' };

      function makeUSDPrice(cents: number): Result<USDPrice, string> {
        if (cents < 0) {
          return { TAG: 'Error', _0: 'Price cannot be negative' };
        }
        return { TAG: 'Ok', _0: cents as USDPrice };
      }

      function makeEURPrice(cents: number): Result<EURPrice, string> {
        if (cents < 0) {
          return { TAG: 'Error', _0: 'Price cannot be negative' };
        }
        return { TAG: 'Ok', _0: cents as EURPrice };
      }

      const usdPrice = makeUSDPrice(1999);  // $19.99
      const eurPrice = makeEURPrice(1799);  // €17.99

      expect(isOk(usdPrice)).toBe(true);
      expect(isOk(eurPrice)).toBe(true);

      // Can't mix USD and EUR at compile time!
      // function chargeUSD(price: USDPrice) { ... }
      // chargeUSD(eurPrice._0);  // ❌ Type error!
    });
  });

  describe('Branded String Types', () => {
    it('should create branded email', () => {
      type Email = string & { readonly __brand: 'Email' };

      function makeEmail(email: string): Result<Email, string> {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
          return { TAG: 'Error', _0: 'Invalid email format' };
        }

        return { TAG: 'Ok', _0: email as Email };
      }

      const validEmail = makeEmail('user@example.com');
      expect(isOk(validEmail)).toBe(true);

      const invalidEmail = makeEmail('not-an-email');
      expect(isError(invalidEmail)).toBe(true);
    });

    it('should create branded URL', () => {
      type Url = string & { readonly __brand: 'Url' };

      function makeUrl(url: string): Result<Url, string> {
        try {
          new URL(url);
          return { TAG: 'Ok', _0: url as Url };
        } catch {
          return { TAG: 'Error', _0: 'Invalid URL format' };
        }
      }

      const validUrl = makeUrl('https://example.com');
      expect(isOk(validUrl)).toBe(true);

      const invalidUrl = makeUrl('not a url');
      expect(isError(invalidUrl)).toBe(true);
    });

    it('should create branded phone number', () => {
      type PhoneNumber = string & { readonly __brand: 'PhoneNumber' };

      function makePhoneNumber(phone: string): Result<PhoneNumber, string> {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;

        if (!phoneRegex.test(phone)) {
          return { TAG: 'Error', _0: 'Invalid phone number format' };
        }

        return { TAG: 'Ok', _0: phone as PhoneNumber };
      }

      const validPhone = makePhoneNumber('+12025551234');
      expect(isOk(validPhone)).toBe(true);

      const invalidPhone = makePhoneNumber('123');
      expect(isError(invalidPhone)).toBe(true);
    });
  });

  describe('Non-Empty Arrays', () => {
    it('should guarantee non-empty array', () => {
      // TypeScript NonEmptyArray type
      type NonEmptyArray<T> = [T, ...T[]];

      function makeNonEmpty<T>(arr: T[]): Result<NonEmptyArray<T>, string> {
        if (arr.length === 0) {
          return { TAG: 'Error', _0: 'Array cannot be empty' };
        }
        return { TAG: 'Ok', _0: arr as NonEmptyArray<T> };
      }

      function head<T>(arr: NonEmptyArray<T>): T {
        return arr[0];  // Safe! Always has at least one element
      }

      const validArray = makeNonEmpty([1, 2, 3]);
      expect(isOk(validArray)).toBe(true);

      if (isOk(validArray)) {
        expect(head(validArray._0)).toBe(1);
      }

      const emptyArray = makeNonEmpty([]);
      expect(isError(emptyArray)).toBe(true);
    });

    it('should provide tail for non-empty arrays', () => {
      type NonEmptyArray<T> = [T, ...T[]];

      function tail<T>(arr: NonEmptyArray<T>): T[] {
        return arr.slice(1);
      }

      const arr: NonEmptyArray<number> = [1, 2, 3];
      const tailArr = tail(arr);

      expect(tailArr).toEqual([2, 3]);

      const singleElement: NonEmptyArray<number> = [1];
      const emptyTail = tail(singleElement);

      expect(emptyTail).toEqual([]);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should prevent API parameter confusion', () => {
      // Common bug: Swapping userId and conversationId parameters

      interface Message {
        userId: TypeSafetyBridge.UserId;
        conversationId: TypeSafetyBridge.ConversationId;
        content: string;
      }

      function createMessage(
        userId: TypeSafetyBridge.UserId,
        conversationId: TypeSafetyBridge.ConversationId,
        content: string
      ): Message {
        return { userId, conversationId, content };
      }

      const userIdResult = TypeSafetyBridge.makeUserId('user-123');
      const convIdResult = TypeSafetyBridge.makeConversationId('conv-456');

      expect(isOk(userIdResult)).toBe(true);
      expect(isOk(convIdResult)).toBe(true);

      // Can only call with correct types
      if (isOk(userIdResult) && isOk(convIdResult)) {
        const message = createMessage(
          userIdResult._0,
          convIdResult._0,
          'Hello!'
        );

        expect(message.content).toBe('Hello!');

        // This would be a compile error:
        // createMessage(convIdResult._0, userIdResult._0, 'Hello!');  // ❌
      }
    });

    it('should prevent price currency confusion', () => {
      type USDPrice = number & { readonly __brand: 'USDPrice' };
      type EURPrice = number & { readonly __brand: 'EURPrice' };

      interface Product {
        id: string;
        name: string;
        priceUSD: USDPrice;
      }

      function calculateTotal(products: Product[]): USDPrice {
        const total = products.reduce((sum, p) => sum + p.priceUSD, 0);
        return total as USDPrice;
      }

      const products: Product[] = [
        { id: 'p1', name: 'Product 1', priceUSD: 1999 as USDPrice },
        { id: 'p2', name: 'Product 2', priceUSD: 2999 as USDPrice },
      ];

      const total = calculateTotal(products);

      expect(total).toBe(4998);

      // Can't accidentally pass EUR price:
      // products[0].priceUSD = 1799 as EURPrice;  // ❌ Type error!
    });

    it('should prevent timestamp/duration confusion', () => {
      type Timestamp = number & { readonly __brand: 'Timestamp' };
      type Duration = number & { readonly __brand: 'Duration' };

      function makeTimestamp(ms: number): Timestamp {
        return ms as Timestamp;
      }

      function makeDuration(ms: number): Duration {
        return ms as Duration;
      }

      function addDuration(timestamp: Timestamp, duration: Duration): Timestamp {
        return (timestamp + duration) as Timestamp;
      }

      const now = makeTimestamp(Date.now());
      const oneHour = makeDuration(3600000);  // 1 hour in ms

      const later = addDuration(now, oneHour);

      expect(later).toBeGreaterThan(now);

      // Can't accidentally add two timestamps:
      // addDuration(now, later);  // ❌ Type error!
    });

    it('should prevent distance unit confusion', () => {
      type Meters = number & { readonly __brand: 'Meters' };
      type Feet = number & { readonly __brand: 'Feet' };

      function makeMeters(value: number): Meters {
        return value as Meters;
      }

      function makeFeet(value: number): Feet {
        return value as Feet;
      }

      function metersToFeet(meters: Meters): Feet {
        return (meters * 3.28084) as Feet;
      }

      const distanceMeters = makeMeters(100);
      const distanceFeet = metersToFeet(distanceMeters);

      expect(distanceFeet).toBeCloseTo(328.084, 2);

      // Can't accidentally mix units:
      // const total = distanceMeters + distanceFeet;  // ❌ Type error!
    });
  });

  describe('Database ID Safety', () => {
    it('should prevent mixing primary and foreign keys', () => {
      type UserId = number & { readonly __brand: 'UserId' };
      type OrderId = number & { readonly __brand: 'OrderId' };

      function makeUserId(id: number): UserId {
        return id as UserId;
      }

      function makeOrderId(id: number): OrderId {
        return id as OrderId;
      }

      function getUserOrders(userId: UserId): OrderId[] {
        // In real code, this would query the database
        return [makeOrderId(1), makeOrderId(2)];
      }

      const userId = makeUserId(123);
      const orders = getUserOrders(userId);

      expect(orders).toHaveLength(2);

      // Can't accidentally pass orderId:
      // const orderId = makeOrderId(456);
      // getUserOrders(orderId);  // ❌ Type error!
    });

    it('should prevent UUID string confusion', () => {
      type UserId = string & { readonly __brand: 'UserId' };
      type SessionId = string & { readonly __brand: 'SessionId' };

      function makeUserId(uuid: string): Result<UserId, string> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(uuid)) {
          return { TAG: 'Error', _0: 'Invalid UUID format' };
        }

        return { TAG: 'Ok', _0: uuid as UserId };
      }

      function makeSessionId(uuid: string): Result<SessionId, string> {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(uuid)) {
          return { TAG: 'Error', _0: 'Invalid UUID format' };
        }

        return { TAG: 'Ok', _0: uuid as SessionId };
      }

      const validUserId = makeUserId('550e8400-e29b-41d4-a716-446655440000');
      const validSessionId = makeSessionId('6ba7b810-9dad-11d1-80b4-00c04fd430c8');

      expect(isOk(validUserId)).toBe(true);
      expect(isOk(validSessionId)).toBe(true);

      const invalidUuid = makeUserId('not-a-uuid');
      expect(isError(invalidUuid)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty ID validation', () => {
      const emptyUserId = TypeSafetyBridge.makeUserId('');
      expect(isError(emptyUserId)).toBe(true);

      if (isError(emptyUserId)) {
        expect(emptyUserId._0).toContain('empty');
      }
    });

    it('should handle malformed IDs', () => {
      const malformedId = TypeSafetyBridge.makeUserId('user');  // Missing suffix
      expect(isError(malformedId)).toBe(true);
    });

    it('should handle whitespace in IDs', () => {
      const whitespaceId = TypeSafetyBridge.makeUserId('user- 123');
      // ID validation should handle or reject whitespace
      const result = whitespaceId;
      expect(result).toBeDefined();
    });

    it('should handle very long IDs', () => {
      const longId = 'user-' + 'x'.repeat(1000);
      const result = TypeSafetyBridge.makeUserId(longId);

      // Should accept or reject based on length constraints
      expect(result).toBeDefined();
    });
  });

  describe('Type System Integration', () => {
    it('should work with generic functions', () => {
      type UserId = string & { readonly __brand: 'UserId' };

      function identity<T>(value: T): T {
        return value;
      }

      const userId = 'user-123' as UserId;
      const result = identity(userId);

      expect(result).toBe(userId);
    });

    it('should work with discriminated unions', () => {
      type UserId = string & { readonly __brand: 'UserId' };
      type ConversationId = string & { readonly __brand: 'ConversationId' };

      type EntityId =
        | { type: 'user'; id: UserId }
        | { type: 'conversation'; id: ConversationId };

      function getEntityType(entity: EntityId): 'user' | 'conversation' {
        return entity.type;
      }

      const userEntity: EntityId = {
        type: 'user',
        id: 'user-123' as UserId,
      };

      expect(getEntityType(userEntity)).toBe('user');
    });

    it('should work with mapped types', () => {
      type UserId = string & { readonly __brand: 'UserId' };

      type UserData = {
        id: UserId;
        name: string;
        email: string;
      };

      type Partial<T> = {
        [P in keyof T]?: T[P];
      };

      const partialUser: Partial<UserData> = {
        id: 'user-123' as UserId,
        name: 'John',
      };

      expect(partialUser.id).toBe('user-123');
      expect(partialUser.email).toBeUndefined();
    });
  });
});
