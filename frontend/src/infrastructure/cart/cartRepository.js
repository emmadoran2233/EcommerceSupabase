import {
  selectReadableCart,
  toCartLinePayload,
} from "../../domain/cart/cartState.js";

const CART_ITEM_COLUMNS = [
  "id",
  "line_key",
  "product_id",
  "quantity",
  "size",
  "customization",
  "rental_start_date",
  "rental_end_date",
  "rental_quote",
].join(",");

const throwIfError = (error) => {
  if (error) throw error;
};

export const createCartRepository = (supabase) => ({
  async findByUserId(userId) {
    const { data: cart, error: cartError } = await supabase
      .from("carts")
      .select("id,items")
      .eq("user_id", userId)
      .maybeSingle();

    throwIfError(cartError);
    if (!cart) return { cartId: null, items: {}, source: "empty" };

    const { data: rows, error: itemError } = await supabase
      .from("cart_items")
      .select(CART_ITEM_COLUMNS)
      .eq("cart_id", cart.id)
      .order("id", { ascending: true });

    throwIfError(itemError);
    const readableCart = selectReadableCart({
      normalizedRows: rows || [],
      legacyItems: cart.items,
    });

    return { cartId: cart.id, ...readableCart };
  },

  async saveLine({ productId, sizeKey, entry }) {
    const line = toCartLinePayload({ productId, sizeKey, entry });
    const { data, error } = await supabase.rpc("set_normalized_cart_line", {
      p_product_id: line.productId,
      p_line_key: line.lineKey,
      p_quantity: line.quantity,
      p_size: line.size,
      p_customization: line.customization,
      p_rental_start_date: line.rentalStartDate,
      p_rental_end_date: line.rentalEndDate,
      p_rental_quote: line.rentalQuote,
    });

    throwIfError(error);
    return { cartId: data };
  },
});
