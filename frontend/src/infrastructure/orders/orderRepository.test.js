import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { createOrderRepository } from "./orderRepository.js";

const createClient = ({
  orders,
  orderItems,
  fulfillments = [],
  profiles = [],
  itemError = null,
  fulfillmentError = null,
  onOrderEq = null,
}) => ({
  from(table) {
    if (table === "orders") {
      const query = {
        select: () => query,
        or: () => query,
        eq: (...args) => {
          onOrderEq?.(...args);
          return query;
        },
        order: () => query,
        range: async () => ({ data: orders, error: null, count: orders.length }),
      };
      return query;
    }

    if (table === "order_items") {
      const query = {
        select: () => query,
        in: () => query,
        order: async () => ({ data: orderItems, error: itemError }),
      };
      return query;
    }

    if (table === "seller_fulfillments") {
      const query = {
        select: () => query,
        in: async () => ({ data: fulfillments, error: fulfillmentError }),
      };
      return query;
    }

    const query = {
      select: () => query,
      in: async () => ({ data: profiles, error: null }),
    };
    return query;
  },
});

describe("order repository", () => {
  test("loads one page and hydrates it with normalized lines", async () => {
    const repository = createOrderRepository(
      createClient({
        orders: [{ id: 7, items: [{ name: "Legacy" }] }],
        orderItems: [
          {
            order_id: 7,
            line_number: 1,
            product_id: "product-1",
            product_name: "Normalized",
            quantity: 2,
          },
        ],
      })
    );

    const result = await repository.findBuyerOrders({
      userId: "buyer-1",
      page: 1,
      pageSize: 10,
      status: "",
      orderId: null,
    });

    assert.equal(result.count, 1);
    assert.equal(result.orders[0].items[0].name, "Normalized");
    assert.equal(result.orders[0].itemsSource, "order_items");
  });

  test("returns legacy lines if the normalized query is unavailable", async () => {
    const originalWarn = console.warn;
    console.warn = () => {};

    try {
      const repository = createOrderRepository(
        createClient({
          orders: [{ id: 8, items: [{ name: "Legacy" }] }],
          orderItems: null,
          itemError: new Error("read failed"),
        })
      );

      const result = await repository.findBuyerOrders({
        userId: "buyer-1",
        page: 1,
        pageSize: 10,
        status: "",
        orderId: null,
      });

      assert.equal(result.orders[0].items[0].name, "Legacy");
      assert.equal(result.orders[0].itemsSource, "orders.items");
    } finally {
      console.warn = originalWarn;
    }
  });

  test("hydrates multi-seller fulfillment and profile data in batches", async () => {
    const repository = createOrderRepository(
      createClient({
        orders: [{ id: 9, status: "Shipped", items: [] }],
        orderItems: [
          { order_id: 9, line_number: 1, seller_id: "seller-1", product_name: "One" },
          { order_id: 9, line_number: 2, seller_id: "seller-2", product_name: "Two" },
        ],
        fulfillments: [
          { order_id: 9, seller_id: "seller-1", status: "shipped", tracking_number: "TRACK-1" },
          { order_id: 9, seller_id: "seller-2", status: "pending" },
        ],
        profiles: [
          { id: "seller-1", name: "First Store" },
          { id: "seller-2", name: "Second Store" },
        ],
      })
    );

    const result = await repository.findBuyerOrders({
      userId: "buyer-1",
      page: 1,
      pageSize: 10,
      status: "",
      orderId: null,
    });

    assert.equal(result.orders[0].displayStatus, "Partially shipped");
    assert.deepEqual(
      result.orders[0].fulfillments.map((shipment) => [
        shipment.sellerName,
        shipment.trackingNumber,
      ]),
      [
        ["First Store", "TRACK-1"],
        ["Second Store", ""],
      ]
    );
  });

  test("searches formatted public order numbers without exposing bigint ids", async () => {
    const filters = [];
    const repository = createOrderRepository(
      createClient({
        orders: [],
        orderItems: [],
        onOrderEq: (...args) => filters.push(args),
      })
    );

    await repository.findBuyerOrders({
      userId: "buyer-1",
      page: 1,
      pageSize: 10,
      status: "",
      orderId: "20260921214530-abcdef-00000123",
    });

    assert.deepEqual(filters, [
      ["order_number", "20260921214530-ABCDEF-00000123"],
    ]);
  });
});
