import { attachOrderItemReadModels } from "../../domain/orders/orderItemReadModel.js";
import { attachOrderFulfillmentReadModels } from "../../domain/orders/orderFulfillmentReadModel.js";

const ORDER_FIELDS = [
  "id",
  "order_number",
  "items",
  "status",
  "payment",
  "paymentmethod",
  "date",
  "created_at",
  "buyer_id",
  "shipping_tracking_number",
  "shipping_tracking_url",
  "shipping_provider",
  "shipping_carrier",
  "shipping_service",
].join(",");

const FULFILLMENT_FIELDS = [
  "order_id",
  "seller_id",
  "status",
  "shipping_provider",
  "shipping_carrier",
  "shipping_service",
  "tracking_number",
  "tracking_url",
].join(",");

const PROFILE_FIELDS = "id,name,avatar_url";

const ORDER_ITEM_FIELDS = [
  "order_id",
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

export const createOrderRepository = (supabase) => ({
  async findBuyerOrders({ userId, page, pageSize, status, orderId }) {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from("orders")
      .select(ORDER_FIELDS, { count: "exact" })
      .or(`buyer_id.eq.${userId},user_id.eq.${userId}`);

    if (status) query = query.eq("status", status);
    if (orderId) {
      const reference = String(orderId).trim();
      query = /^\d+$/.test(reference)
        ? query.eq("id", reference)
        : query.eq("order_number", reference.toUpperCase());
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;

    const orders = Array.isArray(data) ? data : [];
    const orderIds = orders.map((order) => order.id);
    if (!orderIds.length) return { orders: [], count: count || 0 };

    const [itemResult, fulfillmentResult] = await Promise.all([
      supabase
        .from("order_items")
        .select(ORDER_ITEM_FIELDS)
        .in("order_id", orderIds)
        .order("line_number", { ascending: true }),
      supabase
        .from("seller_fulfillments")
        .select(FULFILLMENT_FIELDS)
        .in("order_id", orderIds),
    ]);

    const { data: itemRows, error: itemError } = itemResult;
    const { data: fulfillmentRows, error: fulfillmentError } = fulfillmentResult;

    if (itemError) {
      console.warn("Using legacy order items:", itemError.message);
    }
    if (fulfillmentError) {
      console.warn("Using legacy order shipping:", fulfillmentError.message);
    }

    const hydratedOrders = attachOrderItemReadModels(
      orders,
      itemError ? [] : itemRows || []
    );
    const sellerIds = [
      ...new Set(
        [
          ...(fulfillmentError ? [] : fulfillmentRows || []).map(
            (row) => row.seller_id
          ),
          ...hydratedOrders.flatMap((order) =>
            (order.items || []).map((item) => item?.seller_id)
          ),
        ].filter(Boolean)
      ),
    ];

    let profiles = [];
    if (sellerIds.length) {
      const { data: profileRows, error: profileError } = await supabase
        .from("profiles")
        .select(PROFILE_FIELDS)
        .in("id", sellerIds);
      if (profileError) {
        console.warn("Using seller identifiers:", profileError.message);
      } else {
        profiles = profileRows || [];
      }
    }

    return {
      orders: attachOrderFulfillmentReadModels(
        hydratedOrders,
        fulfillmentError ? [] : fulfillmentRows || [],
        profiles
      ),
      count: count || 0,
    };
  },
});
