import { describe, expect, it, vi } from "vitest";
import { createShippoHandler, validateShippoMode } from "./handler.js";

const buyerAddress = {
  firstName: "Ada",
  lastName: "Lovelace",
  street: "1 Main St",
  city: "Chicago",
  state: "IL",
  zipcode: "60601",
  country: "US",
};

const createRequest = (body) =>
  new Request("http://localhost/shippoShipping", {
    method: "POST",
    headers: { Authorization: "Bearer seller-token" },
    body: JSON.stringify(body),
  });

const createDependencies = (overrides = {}) => ({
  shippoToken: "shippo_test_example",
  shippoMode: "test",
  authenticate: vi.fn().mockResolvedValue({
    user: { id: "seller-1" },
    client: { name: "seller-client" },
  }),
  findSellerOrder: vi.fn().mockResolvedValue({
    id: 7,
    address: buyerAddress,
    fulfillment: null,
  }),
  reserveLabelPurchase: vi.fn().mockResolvedValue(
    "10000000-0000-4000-8000-000000000001"
  ),
  recordLabelPurchase: vi.fn().mockResolvedValue({ order_status: "Shipped" }),
  releaseLabelReservation: vi.fn().mockResolvedValue(undefined),
  fetchImpl: vi.fn(),
  logger: { error: vi.fn() },
  ...overrides,
});

describe("Shippo mode guard", () => {
  it("defaults to test safety and rejects a live token", () => {
    expect(
      validateShippoMode({ shippoMode: "test", shippoToken: "shippo_live_x" })
    ).toEqual(
      expect.objectContaining({ status: 503, error: expect.stringContaining("test") })
    );
  });
});

describe("shippoShipping handler", () => {
  it("rejects a seller without a normalized order line before calling Shippo", async () => {
    const dependencies = createDependencies({
      findSellerOrder: vi.fn().mockResolvedValue(null),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({ action: "buy_label", orderId: 7, rateId: "rate-1" })
    );

    expect(response.status).toBe(403);
    expect(dependencies.fetchImpl).not.toHaveBeenCalled();
    expect(dependencies.reserveLabelPurchase).not.toHaveBeenCalled();
  });

  it("returns test rates without creating a label reservation", async () => {
    const dependencies = createDependencies({
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            object_id: "shipment-1",
            rates: [
              {
                object_id: "rate-1",
                provider: "USPS",
                servicelevel: { name: "Priority" },
                amount: "8.25",
                currency: "USD",
              },
            ],
          }),
          { status: 200 }
        )
      ),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({
        action: "get_rates",
        orderId: 7,
        fromAddress: {
          name: "Seller",
          email: "seller@example.test",
          phone: "555-0100",
          street1: "2 Store St",
          city: "Chicago",
          state: "IL",
          zip: "60602",
          country: "US",
        },
        parcel: { length: 10, width: 8, height: 4, weight: 2 },
      })
    );
    const body = await response.json();

    expect(body).toEqual(
      expect.objectContaining({ success: true, testMode: true, shipmentId: "shipment-1" })
    );
    expect(body.rates[0]).toEqual(
      expect.objectContaining({ id: "rate-1", carrier: "USPS" })
    );
    expect(dependencies.reserveLabelPurchase).not.toHaveBeenCalled();
  });

  it("reserves and records a test label on the current seller fulfillment", async () => {
    const dependencies = createDependencies({
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: "SUCCESS",
            test: true,
            object_id: "transaction-1",
            label_url: "https://labels.example/1.pdf",
            tracking_number: "TRACK-1",
            tracking_url_provider: "https://tracking.example/1",
            rate: {
              object_id: "rate-1",
              provider: "USPS",
              servicelevel: { name: "Priority Mail" },
              amount: "8.25",
              currency: "USD",
            },
          }),
          { status: 201 }
        )
      ),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({
        action: "buy_label",
        orderId: 7,
        rateId: "rate-1",
        selectedRate: { amount: "9999", carrier: "Tampered" },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({ success: true, testMode: true, transactionId: "transaction-1" })
    );
    expect(dependencies.reserveLabelPurchase).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 7, rateId: "rate-1" })
    );
    expect(dependencies.recordLabelPurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 7,
        transactionId: "transaction-1",
        carrier: "USPS",
        rateAmount: 8.25,
      })
    );
  });

  it("blocks repeat purchases when the seller already has a transaction", async () => {
    const dependencies = createDependencies({
      findSellerOrder: vi.fn().mockResolvedValue({
        id: 7,
        address: buyerAddress,
        fulfillment: { shipping_transaction_id: "transaction-existing" },
      }),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({ action: "buy_label", orderId: 7, rateId: "rate-1" })
    );

    expect(response.status).toBe(409);
    expect(dependencies.fetchImpl).not.toHaveBeenCalled();
  });

  it("releases the reservation after an explicit Shippo rejection", async () => {
    const rejected = new Response(JSON.stringify({ detail: "Invalid rate" }), {
      status: 400,
    });
    const dependencies = createDependencies({
      fetchImpl: vi.fn().mockResolvedValue(rejected),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({ action: "buy_label", orderId: 7, rateId: "rate-bad" })
    );

    expect(response.status).toBe(500);
    expect(dependencies.releaseLabelReservation).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 7 })
    );
  });

  it("keeps the reservation after an ambiguous network failure", async () => {
    const dependencies = createDependencies({
      fetchImpl: vi.fn().mockRejectedValue(new Error("network timeout")),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({ action: "buy_label", orderId: 7, rateId: "rate-1" })
    );

    expect(response.status).toBe(500);
    expect(dependencies.releaseLabelReservation).not.toHaveBeenCalled();
  });

  it("keeps the reservation after an ambiguous Shippo server error", async () => {
    const dependencies = createDependencies({
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Temporary provider failure" }), {
          status: 503,
        })
      ),
    });
    const response = await createShippoHandler(dependencies)(
      createRequest({ action: "buy_label", orderId: 7, rateId: "rate-1" })
    );

    expect(response.status).toBe(500);
    expect(dependencies.releaseLabelReservation).not.toHaveBeenCalled();
  });
});
