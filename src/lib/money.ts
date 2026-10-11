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

/** Largest total `Ticket.total` (numeric(12,2)) can store. */
export const MAX_TICKET_TOTAL = 9_999_999_999.99;

/** Round a peso amount to whole cents (2 decimals), avoiding float drift. */
export const roundMoney = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  // Scale to cents, then round half away from zero. toFixed(6) collapses float
  // noise such as 1.005 * 100 = 100.49999999999999 without growing with the
  // magnitude, so large amounts never gain phantom cents (ZIG-I12).
  const scaled = Number((Math.abs(value) * 100).toFixed(6));
  const rounded = Math.round(scaled);
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

/**
 * Sum a collection of `quantity * price` lines. Each line is rounded to cents
 * first, so the total equals the sum of the amounts a document prints (ZIG-I12:
 * with 2-decimal quantities, rounding once at the end can differ by a cent).
 */
export const sumLineTotals = (
  lines: ReadonlyArray<{ quantity: number; price: number }>,
): number => addMoney(...lines.map((line) => multiplyMoney(line.price, line.quantity)));

type MaterialAmountSource = { quantity: number | string; price: number | string };

/** Σ of each material's quantity × price, rounded per material (ZIG-I10). */
export const sumMaterialTotals = (
  materials: ReadonlyArray<MaterialAmountSource> | null | undefined,
): number =>
  addMoney(
    ...(materials ?? []).map((item) =>
      multiplyMoney(Number(item.price), Number(item.quantity)),
    ),
  );

/**
 * A document line's amount: quantity × service price plus its materials.
 * Material quantities are absolute for the line (not multiplied by quantity).
 */
export const lineTotalWithMaterials = (line: {
  quantity: number;
  price: number;
  materials?: ReadonlyArray<MaterialAmountSource> | null;
}): number =>
  addMoney(
    multiplyMoney(line.price, line.quantity),
    sumMaterialTotals(line.materials),
  );
