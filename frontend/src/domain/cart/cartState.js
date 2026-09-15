const asPositiveInteger = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

const toDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value.toISOString().slice(0, 10);
  }

  const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] || null;
};

const getSizeKey = (row) => {
  const prefix = `${row.product_id}:`;
  return row.line_key.startsWith(prefix)
    ? row.line_key.slice(prefix.length)
    : row.line_key;
};

export const normalizeLegacyCart = (items) => {
  if (!items) return {};
  if (!Array.isArray(items)) return items;

  return items.reduce((cart, item) => {
    if (!item?.id) return cart;

    const productId = String(item.id);
    const sizeKey = item.size_key || item.size || "One Size";
    if (!cart[productId]) cart[productId] = {};
    cart[productId][sizeKey] = item.quantity || 1;
    return cart;
  }, {});
};

export const setCartLineQuantity = (
  cartItems,
  productId,
  sizeKey,
  quantity
) => {
  const nextCart = structuredClone(cartItems || {});
  const normalizedProductId = String(productId);

  if (!nextCart[normalizedProductId]) return nextCart;

  const currentEntry = nextCart[normalizedProductId][sizeKey];
  if (asPositiveInteger(quantity) === 0) {
    delete nextCart[normalizedProductId][sizeKey];
    if (Object.keys(nextCart[normalizedProductId]).length === 0) {
      delete nextCart[normalizedProductId];
    }
    return nextCart;
  }

  nextCart[normalizedProductId][sizeKey] =
    currentEntry && typeof currentEntry === "object"
      ? { ...currentEntry, quantity: asPositiveInteger(quantity) }
      : asPositiveInteger(quantity);

  return nextCart;
};

export const toCartLinePayload = ({ productId, sizeKey, entry }) => {
  const objectEntry = entry && typeof entry === "object" ? entry : null;
  const quantity = asPositiveInteger(objectEntry?.quantity ?? entry);
  const rentalQuote = objectEntry?.rentInfo
    ? {
        ...structuredClone(objectEntry.rentInfo),
        startDate: toDateOnly(objectEntry.rentInfo.startDate),
        endDate: toDateOnly(objectEntry.rentInfo.endDate),
      }
    : null;

  return {
    productId: productId ? String(productId) : null,
    lineKey: `${productId}:${sizeKey}`,
    quantity,
    size: rentalQuote
      ? null
      : objectEntry?.baseSize || sizeKey.split("|custom:")[0] || null,
    customization: objectEntry?.customization || null,
    rentalStartDate: rentalQuote?.startDate || null,
    rentalEndDate: rentalQuote?.endDate || null,
    rentalQuote,
  };
};

export const cartItemRowsToState = (rows) =>
  rows.reduce((cart, row) => {
    if (!row?.product_id || asPositiveInteger(row.quantity) === 0) return cart;

    const productId = String(row.product_id);
    const sizeKey = getSizeKey(row);
    if (!cart[productId]) cart[productId] = {};

    if (row.rental_quote) {
      cart[productId][sizeKey] = {
        quantity: row.quantity,
        rentInfo: {
          ...row.rental_quote,
          startDate: row.rental_start_date || row.rental_quote.startDate,
          endDate: row.rental_end_date || row.rental_quote.endDate,
        },
      };
    } else if (row.customization) {
      cart[productId][sizeKey] = {
        quantity: row.quantity,
        baseSize: row.size || sizeKey.split("|custom:")[0],
        customization: row.customization,
      };
    } else {
      cart[productId][sizeKey] = row.quantity;
    }

    return cart;
  }, {});

const cartLineKeys = (cartItems) =>
  Object.entries(cartItems || {}).flatMap(([productId, sizes]) =>
    Object.entries(sizes || {})
      .filter(([, entry]) =>
        asPositiveInteger(typeof entry === "object" ? entry?.quantity : entry)
      )
      .map(([sizeKey]) => `${productId}:${sizeKey}`)
  );

export const selectReadableCart = ({ normalizedRows, legacyItems }) => {
  const normalizedCart = cartItemRowsToState(normalizedRows || []);
  const legacyCart = normalizeLegacyCart(legacyItems);
  const normalizedKeys = new Set(cartLineKeys(normalizedCart));
  const legacyKeys = cartLineKeys(legacyCart);
  const coversLegacy = legacyKeys.every((key) => normalizedKeys.has(key));

  return {
    items: coversLegacy ? normalizedCart : legacyCart,
    source: coversLegacy ? "normalized" : "legacy-fallback",
  };
};
