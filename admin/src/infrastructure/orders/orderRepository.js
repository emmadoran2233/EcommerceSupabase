import { toSellerOrderReadModel } from "../../domain/orders/orderItemReadModel.js";

const ORDER_ITEM_FIELDS = [
  "line_number",
  "product_id",
  "seller_id",
  "item_type",
  "product_name",
  "quantity",
  "unit_amount",
  "line_amount",
  "size",
  "customization",
  "rental_start_date",
  "rental_end_date",
  "product_snapshot",
].join(",");

const SELLER_FULFILLMENT_FIELDS = [
  "seller_id",
  "status",
  "shipping_provider",
  "shipping_carrier",
  "shipping_service",
  "shipping_rate_amount",
  "shipping_rate_currency",
  "shipping_rate_id",
  "shipping_transaction_id",
  "shipping_label_url",
  "tracking_number",
  "tracking_url",
].join(",");

export const createSellerOrderRepository = (supabase) => ({
  async findAll(sellerId) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*,order_items(${ORDER_ITEM_FIELDS}),seller_fulfillments(${SELLER_FULFILLMENT_FIELDS})`
      )
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (Array.isArray(data) ? data : [])
      .map((order) => toSellerOrderReadModel(order, sellerId))
      .filter((order) => order.items.length > 0);
  },

  async updateFulfillment({ orderId, status, trackingNumber, trackingUrl }) {
    const { data, error } = await supabase.rpc("update_seller_fulfillment", {
      p_order_id: orderId,
      p_status: status,
      p_tracking_number: trackingNumber || null,
      p_tracking_url: trackingUrl || null,
    });

    if (error) throw error;

    return data;
  },
});
