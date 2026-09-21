const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, X-Client-Info, apikey, Content-Type",
  "Content-Type": "application/json",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const cleanString = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizeCountry = (value) => {
  const country = cleanString(value).toUpperCase();
  if (!country || country === "USA" || country === "UNITED STATES") return "US";
  return country;
};

const requireFields = (value, fields) => {
  const missing = fields.find((field) => !cleanString(value[field]));
  return missing ? `Missing ${missing}` : "";
};

const toShippoAddress = (address = {}) => ({
  name: cleanString(address.name),
  street1: cleanString(address.street1),
  city: cleanString(address.city),
  state: cleanString(address.state),
  zip: cleanString(address.zip),
  country: normalizeCountry(address.country),
  phone: cleanString(address.phone),
  email: cleanString(address.email),
});

const toShippoBuyerAddress = (address = {}) => ({
  name: [address.firstName, address.lastName]
    .map((part) => cleanString(part))
    .filter(Boolean)
    .join(" "),
  street1: cleanString(address.street),
  city: cleanString(address.city),
  state: cleanString(address.state),
  zip: cleanString(address.zipcode),
  country: normalizeCountry(address.country),
  phone: cleanString(address.phone),
  email: cleanString(address.email),
});

const toShippoParcel = (parcel = {}) => ({
  length: cleanString(String(parcel.length ?? "")),
  width: cleanString(String(parcel.width ?? "")),
  height: cleanString(String(parcel.height ?? "")),
  distance_unit: cleanString(parcel.distanceUnit || "in"),
  weight: cleanString(String(parcel.weight ?? "")),
  mass_unit: cleanString(parcel.massUnit || "lb"),
});

export const validateShippoMode = ({ shippoMode, shippoToken }) => {
  const mode = cleanString(shippoMode).toLowerCase() || "test";
  if (!shippoToken) {
    return { error: "SHIPPO_API_TOKEN is not configured.", status: 501 };
  }
  if (!new Set(["test", "live"]).has(mode)) {
    return { error: "SHIPPO_MODE must be test or live.", status: 500 };
  }

  const requiredPrefix = mode === "live" ? "shippo_live_" : "shippo_test_";
  if (!shippoToken.startsWith(requiredPrefix)) {
    return {
      error: `SHIPPO_MODE=${mode} requires a ${requiredPrefix} token.`,
      status: 503,
    };
  }

  return { mode };
};

const shippoRequest = async ({ fetchImpl, token, path, body }) => {
  const response = await fetchImpl(`https://api.goshippo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
      "SHIPPO-API-VERSION": "2018-02-08",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.detail || data?.message || data?.error ||
      `Shippo responded with ${response.status}`;
    const error = new Error(
      typeof message === "string" ? message : JSON.stringify(message)
    );
    error.shippoRejected = response.status >= 400 && response.status < 500;
    throw error;
  }

  return data;
};

const transactionRate = (transaction) =>
  transaction?.rate && typeof transaction.rate === "object"
    ? transaction.rate
    : {};

export const createShippoHandler = ({
  shippoToken,
  shippoMode = "test",
  authenticate,
  findSellerOrder,
  reserveLabelPurchase,
  recordLabelPurchase,
  releaseLabelReservation,
  fetchImpl = fetch,
  logger = console,
}) => async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  let purchaseContext = null;
  try {
    const authorization = request.headers.get("Authorization") || "";
    const auth = await authenticate(authorization);
    if (!auth?.user) return json({ success: false, error: "Unauthorized" }, 401);

    const modeResult = validateShippoMode({ shippoMode, shippoToken });
    if (modeResult.error) {
      return json({ success: false, error: modeResult.error }, modeResult.status);
    }

    const body = await request.json().catch(() => ({}));
    const action = cleanString(body.action);
    const orderId = Number(body.orderId);
    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return json({ success: false, error: "Missing orderId" }, 400);
    }

    const order = await findSellerOrder({ orderId, sellerId: auth.user.id });
    if (!order) return json({ success: false, error: "Forbidden" }, 403);

    if (action === "get_rates") {
      const fromAddress = toShippoAddress(body.fromAddress);
      const toAddress = toShippoBuyerAddress(order.address);
      const parcel = toShippoParcel(body.parcel);
      const fromError = requireFields(fromAddress, [
        "name", "email", "phone", "street1", "city", "state", "zip", "country",
      ]);
      if (fromError) return json({ success: false, error: fromError }, 400);
      const toError = requireFields(toAddress, [
        "name", "street1", "city", "state", "zip", "country",
      ]);
      if (toError) {
        return json({ success: false, error: `Buyer address: ${toError}` }, 400);
      }
      const parcelError = requireFields(parcel, [
        "length", "width", "height", "weight",
      ]);
      if (parcelError) return json({ success: false, error: parcelError }, 400);

      const shipment = await shippoRequest({
        fetchImpl,
        token: shippoToken,
        path: "/shipments/",
        body: {
          address_from: fromAddress,
          address_to: toAddress,
          parcels: [parcel],
          async: false,
        },
      });
      const rates = Array.isArray(shipment.rates) ? shipment.rates : [];
      return json({
        success: true,
        testMode: modeResult.mode === "test",
        shipmentId: shipment.object_id,
        rates: rates.map((rate) => ({
          id: rate.object_id,
          carrier: rate.provider,
          service:
            rate.servicelevel?.name || rate.servicelevel_name || rate.service,
          amount: rate.amount,
          currency: rate.currency,
          estimatedDays: rate.estimated_days,
        })),
      });
    }

    if (action === "buy_label") {
      const rateId = cleanString(body.rateId);
      if (!rateId) return json({ success: false, error: "Missing rateId" }, 400);
      if (order.fulfillment?.shipping_transaction_id) {
        return json({ success: false, error: "Label already purchased" }, 409);
      }

      const purchaseToken = await reserveLabelPurchase({
        client: auth.client,
        orderId,
        rateId,
      });
      purchaseContext = { client: auth.client, orderId, purchaseToken };

      const transaction = await shippoRequest({
        fetchImpl,
        token: shippoToken,
        path: "/transactions/",
        body: {
          rate: rateId,
          label_file_type: "PDF",
          async: false,
          metadata: `order:${orderId};seller:${auth.user.id}`.slice(0, 100),
        },
      });

      if (transaction.status && transaction.status !== "SUCCESS") {
        await releaseLabelReservation(purchaseContext);
        purchaseContext = null;
        const messages = Array.isArray(transaction.messages)
          ? transaction.messages.map((message) => JSON.stringify(message)).join(", ")
          : "Shippo label purchase failed";
        throw new Error(messages);
      }
      const transactionIsTest = transaction.test === true;
      if (transactionIsTest !== (modeResult.mode === "test")) {
        throw new Error("Shippo transaction mode did not match configured mode");
      }

      const rate = transactionRate(transaction);
      const parsedRateAmount = Number(rate.amount);
      const rateAmount = Number.isFinite(parsedRateAmount) && parsedRateAmount >= 0
        ? parsedRateAmount
        : null;
      const rawCurrency = cleanString(rate.currency).toUpperCase();
      const rateCurrency = /^[A-Z]{3}$/.test(rawCurrency) ? rawCurrency : "USD";
      const result = await recordLabelPurchase({
        ...purchaseContext,
        rateId,
        transactionId: cleanString(transaction.object_id),
        carrier: cleanString(rate.provider),
        service: cleanString(rate.servicelevel?.name || rate.servicelevel_name),
        rateAmount,
        rateCurrency,
        labelUrl: cleanString(transaction.label_url),
        trackingNumber: cleanString(transaction.tracking_number),
        trackingUrl: cleanString(transaction.tracking_url_provider),
      });
      purchaseContext = null;

      return json({
        success: true,
        testMode: transactionIsTest,
        orderStatus: result?.order_status || "Shipped",
        trackingNumber: cleanString(transaction.tracking_number),
        trackingUrl: cleanString(transaction.tracking_url_provider),
        labelUrl: cleanString(transaction.label_url),
        transactionId: cleanString(transaction.object_id),
      });
    }

    return json({ success: false, error: "Unsupported action" }, 400);
  } catch (error) {
    // A network failure is ambiguous and may have purchased a real label. Keep
    // its reservation so a retry cannot create a duplicate charge.
    if (purchaseContext && error?.shippoRejected) {
      try {
        await releaseLabelReservation(purchaseContext);
      } catch (releaseError) {
        logger.error("Failed to release Shippo reservation:", releaseError);
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error("shippoShipping failed:", message);
    return json({ success: false, error: message }, 500);
  }
};
