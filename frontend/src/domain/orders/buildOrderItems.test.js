import { test } from "vitest";
import assert from "node:assert/strict";
import { buildOrderItems } from "./buildOrderItems.js";

test("converts a regular cart entry into the existing order item shape", () => {
  const items = buildOrderItems(
    { 10: { M: 2 } },
    [{ id: 10, name: "Shirt", price: 25 }]
  );

  assert.deepEqual(items, [
    { id: 10, name: "Shirt", price: 25, size: "M", size_key: "M", quantity: 2 },
  ]);
});

test("preserves customization identity and its base size", () => {
  const customization = { id: "custom-1", lines: ["HELLO"], color: "red" };
  const items = buildOrderItems(
    {
      10: {
        "M|custom:custom-1": { quantity: 1, baseSize: "M", customization },
      },
    },
    [{ id: "10", name: "Custom shirt", price: 40 }]
  );

  assert.equal(items[0].size, "M");
  assert.equal(items[0].size_key, "M|custom:custom-1");
  assert.deepEqual(items[0].customization, customization);
});

test("preserves rental dates and ignores invalid or missing products", () => {
  const rentInfo = { startDate: "2026-09-01", endDate: "2026-09-03", totalPrice: 60 };
  const items = buildOrderItems(
    {
      20: { "rent_2026-09-01_to_2026-09-03": { quantity: 1, rentInfo } },
      21: { M: 0 },
      missing: { M: 1 },
    },
    [{ id: 20, name: "Camera", rentable: true }]
  );

  assert.equal(items.length, 1);
  assert.deepEqual(items[0].rentInfo, rentInfo);
  assert.equal(items[0].quantity, 1);
});

test("does not mutate the catalog product", () => {
  const product = { id: 10, name: "Shirt", metadata: { source: "catalog" } };
  buildOrderItems({ 10: { M: 1 } }, [product]);
  assert.deepEqual(product, { id: 10, name: "Shirt", metadata: { source: "catalog" } });
});
