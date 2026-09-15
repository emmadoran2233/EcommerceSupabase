import { test } from "vitest";
import assert from "node:assert/strict";
import { submitCheckout } from "./submitCheckout.js";

const makeGateway = (overrides = {}) => {
  const calls = [];
  return {
    calls,
    gateway: {
      createOrder: async (orderData) => {
        calls.push(["createOrder", orderData]);
        return { order: { id: 42 }, error: null };
      },
      notifyOrderSubmitted: async (orderId) => {
        calls.push(["notifyOrderSubmitted", orderId]);
      },
      startHostedPayment: async (request) => {
        calls.push(["startHostedPayment", request]);
        return { success: true, session_url: "https://payments.test/session" };
      },
      requestRazorpayOrder: async (orderData) => {
        calls.push(["requestRazorpayOrder", orderData]);
        return { success: true, order: { id: "razor-order" } };
      },
      ...overrides,
    },
  };
};

const orderData = { amount: 60, items: [{ id: 1 }] };

test("COD persists, notifies, and completes without starting payment", async () => {
  const { gateway, calls } = makeGateway();
  const result = await submitCheckout({ method: "cod", orderData, gateway });

  assert.deepEqual(result, { kind: "completed", orderId: 42 });
  assert.deepEqual(calls, [
    ["createOrder", orderData],
    ["notifyOrderSubmitted", 42],
  ]);
});

test("Stripe preserves the existing Edge Function request contract", async () => {
  const { gateway, calls } = makeGateway();
  const result = await submitCheckout({ method: "stripe", orderData, gateway });

  assert.deepEqual(result, {
    kind: "redirect",
    url: "https://payments.test/session",
  });
  assert.deepEqual(calls[2], [
    "startHostedPayment",
    { functionName: "verifyStripe", orderId: 42, amount: 60 },
  ]);
});

test("Google Pay preserves its current Edge Function request contract", async () => {
  const { gateway, calls } = makeGateway();
  await submitCheckout({ method: "googlepay", orderData, gateway });

  assert.deepEqual(calls[2], [
    "startHostedPayment",
    { functionName: "verifyGooglePay", orderId: 42, amount: 60 },
  ]);
});

test("Razorpay returns the provider order for the UI adapter", async () => {
  const { gateway } = makeGateway();
  const result = await submitCheckout({ method: "razorpay", orderData, gateway });
  assert.deepEqual(result, { kind: "razorpay", order: { id: "razor-order" } });
});

test("order persistence failure stops notifications and payment", async () => {
  const { gateway, calls } = makeGateway({
    createOrder: async () => {
      calls.push(["createOrder"]);
      return { order: null, error: new Error("Insert failed") };
    },
  });
  const result = await submitCheckout({ method: "stripe", orderData, gateway });

  assert.deepEqual(result, {
    kind: "error",
    error: { code: "order_creation_failed", message: "Insert failed" },
  });
  assert.deepEqual(calls, [["createOrder"]]);
});

test("hosted payment errors use the provider response without live payment", async () => {
  const { gateway } = makeGateway({
    startHostedPayment: async () => ({ success: false, error: "Test mode only" }),
  });
  const result = await submitCheckout({ method: "stripe", orderData, gateway });
  assert.deepEqual(result, {
    kind: "error",
    error: {
      code: "payment_initialization_failed",
      message: "Test mode only",
    },
  });
});

test("reports lifecycle phases without exposing provider implementation", async () => {
  const { gateway } = makeGateway();
  const phases = [];
  await submitCheckout({
    method: "stripe",
    orderData,
    gateway,
    onPhaseChange: (phase) => phases.push(phase),
  });
  assert.deepEqual(phases, ["creating_order", "initializing_payment"]);
});

test("unknown payment methods do not create an order", async () => {
  const { gateway, calls } = makeGateway();
  const result = await submitCheckout({ method: "unknown", orderData, gateway });
  assert.deepEqual(result, { kind: "ignored" });
  assert.deepEqual(calls, []);
});
