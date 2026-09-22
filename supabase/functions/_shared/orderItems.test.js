import { describe, expect, it, vi } from "vitest";
import {
  hydrateOrdersWithItems,
  resolveOrderItems,
  toOrderItemSnapshot,
} from "./orderItems.js";

describe("resolveOrderItems", () => {
  it("prefers complete normalized order lines", () => {
    const result = resolveOrderItems({
      legacyItems: [{ id: "legacy-product", name: "Legacy name" }],
      normalizedRows: [
        {
          line_number: 1,
          product_id: "normalized-product",
          seller_id: "seller-1",
          item_type: "purchase",
          product_name: "Normalized name",
          quantity: 2,
          unit_amount: 12.5,
          line_amount: 25,
          product_snapshot: { images: ["https://example.com/item.jpg"] },
        },
      ],
    });

    expect(result.source).toBe("order_items");
    expect(result.items).toEqual([
      expect.objectContaining({
        id: "normalized-product",
        seller_id: "seller-1",
        name: "Normalized name",
        quantity: 2,
        price: 12.5,
        images: ["https://example.com/item.jpg"],
      }),
    ]);
  });

  it("falls back when historical normalized lines are incomplete", () => {
    const legacyItems = [
      { id: "product-1", name: "First" },
      { id: "product-2", name: "Second" },
    ];

    const result = resolveOrderItems({
      legacyItems,
      normalizedRows: [{ line_number: 1, product_name: "First" }],
    });

    expect(result).toEqual({ items: legacyItems, source: "orders.items" });
  });

  it("falls back when normalized line numbers contain a gap", () => {
    const legacyItems = [{ name: "First" }, { name: "Second" }];
    const result = resolveOrderItems({
      legacyItems,
      normalizedRows: [
        { line_number: 1, product_name: "First" },
        { line_number: 3, product_name: "Third" },
      ],
    });

    expect(result.source).toBe("orders.items");
  });

  it("uses normalized lines when no legacy snapshot exists", () => {
    const result = resolveOrderItems({
      legacyItems: null,
      normalizedRows: [{ line_number: 1, product_name: "Only source" }],
    });

    expect(result.source).toBe("order_items");
    expect(result.items[0].name).toBe("Only source");
  });
});

describe("toOrderItemSnapshot", () => {
  it("reconstructs the legacy rental contract from normalized columns", () => {
    const row = {
      product_id: "rental-product",
      seller_id: "seller-2",
      item_type: "rental",
      product_name: "Rental camera",
      quantity: 1,
      unit_amount: 80,
      line_amount: 80,
      rental_start_date: "2026-09-20",
      rental_end_date: "2026-09-22",
      customization: { lines: ["A"] },
      product_snapshot: {
        category: "Camera",
        rentInfo: { deposit: 200 },
      },
    };

    expect(toOrderItemSnapshot(row)).toEqual(
      expect.objectContaining({
        id: "rental-product",
        rentable: true,
        category: "Camera",
        customization: { lines: ["A"] },
        rentInfo: {
          deposit: 200,
          startDate: "2026-09-20",
          endDate: "2026-09-22",
          rentFee: 80,
          totalPrice: 80,
        },
      })
    );
  });

  it("does not mutate the stored product snapshot", () => {
    const snapshot = { name: "Old name", rentInfo: { deposit: 50 } };
    toOrderItemSnapshot({
      item_type: "rental",
      product_name: "New name",
      product_snapshot: snapshot,
    });

    expect(snapshot).toEqual({ name: "Old name", rentInfo: { deposit: 50 } });
  });
});

describe("hydrateOrdersWithItems", () => {
  const createSupabase = (result) => {
    const order = vi.fn().mockResolvedValue(result);
    const query = {
      select: vi.fn(() => query),
      in: vi.fn(() => query),
      order,
    };

    return {
      client: { from: vi.fn(() => query) },
      query,
    };
  };

  it("loads all requested order lines in one query", async () => {
    const { client, query } = createSupabase({
      data: [
        { order_id: 10, line_number: 1, product_name: "First" },
        { order_id: 11, line_number: 1, product_name: "Second" },
      ],
      error: null,
    });

    const orders = await hydrateOrdersWithItems(client, [
      { id: 10, items: [{ name: "Legacy first" }] },
      { id: 11, items: [{ name: "Legacy second" }] },
    ]);

    expect(client.from).toHaveBeenCalledOnce();
    expect(client.from).toHaveBeenCalledWith("order_items");
    expect(query.in).toHaveBeenCalledWith("order_id", [10, 11]);
    expect(orders.map((order) => order.items[0].name)).toEqual([
      "First",
      "Second",
    ]);
    expect(orders.every((order) => order.items_source === "order_items")).toBe(
      true
    );
  });

  it("preserves legacy items when the normalized query fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = createSupabase({
      data: null,
      error: { message: "temporary database error" },
    });

    const [order] = await hydrateOrdersWithItems(client, [
      { id: 12, items: [{ name: "Legacy item" }] },
    ]);

    expect(order.items).toEqual([{ name: "Legacy item" }]);
    expect(order.items_source).toBe("orders.items");
    expect(warning).toHaveBeenCalledWith(
      "Falling back to legacy orders.items:",
      "temporary database error"
    );
    warning.mockRestore();
  });
});
