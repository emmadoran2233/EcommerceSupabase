const STATUS_LABELS = {
  pending: "Order Placed",
  packing: "Packing",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const toFulfillmentStatusLabel = (status) =>
  STATUS_LABELS[status] || "Order Placed";

export const deriveOrderDisplayStatus = (fulfillments, fallbackStatus) => {
  const statuses = (Array.isArray(fulfillments) ? fulfillments : [])
    .map((row) => row?.status)
    .filter(Boolean);
  if (!statuses.length) return fallbackStatus || "Order Placed";
  if (statuses.every((status) => status === "cancelled")) return "Cancelled";

  const active = statuses.filter((status) => status !== "cancelled");
  if (active.every((status) => status === "delivered")) return "Delivered";
  if (active.some((status) => status === "delivered")) return "Partially delivered";
  if (active.every((status) => status === "out_for_delivery")) {
    return "Out for delivery";
  }
  if (
    active.every((status) =>
      ["shipped", "out_for_delivery"].includes(status)
    )
  ) {
    return "Shipped";
  }
  if (
    active.some((status) =>
      ["shipped", "out_for_delivery"].includes(status)
    )
  ) {
    return "Partially shipped";
  }
  if (active.every((status) => status === "packing")) return "Packing";
  if (active.some((status) => status === "packing")) return "Processing";
  if (statuses.includes("cancelled")) return "Partially cancelled";
  return "Order Placed";
};

const sellerName = (sellerId, profilesById) =>
  profilesById.get(sellerId)?.name ||
  (sellerId ? `Seller ${sellerId.slice(0, 8)}` : "Order shipment");

const legacyShipment = (order) => ({
  sellerId: null,
  sellerName: "Order shipment",
  status: null,
  statusLabel: order.status || "Order Placed",
  items: order.items || [],
  trackingNumber: order.shipping_tracking_number || "",
  trackingUrl: order.shipping_tracking_url || "",
  provider: order.shipping_provider || "",
  carrier: order.shipping_carrier || "",
  service: order.shipping_service || "",
  source: "orders",
});

export const attachOrderFulfillmentReadModels = (
  orders,
  fulfillmentRows,
  profiles
) => {
  const fulfillmentsByOrderId = new Map();
  for (const row of Array.isArray(fulfillmentRows) ? fulfillmentRows : []) {
    const rows = fulfillmentsByOrderId.get(row.order_id) || [];
    rows.push(row);
    fulfillmentsByOrderId.set(row.order_id, rows);
  }
  const profilesById = new Map(
    (Array.isArray(profiles) ? profiles : []).map((profile) => [profile.id, profile])
  );

  return (Array.isArray(orders) ? orders : []).map((order) => {
    const rows = fulfillmentsByOrderId.get(order.id) || [];
    if (!rows.length) {
      return {
        ...order,
        displayStatus: order.status || "Order Placed",
        fulfillments: [legacyShipment(order)],
        fulfillmentsSource: "orders",
      };
    }

    const rowsBySellerId = new Map(rows.map((row) => [row.seller_id, row]));
    const sellerIds = new Set([
      ...rowsBySellerId.keys(),
      ...(order.items || []).map((item) => item?.seller_id).filter(Boolean),
    ]);
    const shipments = [...sellerIds].map((sellerId) => {
      const row = rowsBySellerId.get(sellerId) || { status: "pending" };
      return {
        sellerId,
        sellerName: sellerName(sellerId, profilesById),
        status: row.status,
        statusLabel: toFulfillmentStatusLabel(row.status),
        items: (order.items || []).filter((item) => item?.seller_id === sellerId),
        trackingNumber: row.tracking_number || "",
        trackingUrl: row.tracking_url || "",
        provider: row.shipping_provider || "",
        carrier: row.shipping_carrier || "",
        service: row.shipping_service || "",
        source: "seller_fulfillments",
      };
    });

    return {
      ...order,
      displayStatus: deriveOrderDisplayStatus(shipments, order.status),
      fulfillments: shipments,
      fulfillmentsSource: "seller_fulfillments",
    };
  });
};
