import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { createCartRepository } from "./cartRepository.js";

const createLoadClient = ({ cart, rows }) => ({
  from(table) {
    if (table === "carts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: cart, error: null }),
          }),
        }),
      };
    }

    return {
      select: () => ({
        eq: () => ({
          order: async () => ({ data: rows, error: null }),
        }),
      }),
    };
  },
});

describe("cart repository", () => {
  test("loads normalized cart lines for a user", async () => {
    const repository = createCartRepository(
      createLoadClient({
        cart: { id: "cart-1", items: { "product-1": { M: 2 } } },
        rows: [
          {
            id: 1,
            product_id: "product-1",
            line_key: "product-1:M",
            quantity: 2,
            size: "M",
          },
        ],
      })
    );

    assert.deepEqual(await repository.findByUserId("user-1"), {
      cartId: "cart-1",
      items: { "product-1": { M: 2 } },
      source: "normalized",
    });
  });

  test("persists one line through the atomic database function", async () => {
    const calls = [];
    const repository = createCartRepository({
      rpc: async (name, params) => {
        calls.push([name, params]);
        return { data: "cart-1", error: null };
      },
    });

    const result = await repository.saveLine({
      productId: "30000000-0000-4000-8000-000000000003",
      sizeKey: "M",
      entry: 2,
      cartItems: {
        "30000000-0000-4000-8000-000000000003": { M: 2 },
      },
    });

    assert.deepEqual(result, { cartId: "cart-1" });
    assert.equal(calls[0][0], "set_cart_line");
    assert.equal(calls[0][1].p_quantity, 2);
    assert.equal(calls[0][1].p_size, "M");
  });

  test("surfaces database failures instead of silently losing cart writes", async () => {
    const repository = createCartRepository({
      rpc: async () => ({ data: null, error: new Error("write failed") }),
    });

    await assert.rejects(
      repository.saveLine({
        productId: "product-1",
        sizeKey: "M",
        entry: 1,
        cartItems: { "product-1": { M: 1 } },
      }),
      /write failed/
    );
  });
});
