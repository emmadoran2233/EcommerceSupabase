import assert from "node:assert/strict";
import { describe, test } from "vitest";
import {
  attachOrderFulfillmentReadModels,
  deriveOrderDisplayStatus,
} from "./orderFulfillmentReadModel.js";

describe("buyer fulfillment read model", () => {
  test("derives partial shipment progress", () => {
    assert.equal(
      deriveOrderDisplayStatus(
        [{ status: "shipped" }, { status: "pending" }],
        "Shipped"
      ),
      "Partially shipped"
    );
    assert.equal(
      deriveOrderDisplayStatus(
        [{ status: "delivered" }, { status: "shipped" }],
        "Shipped"
      ),
      "Partially delivered"
    );
  });

  test("creates one package per seller with independent tracking", () => {
    const [order] = attachOrderFulfillmentReadModels(
      [
        {
          id: 9,
          status: "Shipped",
          items: [
            { seller_id: "seller-1", name: "Camera" },
            { seller_id: "seller-2", name: "Tripod" },
          ],
        },
      ],
      [
        {
          order_id: 9,
          seller_id: "seller-1",
          status: "shipped",
          tracking_number: "TRACK-ONE",
        },
        { order_id: 9, seller_id: "seller-2", status: "pending" },
      ],
      [
        { id: "seller-1", name: "Camera Store" },
        { id: "seller-2", name: "Tripod Store" },
      ]
    );

    assert.equal(order.displayStatus, "Partially shipped");
    assert.equal(order.fulfillments.length, 2);
    assert.deepEqual(
      order.fulfillments.map((shipment) => [
        shipment.sellerName,
        shipment.statusLabel,
        shipment.trackingNumber,
        shipment.items[0].name,
      ]),
      [
        ["Camera Store", "Shipped", "TRACK-ONE", "Camera"],
        ["Tripod Store", "Order Placed", "", "Tripod"],
      ]
    );
  });

  test("adds a pending package when a historical seller fulfillment is missing", () => {
    const [order] = attachOrderFulfillmentReadModels(
      [
        {
          id: 10,
          items: [
            { seller_id: "seller-1", name: "One" },
            { seller_id: "seller-2", name: "Two" },
          ],
        },
      ],
      [{ order_id: 10, seller_id: "seller-1", status: "packing" }],
      []
    );

    assert.equal(order.fulfillments.length, 2);
    assert.equal(order.fulfillments[1].status, "pending");
    assert.equal(order.displayStatus, "Processing");
  });

  test("preserves one legacy shipment when relational data is unavailable", () => {
    const [order] = attachOrderFulfillmentReadModels(
      [
        {
          id: 11,
          status: "Shipped",
          items: [{ name: "Legacy item" }],
          shipping_tracking_number: "LEGACY-TRACK",
        },
      ],
      [],
      []
    );

    assert.equal(order.fulfillmentsSource, "orders");
    assert.equal(order.fulfillments[0].trackingNumber, "LEGACY-TRACK");
  });
});
