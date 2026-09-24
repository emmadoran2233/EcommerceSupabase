import { test } from "vitest";
import assert from "node:assert/strict";
import { buildOrderPayload } from "./buildOrderPayload.js";

test("builds the current persisted order contract", () => {
  const address = { city: "Chicago" };
  const items = [{ id: 1, quantity: 2 }];
  const payload = buildOrderPayload({
    address,
    items,
    amount: 50,
    deliveryFee: 10,
    paymentMethod: "stripe",
    userId: "buyer-1",
    checkoutRequestId: "checkout-1",
    now: new Date("2026-08-31T12:00:00.000Z"),
  });

  assert.deepEqual(payload, {
    checkout_request_id: "checkout-1",
    address,
    items,
    amount: 60,
    paymentmethod: "stripe",
    payment: false,
    status: "Order Placed",
    date: "2026-08-31T12:00:00.000Z",
    user_id: "buyer-1",
    buyer_id: "buyer-1",
  });
});
