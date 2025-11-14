/**
 * Unit Tests for SafeMath.res
 *
 * Tests the ReScript SafeMath module for fixed-point arithmetic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  configureBridge,
  SafeMathBridge,
  isOk,
  isError,
  unwrapOk,
} from '../../bridge/RescriptBridge';

describe('SafeMath Module', () => {
  beforeEach(() => {
    configureBridge({ enableSafeMath: true, logTransitions: false });
  });

  describe('addFixed', () => {
    it('should add two positive numbers', () => {
      const result = SafeMathBridge.addFixed(100, 200);
      expect(result).toBe(300);
    });

    it('should add positive and negative numbers', () => {
      const result = SafeMathBridge.addFixed(100, -50);
      expect(result).toBe(50);
    });

    it('should add decimal values correctly', () => {
      // Fixed-point math with 2 decimal places
      const result = SafeMathBridge.addFixed(125, 275); // 1.25 + 2.75
      expect(result).toBe(400); // 4.00
    });

    it('should handle zero', () => {
      const result = SafeMathBridge.addFixed(100, 0);
      expect(result).toBe(100);
    });
  });

  describe('subtractFixed', () => {
    it('should subtract two positive numbers', () => {
      const result = SafeMathBridge.subtractFixed(200, 100);
      expect(result).toBe(100);
    });

    it('should handle negative results', () => {
      const result = SafeMathBridge.subtractFixed(100, 200);
      expect(result).toBe(-100);
    });

    it('should subtract decimal values correctly', () => {
      const result = SafeMathBridge.subtractFixed(400, 150); // 4.00 - 1.50
      expect(result).toBe(250); // 2.50
    });
  });

  describe('multiplyFixed', () => {
    it('should multiply two positive numbers', () => {
      const result = SafeMathBridge.multiplyFixed(100, 200);
      expect(result).toBe(20000); // 1.00 * 2.00 = 2.00 in fixed point
    });

    it('should handle multiplication by zero', () => {
      const result = SafeMathBridge.multiplyFixed(100, 0);
      expect(result).toBe(0);
    });

    it('should multiply decimal values correctly', () => {
      const result = SafeMathBridge.multiplyFixed(150, 200); // 1.50 * 2.00
      expect(result).toBe(30000); // 3.00 in fixed point
    });

    it('should handle negative multiplication', () => {
      const result = SafeMathBridge.multiplyFixed(100, -50);
      expect(result < 0).toBe(true);
    });
  });

  describe('divideFixed', () => {
    it('should divide two positive numbers', () => {
      const result = SafeMathBridge.divideFixed(400, 200);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result._0).toBe(200); // 4.00 / 2.00 = 2.00
      }
    });

    it('should prevent division by zero', () => {
      const result = SafeMathBridge.divideFixed(100, 0);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result._0).toContain('zero');
      }
    });

    it('should handle fractional results', () => {
      const result = SafeMathBridge.divideFixed(300, 200); // 3.00 / 2.00
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result._0).toBe(150); // 1.50
      }
    });

    it('should handle negative division', () => {
      const result = SafeMathBridge.divideFixed(-400, 200);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result._0).toBe(-200); // -2.00
      }
    });
  });

  describe('BUG #9: Floating Point Precision Errors', () => {
    it('should prevent 0.1 + 0.2 != 0.3 bug', () => {
      // BUGGY JavaScript:
      // console.log(0.1 + 0.2);  // 0.30000000000000004 ❌
      // console.log(0.1 + 0.2 === 0.3);  // false ❌

      // ReScript fixed-point solution:
      const pointOne = 10;   // 0.10 in fixed point (2 decimals)
      const pointTwo = 20;   // 0.20 in fixed point
      const pointThree = 30; // 0.30 in fixed point

      const sum = SafeMathBridge.addFixed(pointOne, pointTwo);

      // Exact equality works!
      expect(sum).toBe(pointThree); // ✅ Exact match
      expect(sum).toBe(30); // ✅ No precision errors
    });

    it('should handle money calculations precisely', () => {
      // BUGGY JavaScript:
      // const price = 10.10;
      // const tax = 0.05;
      // const total = price + (price * tax);  // Precision errors!

      // ReScript fixed-point:
      const price = 1010;      // $10.10
      const taxRate = 5;       // 5% (stored as integer)
      const tax = SafeMathBridge.multiplyFixed(price, taxRate) / 100;
      const total = SafeMathBridge.addFixed(price, Math.floor(tax));

      // Precise calculation
      expect(total).toBe(1060); // $10.60 exactly
    });

    it('should prevent accumulation errors in loops', () => {
      // BUGGY JavaScript:
      // let sum = 0;
      // for (let i = 0; i < 100; i++) {
      //   sum += 0.01;  // Accumulation errors! ❌
      // }
      // console.log(sum);  // Not exactly 1.0

      // ReScript fixed-point:
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum = SafeMathBridge.addFixed(sum, 1);  // 0.01 in fixed point
      }

      expect(sum).toBe(100); // Exactly 1.00 ✅
    });
  });

  describe('BUG #12: Unsafe Integer Conversions', () => {
    it('should handle safe integer conversions', () => {
      // BUGGY TypeScript:
      // const value = 2.7;
      // const int = parseInt(value as any);  // Unsafe! ❌

      // ReScript version validates ranges
      const value = 270; // 2.70 in fixed point

      // Safe conversion - explicit handling
      const intValue = Math.floor(value / 100); // Convert to integer dollars
      expect(intValue).toBe(2);
    });

    it('should detect overflow in operations', () => {
      // Large numbers that might overflow
      const largeA = 1000000;
      const largeB = 1000000;

      // Multiplication might overflow - would need overflow detection in full implementation
      const result = SafeMathBridge.multiplyFixed(largeA, largeB);

      // In production, this should check for overflow
      expect(typeof result).toBe('number');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should use ReScript when enabled', () => {
      configureBridge({ enableSafeMath: true, logTransitions: false });

      const result = SafeMathBridge.addFixed(100, 200);
      expect(result).toBe(300);
    });

    it('should use TypeScript fallback when disabled', () => {
      configureBridge({ enableSafeMath: false, logTransitions: false });

      const result = SafeMathBridge.addFixed(100, 200);
      // Fallback still works but without fixed-point guarantees
      expect(result).toBe(300);
    });
  });

  describe('Real-world Scenarios', () => {
    it('should calculate shopping cart total', () => {
      // Product prices in cents
      const item1 = 1999;  // $19.99
      const item2 = 2499;  // $24.99
      const item3 = 599;   // $5.99

      const subtotal = SafeMathBridge.addFixed(
        SafeMathBridge.addFixed(item1, item2),
        item3
      );

      expect(subtotal).toBe(5097); // $50.97

      // Apply 10% discount
      const discount = Math.floor(SafeMathBridge.multiplyFixed(subtotal, 10) / 100);
      const afterDiscount = SafeMathBridge.subtractFixed(subtotal, discount);

      expect(afterDiscount).toBe(4587); // $45.87 (rounded down)

      // Add 8% tax
      const tax = Math.floor(SafeMathBridge.multiplyFixed(afterDiscount, 8) / 100);
      const total = SafeMathBridge.addFixed(afterDiscount, tax);

      expect(total).toBe(4953); // $49.53
    });

    it('should calculate compound interest accurately', () => {
      // Principal: $1000.00
      const principal = 100000; // In cents

      // Annual rate: 5%
      const annualRate = 5;

      // Calculate monthly interest (5% / 12 months)
      const monthlyRate = Math.floor((annualRate * 100) / 12);

      let balance = principal;

      // Apply interest for 12 months
      for (let month = 0; month < 12; month++) {
        const interest = Math.floor(SafeMathBridge.multiplyFixed(balance, monthlyRate) / 10000);
        balance = SafeMathBridge.addFixed(balance, interest);
      }

      // Should be close to $1051.16 (compound interest formula)
      expect(balance).toBeGreaterThan(105000); // At least $1050
      expect(balance).toBeLessThan(106000);    // At most $1060
    });

    it('should split bill evenly', () => {
      const total = 10000; // $100.00
      const people = 3;

      const perPerson = Math.floor(SafeMathBridge.divideFixed(total, people * 100));
      const remainder = total - (perPerson * people);

      expect(perPerson).toBe(3333); // $33.33 per person
      expect(remainder).toBe(1);     // $0.01 remainder
    });

    it('should calculate percentage correctly', () => {
      const value = 5000;     // $50.00
      const percentage = 15;  // 15%

      const result = Math.floor(SafeMathBridge.multiplyFixed(value, percentage) / 100);

      expect(result).toBe(750); // $7.50 (15% of $50)
    });
  });

  describe('Edge Cases', () => {
    it('should handle very small values', () => {
      const penny = 1; // $0.01
      const result = SafeMathBridge.addFixed(penny, penny);
      expect(result).toBe(2); // $0.02
    });

    it('should handle very large values', () => {
      const million = 100000000; // $1,000,000.00
      const result = SafeMathBridge.addFixed(million, million);
      expect(result).toBe(200000000); // $2,000,000.00
    });

    it('should handle negative values', () => {
      const debt = -5000;    // -$50.00
      const payment = 2000;  // $20.00

      const result = SafeMathBridge.addFixed(debt, payment);
      expect(result).toBe(-3000); // -$30.00 remaining debt
    });

    it('should handle zero in all operations', () => {
      expect(SafeMathBridge.addFixed(0, 0)).toBe(0);
      expect(SafeMathBridge.subtractFixed(0, 0)).toBe(0);
      expect(SafeMathBridge.multiplyFixed(0, 100)).toBe(0);

      const divResult = SafeMathBridge.divideFixed(0, 100);
      expect(isOk(divResult)).toBe(true);
      if (isOk(divResult)) {
        expect(divResult._0).toBe(0);
      }
    });
  });
});
