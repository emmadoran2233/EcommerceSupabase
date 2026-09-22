const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const FULFILLMENT_STATUS_BY_ORDER_STATUS = {
  "Order Placed": "pending",
  Packing: "packing",
  Shipped: "shipped",
  "Out for delivery": "out_for_delivery",
  Delivered: "delivered",
  Cancelled: "cancelled",
};

const ORDER_STATUS_BY_FULFILLMENT_STATUS = Object.fromEntries(
  Object.entries(FULFILLMENT_STATUS_BY_ORDER_STATUS).map(([orderStatus, status]) => [
    status,
    orderStatus,
  ])
);

export const toFulfillmentStatus = (orderStatus) =>
  FULFILLMENT_STATUS_BY_ORDER_STATUS[orderStatus] ?? null;

export const toOrderStatus = (fulfillmentStatus) =>
  ORDER_STATUS_BY_FULFILLMENT_STATUS[fulfillmentStatus] ?? null;

const toSellerItem = (row) => {
  const snapshot = isRecord(row?.product_snapshot)
    ? row.product_snapshot
    : {};
  const snapshotRentInfo = isRecord(snapshot.rentInfo)
    ? snapshot.rentInfo
    : {};

  return {
    ...snapshot,
    id: row?.product_id ?? snapshot.id,
    seller_id: row?.seller_id ?? snapshot.seller_id,
    name: row?.product_name ?? snapshot.name,
    quantity: row?.quantity ?? snapshot.quantity ?? 1,
    price: row?.unit_amount ?? snapshot.price,
    size: row?.size ?? snapshot.size,
    customization: isRecord(row?.customization)
      ? row.customization
      : snapshot.customization,
    ...(row?.item_type === "rental"
      ? {
          rentable: true,
          rentInfo: {
            ...snapshotRentInfo,
            startDate: row.rental_start_date ?? snapshotRentInfo.startDate,
            endDate: row.rental_end_date ?? snapshotRentInfo.endDate,
            rentFee: row.line_amount ?? snapshotRentInfo.rentFee,
            totalPrice: snapshotRentInfo.totalPrice ?? row.line_amount,
          },
        }
      : {}),
  };
};

export const selectSellerOrderItems = (order, sellerId) => {
  const legacyItems = Array.isArray(order?.items)
    ? order.items.filter((item) => item?.seller_id === sellerId)
    : [];
  const normalizedRows = Array.isArray(order?.order_items)
    ? order.order_items.filter((item) => item?.seller_id === sellerId)
    : [];
  const normalizedCoversSeller =
    normalizedRows.length > 0 &&
    (legacyItems.length === 0 || normalizedRows.length === legacyItems.length);

  return normalizedCoversSeller
    ? {
        items: [...normalizedRows]
          .sort((left, right) => left.line_number - right.line_number)
          .map(toSellerItem),
        source: "order_items",
      }
    : { items: legacyItems, source: "orders.items" };
};

export const toSellerOrderReadModel = (order, sellerId) => {
  const resolved = selectSellerOrderItems(order, sellerId);
  const fulfillment = Array.isArray(order?.seller_fulfillments)
    ? order.seller_fulfillments.find((row) => row?.seller_id === sellerId) ?? null
    : null;

  return {
    ...order,
    items: resolved.items,
    itemsSource: resolved.source,
    fulfillment,
    sellerStatus: toOrderStatus(fulfillment?.status) ?? order?.status,
  };
};
