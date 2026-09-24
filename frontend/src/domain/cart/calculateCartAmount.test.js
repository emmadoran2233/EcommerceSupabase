import { test } from "vitest";
import assert from "node:assert/strict";
import { calculateCartAmount } from "./calculateCartAmount.js";

test("totals regular cart quantities across products", () => {
  const total = calculateCartAmount(
    { 1: { M: 2, L: 1 }, 2: { "One Size": 3 } },
    [{ id: 1, price: 10 }, { id: 2, price: 5 }]
  );
  assert.equal(total, 45);
});

test("uses rental totalPrice instead of catalog price", () => {
  const total = calculateCartAmount(
    { 1: { rent: { quantity: 1, rentInfo: { totalPrice: 75 } } } },
    [{ id: 1, price: 500 }]
  );
  assert.equal(total, 75);
});

test("ignores missing products and non-positive quantities", () => {
  const total = calculateCartAmount(
    { missing: { M: 2 }, 1: { M: 0, L: -1 } },
    [{ id: 1, price: 10 }]
  );
  assert.equal(total, 0);
});
