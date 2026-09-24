import { describe, expect, jest, test } from "@jest/globals";
import { createSellerOrderRepository } from "~/infrastructure/orders/orderRepository.js";

describe("seller order repository", () => {
  test("queries normalized lines with orders and removes unrelated orders", async () => {
    const order = jest.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          items: [],
          order_items: [
            { line_number: 1, seller_id: "seller-1", product_name: "Mine" },
          ],
        },
        {
          id: 2,
          items: [],
          order_items: [
            { line_number: 1, seller_id: "seller-2", product_name: "Other" },
          ],
        },
      ],
      error: null,
    });
    const select = jest.fn(() => ({ order }));
    const supabase = { from: jest.fn(() => ({ select })) };

    const orders = await createSellerOrderRepository(supabase).findAll(
      "seller-1"
    );

    expect(supabase.from).toHaveBeenCalledWith("orders");
    expect(select.mock.calls[0][0]).toContain("order_items(");
    expect(select.mock.calls[0][0]).toContain("seller_fulfillments(");
    expect(orders).toHaveLength(1);
    expect(orders[0].items[0].name).toBe("Mine");
  });

  test("updates the current seller fulfillment through the database RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { order_status: "Shipped" },
      error: null,
    });
    const repository = createSellerOrderRepository({ rpc });

    const result = await repository.updateFulfillment({
      orderId: 9,
      status: "shipped",
      trackingNumber: "TRACK-9",
      trackingUrl: "https://tracking.example/9",
    });

    expect(rpc).toHaveBeenCalledWith("update_seller_fulfillment", {
      p_order_id: 9,
      p_status: "shipped",
      p_tracking_number: "TRACK-9",
      p_tracking_url: "https://tracking.example/9",
    });
    expect(result).toEqual({ order_status: "Shipped" });
  });

  test("surfaces fulfillment update failures", async () => {
    const repository = createSellerOrderRepository({
      rpc: jest.fn().mockResolvedValue({
        data: null,
        error: new Error("update failed"),
      }),
    });

    await expect(
      repository.updateFulfillment({ orderId: 9, status: "packing" })
    ).rejects.toThrow("update failed");
  });

  test("surfaces query failures", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          order: async () => ({ data: null, error: new Error("read failed") }),
        }),
      }),
    };

    await expect(
      createSellerOrderRepository(supabase).findAll("seller-1")
    ).rejects.toThrow("read failed");
  });
});
