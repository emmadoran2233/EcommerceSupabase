import { test } from "vitest";
import assert from "node:assert/strict";
import { calculateRentalQuote } from "./calculateRentalQuote.js";

test("deposit fills the gap between rent and product price", () => {
  assert.deepEqual(
    calculateRentalQuote({ days: 3, dailyRate: 20, productPrice: 100 }),
    { days: 3, rentFee: 60, deposit: 40, totalPrice: 100 }
  );
});

test("deposit reaches zero when rent exceeds product price", () => {
  assert.deepEqual(
    calculateRentalQuote({ days: 6, dailyRate: 20, productPrice: 100 }),
    { days: 6, rentFee: 120, deposit: 0, totalPrice: 120 }
  );
});

test("one-day rentals remain inclusive", () => {
  assert.deepEqual(
    calculateRentalQuote({ days: 1, dailyRate: 20, productPrice: 100 }),
    { days: 1, rentFee: 20, deposit: 80, totalPrice: 100 }
  );
});
