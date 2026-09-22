import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  attachOrderItemReadModels,
  selectOrderItemReadModels,
  toOrderItemReadModel,
} from "./orderItemReadModel.js";

describe("order item read models", () => {
  test("maps canonical normalized columns over the product snapshot", () => {
    assert.deepEqual(
      toOrderItemReadModel({
        product_id: "product-1",
        seller_id: "seller-1",
        item_type: "purchase",
        product_name: "Current snapshot name",
        quantity: 2,
        unit_amount: 25,
        size: "M",
        product_snapshot: {
          name: "Legacy name",
          images: ["item.jpg"],
        },
      }),
      {
        id: "product-1",
        seller_id: "seller-1",
        name: "Current snapshot name",
        quantity: 2,
        price: 25,
        size: "M",
        customization: undefined,
        images: ["item.jpg"],
      }
    );
  });

  test("preserves rental and customization snapshots", () => {
    const item = toOrderItemReadModel({
      product_id: "product-2",
      item_type: "rental",
      product_name: "Camera",
      quantity: 1,
      line_amount: 80,
      customization: { lines: ["A"] },
      rental_start_date: "2026-10-01",
      rental_end_date: "2026-10-03",
      product_snapshot: { rentInfo: { deposit: 100 } },
    });

    assert.equal(item.rentable, true);
    assert.deepEqual(item.customization, { lines: ["A"] });
    assert.deepEqual(item.rentInfo, {
      deposit: 100,
      startDate: "2026-10-01",
      endDate: "2026-10-03",
      rentFee: 80,
      totalPrice: 80,
    });
  });

  test("falls back when historical normalized lines are incomplete", () => {
    const legacyItems = [{ name: "One" }, { name: "Two" }];
    const result = selectOrderItemReadModels({
      legacyItems,
      normalizedRows: [{ line_number: 1, product_name: "One" }],
    });

    assert.equal(result.source, "orders.items");
    assert.equal(result.items, legacyItems);
  });

  test("attaches batched rows to their matching orders", () => {
    const result = attachOrderItemReadModels(
      [
        { id: 10, items: [{ name: "Old one" }] },
        { id: 11, items: [{ name: "Old two" }] },
      ],
      [
        { order_id: 11, line_number: 1, product_name: "New two" },
        { order_id: 10, line_number: 1, product_name: "New one" },
      ]
    );

    assert.deepEqual(
      result.map((order) => [order.items[0].name, order.itemsSource]),
      [
        ["New one", "order_items"],
        ["New two", "order_items"],
      ]
    );
  });
});
