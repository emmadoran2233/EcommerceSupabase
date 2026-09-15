import { test } from "vitest";
import assert from "node:assert/strict";
import { validateCheckout } from "./validateCheckout.js";

const validCheckout = {
  items: [{ id: 1, quantity: 1 }],
  subtotal: 50,
  deliveryFee: 10,
  paymentMethod: "stripe",
};

test("accepts a valid checkout request", () => {
  assert.deepEqual(validateCheckout(validCheckout), { valid: true });
});

test("rejects carts with no valid order items", () => {
  assert.deepEqual(validateCheckout({ ...validCheckout, items: [] }), {
    valid: false,
    code: "empty_cart",
    message: "Your cart has no valid items.",
  });
});

test("rejects zero, NaN, and infinite subtotals", () => {
  for (const subtotal of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      validateCheckout({ ...validCheckout, subtotal }).code,
      "invalid_subtotal"
    );
  }
});

test("rejects negative or non-finite delivery fees", () => {
  for (const deliveryFee of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(
      validateCheckout({ ...validCheckout, deliveryFee }).code,
      "invalid_delivery_fee"
    );
  }
});

test("rejects payment methods outside the supported contract", () => {
  assert.equal(
    validateCheckout({ ...validCheckout, paymentMethod: "crypto" }).code,
    "unsupported_payment"
  );
});
