import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  cartItemRowsToState,
  normalizeLegacyCart,
  selectReadableCart,
  setCartLineQuantity,
  toCartLinePayload,
} from "./cartState.js";

describe("cart state mapping", () => {
  test("maps a customized cart entry to normalized persistence fields", () => {
    const payload = toCartLinePayload({
      productId: "30000000-0000-4000-8000-000000000003",
      sizeKey: "M|custom:custom-1",
      entry: {
        quantity: 2,
        baseSize: "M",
        customization: { id: "custom-1", lines: ["HELLO"] },
      },
    });

    assert.deepEqual(payload, {
      productId: "30000000-0000-4000-8000-000000000003",
      lineKey:
        "30000000-0000-4000-8000-000000000003:M|custom:custom-1",
      quantity: 2,
      size: "M",
      customization: { id: "custom-1", lines: ["HELLO"] },
      rentalStartDate: null,
      rentalEndDate: null,
      rentalQuote: null,
    });
  });

  test("normalizes rental dates while preserving the display quote", () => {
    const payload = toCartLinePayload({
      productId: "30000000-0000-4000-8000-000000000003",
      sizeKey: "rent_2026-09-15_to_2026-09-17",
      entry: {
        quantity: 1,
        rentInfo: {
          startDate: new Date("2026-09-15T12:00:00Z"),
          endDate: new Date("2026-09-17T12:00:00Z"),
          days: 3,
          rentFee: 60,
          deposit: 40,
          totalPrice: 100,
        },
      },
    });

    assert.equal(payload.rentalStartDate, "2026-09-15");
    assert.equal(payload.rentalEndDate, "2026-09-17");
    assert.equal(payload.rentalQuote.totalPrice, 100);
    assert.equal(payload.size, null);
  });

  test("rebuilds the existing UI cart shape from normalized rows", () => {
    const cart = cartItemRowsToState([
      {
        product_id: "product-1",
        line_key: "product-1:M",
        quantity: 2,
        size: "M",
        customization: null,
        rental_quote: null,
      },
      {
        product_id: "product-2",
        line_key: "product-2:rent_2026-09-15_to_2026-09-17",
        quantity: 1,
        size: null,
        customization: null,
        rental_start_date: "2026-09-15",
        rental_end_date: "2026-09-17",
        rental_quote: { days: 3, totalPrice: 100 },
      },
    ]);

    assert.equal(cart["product-1"].M, 2);
    assert.deepEqual(
      cart["product-2"]["rent_2026-09-15_to_2026-09-17"].rentInfo,
      {
        days: 3,
        totalPrice: 100,
        startDate: "2026-09-15",
        endDate: "2026-09-17",
      }
    );
  });

  test("falls back when normalized rows do not cover every legacy line", () => {
    const result = selectReadableCart({
      normalizedRows: [
        {
          product_id: "product-1",
          line_key: "product-1:M",
          quantity: 1,
        },
      ],
      legacyItems: { "product-1": { M: 1 }, "product-2": { L: 1 } },
    });

    assert.equal(result.source, "legacy-fallback");
    assert.deepEqual(result.items, {
      "product-1": { M: 1 },
      "product-2": { L: 1 },
    });
  });

  test("removes empty lines and product buckets immutably", () => {
    const original = { "product-1": { M: 1 } };
    const result = setCartLineQuantity(original, "product-1", "M", 0);

    assert.deepEqual(result, {});
    assert.deepEqual(original, { "product-1": { M: 1 } });
  });

  test("normalizes the legacy reorder array shape", () => {
    assert.deepEqual(
      normalizeLegacyCart([{ id: "product-1", size: "L", quantity: 2 }]),
      { "product-1": { L: 2 } }
    );
  });
});
