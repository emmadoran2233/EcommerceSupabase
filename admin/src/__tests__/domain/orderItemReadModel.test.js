import { describe, expect, test } from "@jest/globals";
import {
  selectSellerOrderItems,
  toFulfillmentStatus,
  toOrderStatus,
  toSellerOrderReadModel,
} from "~/domain/orders/orderItemReadModel.js";

describe("seller order item read model", () => {
  test("uses normalized rows belonging to the current seller", () => {
    const order = {
      id: 7,
      items: [{ seller_id: "seller-1", name: "Legacy" }],
      order_items: [
        {
          line_number: 1,
          product_id: "product-1",
          seller_id: "seller-1",
          product_name: "Normalized",
          quantity: 2,
          unit_amount: 25,
          product_snapshot: { images: ["item.jpg"] },
        },
        {
          line_number: 2,
          seller_id: "seller-2",
          product_name: "Another seller",
        },
      ],
    };

    const result = selectSellerOrderItems(order, "seller-1");

    expect(result.source).toBe("order_items");
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "product-1",
        seller_id: "seller-1",
        name: "Normalized",
        quantity: 2,
        price: 25,
        images: ["item.jpg"],
      }),
    ]);
  });

  test("falls back if historical seller lines are incomplete", () => {
    const order = {
      items: [
        { seller_id: "seller-1", name: "First" },
        { seller_id: "seller-1", name: "Second" },
      ],
      order_items: [
        { line_number: 1, seller_id: "seller-1", product_name: "First" },
      ],
    };

    const result = toSellerOrderReadModel(order, "seller-1");

    expect(result.itemsSource).toBe("orders.items");
    expect(result.items.map((item) => item.name)).toEqual(["First", "Second"]);
  });

  test("uses normalized seller rows when no legacy seller line exists", () => {
    const result = selectSellerOrderItems(
      {
        items: [],
        order_items: [
          { line_number: 1, seller_id: "seller-1", product_name: "New" },
        ],
      },
      "seller-1"
    );

    expect(result.source).toBe("order_items");
    expect(result.items[0].name).toBe("New");
  });

  test("attaches only the current seller fulfillment and exposes its status", () => {
    const result = toSellerOrderReadModel(
      {
        status: "Shipped",
        items: [{ seller_id: "seller-1", name: "Mine" }],
        seller_fulfillments: [
          { seller_id: "seller-1", status: "packing" },
          { seller_id: "seller-2", status: "shipped" },
        ],
      },
      "seller-1"
    );

    expect(result.fulfillment).toEqual({
      seller_id: "seller-1",
      status: "packing",
    });
    expect(result.sellerStatus).toBe("Packing");
  });

  test("maps UI and database fulfillment statuses explicitly", () => {
    expect(toFulfillmentStatus("Out for delivery")).toBe("out_for_delivery");
    expect(toOrderStatus("cancelled")).toBe("Cancelled");
    expect(toFulfillmentStatus("Unknown")).toBeNull();
  });
});
