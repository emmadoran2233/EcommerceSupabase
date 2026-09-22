const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasCompleteNormalizedLines = (rows, legacyItemCount) => {
  if (legacyItemCount === 0) return rows.length > 0;
  if (rows.length !== legacyItemCount) return false;

  return [...rows]
    .map((row) => Number(row?.line_number))
    .sort((left, right) => left - right)
    .every((lineNumber, index) => lineNumber === index + 1);
};

export const toOrderItemReadModel = (row) => {
  const snapshot = isRecord(row?.product_snapshot)
    ? row.product_snapshot
    : {};
  const snapshotRentInfo = isRecord(snapshot.rentInfo)
    ? snapshot.rentInfo
    : {};
  const rental = row?.item_type === "rental";

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
    ...(rental
      ? {
          rentable: true,
          rentInfo: {
            ...snapshotRentInfo,
            startDate: row?.rental_start_date ?? snapshotRentInfo.startDate,
            endDate: row?.rental_end_date ?? snapshotRentInfo.endDate,
            rentFee: row?.line_amount ?? snapshotRentInfo.rentFee,
            totalPrice: snapshotRentInfo.totalPrice ?? row?.line_amount,
          },
        }
      : {}),
  };
};

export const selectOrderItemReadModels = ({ normalizedRows, legacyItems }) => {
  const normalized = Array.isArray(normalizedRows) ? normalizedRows : [];
  const legacy = Array.isArray(legacyItems) ? legacyItems : [];

  if (!hasCompleteNormalizedLines(normalized, legacy.length)) {
    return { items: legacy, source: "orders.items" };
  }

  return {
    items: [...normalized]
      .sort((left, right) => left.line_number - right.line_number)
      .map(toOrderItemReadModel),
    source: "order_items",
  };
};

export const attachOrderItemReadModels = (orders, normalizedRows) => {
  const rowsByOrderId = new Map();

  for (const row of Array.isArray(normalizedRows) ? normalizedRows : []) {
    const rows = rowsByOrderId.get(row.order_id) || [];
    rows.push(row);
    rowsByOrderId.set(row.order_id, rows);
  }

  return (Array.isArray(orders) ? orders : []).map((order) => {
    const resolved = selectOrderItemReadModels({
      normalizedRows: rowsByOrderId.get(order.id),
      legacyItems: order.items,
    });

    return {
      ...order,
      items: resolved.items,
      itemsSource: resolved.source,
    };
  });
};
