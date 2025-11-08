/**
 * sample-assemblyscript-advanced.ts
 * Advanced AssemblyScript patterns: decorators, memory management, optimizations
 */

// ===== Inline Functions (Performance Optimization) =====

@inline
export function fastAdd(a: i32, b: i32): i32 {
  return a + b;
}

@inline
export function fastMultiply(a: f32, b: f32): f32 {
  return a * b;
}

// ===== External Imports =====

@external("env", "log")
declare function log(value: i32): void;

@external("env", "consoleLog")
declare function consoleLog(message: string): void;

@external("Math", "random")
declare function random(): f64;

// ===== Unsafe Operations =====

@unsafe
export function unsafeMemoryCopy(dest: usize, src: usize, len: usize): void {
  memory.copy(dest, src, len);
}

@unsafe
export function unsafeMemoryFill(dest: usize, value: u8, len: usize): void {
  memory.fill(dest, value, len);
}

// ===== Advanced Memory Management =====

export class MemoryPool {
  private baseAddress: usize;
  private size: i32;
  private used: i32 = 0;

  constructor(size: i32) {
    this.size = size;
    this.baseAddress = memory.allocate(size);
    this.used = 0;
  }

  allocate(bytes: i32): usize {
    if (this.used + bytes > this.size) {
      return 0; // Out of memory
    }
    const address = this.baseAddress + this.used;
    this.used += bytes;
    return address;
  }

  reset(): void {
    this.used = 0;
  }

  free(): void {
    memory.free(this.baseAddress);
  }
}

// ===== SIMD Operations (WebAssembly SIMD) =====

export function vectorAdd(a: v128, b: v128): v128 {
  return i32x4.add(a, b);
}

export function vectorMultiply(a: v128, b: v128): v128 {
  return f32x4.mul(a, b);
}

// ===== Generic Classes =====

export class Box<T> {
  value: T;

  constructor(value: T) {
    this.value = value;
  }

  getValue(): T {
    return this.value;
  }

  setValue(value: T): void {
    this.value = value;
  }
}

export class Pair<K, V> {
  key: K;
  value: V;

  constructor(key: K, value: V) {
    this.key = key;
    this.value = value;
  }

  getKey(): K {
    return this.key;
  }

  getValue(): V {
    return this.value;
  }
}

// ===== Operator Overloading =====

export class Vector2 {
  x: f64;
  y: f64;

  constructor(x: f64, y: f64) {
    this.x = x;
    this.y = y;
  }

  @operator("+")
  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  @operator("-")
  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  @operator("*")
  scale(scalar: f64): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }
}

// ===== Linked List Implementation =====

export class ListNode<T> {
  value: T;
  next: ListNode<T> | null = null;

  constructor(value: T) {
    this.value = value;
  }
}

export class LinkedList<T> {
  private head: ListNode<T> | null = null;
  private size: i32 = 0;

  push(value: T): void {
    const newNode = new ListNode<T>(value);
    if (this.head === null) {
      this.head = newNode;
    } else {
      let current = this.head;
      while (current.next !== null) {
        current = current.next;
      }
      current.next = newNode;
    }
    this.size++;
  }

  pop(): T | null {
    if (this.head === null) return null;

    if (this.head.next === null) {
      const value = this.head.value;
      this.head = null;
      this.size--;
      return value;
    }

    let current = this.head;
    while (current.next && current.next.next !== null) {
      current = current.next;
    }

    const value = current.next!.value;
    current.next = null;
    this.size--;
    return value;
  }

  getSize(): i32 {
    return this.size;
  }
}

// ===== Hash Map Implementation =====

export class HashMap<K, V> {
  private keys: Array<K>;
  private values: Array<V>;

  constructor() {
    this.keys = new Array<K>();
    this.values = new Array<V>();
  }

  set(key: K, value: V): void {
    const index = this.keys.indexOf(key);
    if (index === -1) {
      this.keys.push(key);
      this.values.push(value);
    } else {
      this.values[index] = value;
    }
  }

  get(key: K): V | null {
    const index = this.keys.indexOf(key);
    if (index === -1) return null;
    return this.values[index];
  }

  has(key: K): boolean {
    return this.keys.indexOf(key) !== -1;
  }

  delete(key: K): boolean {
    const index = this.keys.indexOf(key);
    if (index === -1) return false;

    this.keys.splice(index, 1);
    this.values.splice(index, 1);
    return true;
  }

  size(): i32 {
    return this.keys.length;
  }
}

// ===== Atomic Operations (WebAssembly Threads) =====

export function atomicAdd(ptr: usize, value: i32): i32 {
  return atomic.add<i32>(ptr, value);
}

export function atomicSub(ptr: usize, value: i32): i32 {
  return atomic.sub<i32>(ptr, value);
}

export function atomicCompareExchange(ptr: usize, expected: i32, replacement: i32): i32 {
  return atomic.cmpxchg<i32>(ptr, expected, replacement);
}

// ===== Fixed-Point Arithmetic =====

export class FixedPoint {
  private value: i32;
  private static readonly SCALE: i32 = 1000;

  constructor(value: f64) {
    this.value = i32(value * FixedPoint.SCALE);
  }

  add(other: FixedPoint): FixedPoint {
    const result = new FixedPoint(0);
    result.value = this.value + other.value;
    return result;
  }

  multiply(other: FixedPoint): FixedPoint {
    const result = new FixedPoint(0);
    result.value = (this.value * other.value) / FixedPoint.SCALE;
    return result;
  }

  toFloat(): f64 {
    return f64(this.value) / f64(FixedPoint.SCALE);
  }
}

// ===== Performance-Critical Functions =====

@inline
export function fastHash(value: i32): i32 {
  let hash = value;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = ((hash >> 16) ^ hash) * 0x45d9f3b;
  hash = (hash >> 16) ^ hash;
  return hash;
}

@inline
export function isPowerOfTwo(value: i32): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

@inline
export function nextPowerOfTwo(value: i32): i32 {
  value--;
  value |= value >> 1;
  value |= value >> 2;
  value |= value >> 4;
  value |= value >> 8;
  value |= value >> 16;
  value++;
  return value;
}
