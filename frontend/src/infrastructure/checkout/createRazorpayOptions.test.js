import { test } from "vitest";
import assert from "node:assert/strict";
import { createRazorpayOptions } from "./createRazorpayOptions.js";

test("maps the provider order into the existing Razorpay browser contract", () => {
  const onPayment = () => {};
  const onDismiss = () => {};
  const options = createRazorpayOptions({
    key: "rzp_test_key",
    order: {
      id: "order-1",
      amount: 6000,
      currency: "USD",
      receipt: "receipt-1",
    },
    onPayment,
    onDismiss,
  });

  assert.deepEqual(options, {
    key: "rzp_test_key",
    amount: 6000,
    currency: "USD",
    name: "Order Payment",
    description: "Order Payment",
    order_id: "order-1",
    receipt: "receipt-1",
    handler: onPayment,
    modal: { ondismiss: onDismiss },
  });
});
