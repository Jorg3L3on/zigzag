/**
 * Money helpers.
 *
 * Money is persisted as PostgreSQL `numeric(12,2)` and represented in the app as
 * a `number` in major units (MXN pesos). Even though storage is exact, JavaScript
 * arithmetic on those numbers is still binary floating point, so intermediate
 * computations (sums, line totals) must be rounded back to cents to avoid drift
 * such as `0.1 + 0.2 === 0.30000000000000004`.
 *
 * Always run currency math through these helpers before persisting a value.
 */

/** Round a peso amount to whole cents (2 decimals), avoiding float drift. */
export const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  // Scale to cents, then round half away from zero. A relative epsilon nudge
  // corrects values like 1.005 that float storage holds as 1.00499999..., which
  // would otherwise round down to 1.00.
  const scaled = Math.abs(value) * 100;
  const epsilon = scaled * 1e-9 + 1e-9;
  const rounded = Math.round(scaled + epsilon);
  const signed = value < 0 ? -rounded : rounded;
  return signed / 100;
};

/** Add money amounts, rounding the result to cents. */
export const addMoney = (...values: number[]): number =>
  roundMoney(values.reduce((sum, value) => sum + value, 0));

/** Subtract `b` from `a`, rounding the result to cents. */
export const subtractMoney = (a: number, b: number): number => roundMoney(a - b);

/** Multiply a unit price by a quantity, rounding the result to cents. */
export const multiplyMoney = (price: number, quantity: number): number =>
  roundMoney(price * quantity);

/** Sum a collection of `quantity * price` lines, rounded to cents. */
export const sumLineTotals = (
  lines: ReadonlyArray<{ quantity: number; price: number }>,
): number =>
  roundMoney(
    lines.reduce((sum, line) => sum + line.quantity * line.price, 0),
  );
