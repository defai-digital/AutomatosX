/**
 * sample-assemblyscript-basic.ts
 * Basic AssemblyScript patterns: functions, classes, WebAssembly types
 */

// ===== WebAssembly Primitive Type Functions =====

export function add(a: i32, b: i32): i32 {
  return a + b;
}

export function subtract(a: i64, b: i64): i64 {
  return a - b;
}

export function multiply(a: f32, b: f32): f32 {
  return a * b;
}

export function divide(a: f64, b: f64): f64 {
  return a / b;
}

export function unsignedAdd(a: u32, b: u32): u32 {
  return a + b;
}

// ===== Classes =====

export class Calculator {
  private result: i32 = 0;

  add(value: i32): void {
    this.result += value;
  }

  subtract(value: i32): void {
    this.result -= value;
  }

  multiply(value: i32): void {
    this.result *= value;
  }

  getResult(): i32 {
    return this.result;
  }

  reset(): void {
    this.result = 0;
  }
}

export class Counter {
  private count: i32 = 0;

  increment(): void {
    this.count += 1;
  }

  decrement(): void {
    this.count -= 1;
  }

  getValue(): i32 {
    return this.count;
  }
}

export class Point {
  x: f64;
  y: f64;

  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }

  distance(other: Point): f64 {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}

// ===== Memory Operations =====

export function allocateMemory(size: i32): usize {
  return memory.allocate(size);
}

export function freeMemory(ptr: usize): void {
  memory.free(ptr);
}

export function getMemorySize(): i32 {
  return memory.size();
}

// ===== Array and Buffer Operations =====

export function sumArray(arr: Int32Array): i32 {
  let sum: i32 = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += unchecked(arr[i]);
  }
  return sum;
}

export function fillBuffer(buffer: Uint8Array, value: u8): void {
  for (let i = 0; i < buffer.length; i++) {
    unchecked(buffer[i] = value);
  }
}

// ===== String Operations =====

export function concatenate(a: string, b: string): string {
  return a + b;
}

export function getStringLength(s: string): i32 {
  return s.length;
}

// ===== Type Conversions =====

export function i32ToF32(value: i32): f32 {
  return f32(value);
}

export function f64ToI64(value: f64): i64 {
  return i64(value);
}

// ===== Bitwise Operations =====

export function bitwiseAnd(a: i32, b: i32): i32 {
  return a & b;
}

export function bitwiseOr(a: i32, b: i32): i32 {
  return a | b;
}

export function bitwiseXor(a: i32, b: i32): i32 {
  return a ^ b;
}

export function leftShift(value: i32, shift: i32): i32 {
  return value << shift;
}

export function rightShift(value: i32, shift: i32): i32 {
  return value >> shift;
}

// ===== Math Operations =====

export function absolute(value: f64): f64 {
  return Math.abs(value);
}

export function power(base: f64, exponent: f64): f64 {
  return Math.pow(base, exponent);
}

export function squareRoot(value: f64): f64 {
  return Math.sqrt(value);
}

// ===== Comparison Functions =====

export function min(a: i32, b: i32): i32 {
  return a < b ? a : b;
}

export function max(a: i32, b: i32): i32 {
  return a > b ? a : b;
}

export function clamp(value: i32, minValue: i32, maxValue: i32): i32 {
  return Math.min(Math.max(value, minValue), maxValue);
}
