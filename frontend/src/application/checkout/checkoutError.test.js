import { test } from "vitest";
import assert from "node:assert/strict";
import { checkoutErrorCodes, toCheckoutError } from "./checkoutError.js";

test("normalizes Error instances into a stable checkout error", () => {
  assert.deepEqual(
    toCheckoutError(new Error("Database unavailable"), {
      code: checkoutErrorCodes.orderCreationFailed,
    }),
    { code: "order_creation_failed", message: "Database unavailable" }
  );
});

test("uses a safe fallback when the provider gives no useful error", () => {
  assert.deepEqual(
    toCheckoutError(null, {
      code: checkoutErrorCodes.paymentInitializationFailed,
      fallbackMessage: "Payment could not be initialized.",
    }),
    {
      code: "payment_initialization_failed",
      message: "Payment could not be initialized.",
    }
  );
});
