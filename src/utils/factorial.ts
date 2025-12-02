/**
 * Calculates the factorial of a non-negative integer.
 * Uses an iterative loop to avoid call-stack overhead.
 */
export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error('factorial expects a non-negative integer');
  }

  let result = 1;
  for (let i = 2; i <= n; i += 1) {
    result *= i;
  }

  return result;
}
