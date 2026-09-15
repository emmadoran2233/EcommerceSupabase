import { test } from "vitest";
import assert from "node:assert/strict";
import { createCheckoutGateway } from "./checkoutGateway.js";

const makeSupabase = () => {
  const calls = [];
  return {
    calls,
    supabase: {
      rpc: async (name, params) => {
        calls.push(["rpc", name, params]);
        return { data: 7, error: null };
      },
      functions: { invoke: async () => ({ data: { success: true }, error: null }) },
    },
  };
};

test("creates the complete order aggregate through one database RPC", async () => {
  const { supabase, calls } = makeSupabase();
  const gateway = createCheckoutGateway({
    supabase,
    httpClient: {},
    fetchImpl: async () => {},
    supabaseUrl: "https://project.supabase.co",
    backendUrl: "https://backend.test",
    token: "token-1",
  });

  const result = await gateway.createOrder({ amount: 60 });
  assert.deepEqual(result, { order: { id: 7 }, error: null });
  assert.deepEqual(calls, [
    ["rpc", "create_order_with_items", { p_order: { amount: 60 } }],
  ]);
});

test("hosted payments send the existing authenticated JSON request", async () => {
  const requests = [];
  const gateway = createCheckoutGateway({
    supabase: {},
    httpClient: {},
    fetchImpl: async (...args) => {
      requests.push(args);
      return { json: async () => ({ success: true, session_url: "session" }) };
    },
    supabaseUrl: "https://project.supabase.co",
    backendUrl: "https://backend.test",
    token: "token-1",
  });

  const result = await gateway.startHostedPayment({
    functionName: "verifyStripe",
    orderId: 7,
    amount: 60,
  });

  assert.deepEqual(result, { success: true, session_url: "session" });
  assert.equal(requests[0][0], "https://project.supabase.co/functions/v1/verifyStripe");
  assert.deepEqual(requests[0][1], {
    method: "POST",
    headers: {
      Authorization: "Bearer token-1",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId: 7, amount: 60 }),
  });
});

test("Razorpay initialization keeps its backend URL and token contract", async () => {
  const calls = [];
  const gateway = createCheckoutGateway({
    supabase: {},
    fetchImpl: async () => {},
    httpClient: {
      post: async (...args) => {
        calls.push(args);
        return { data: { success: true, order: { id: "rp-1" } } };
      },
    },
    supabaseUrl: "https://project.supabase.co",
    backendUrl: "https://backend.test",
    token: "token-1",
  });

  await gateway.requestRazorpayOrder({ amount: 60 });
  assert.deepEqual(calls[0], [
    "https://backend.test/api/order/razorpay",
    { amount: 60 },
    { headers: { token: "token-1" } },
  ]);
});
