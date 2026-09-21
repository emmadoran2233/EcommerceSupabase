import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createShippoHandler } from "./handler.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(
  createShippoHandler({
    shippoToken: Deno.env.get("SHIPPO_API_TOKEN") ?? "",
    shippoMode: Deno.env.get("SHIPPO_MODE") ?? "test",
    authenticate: async (authorization) => {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
      });
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return { user: data.user, client };
    },
    findSellerOrder: async ({ orderId, sellerId }) => {
      const { data: order, error: orderError } = await adminClient
        .from("orders")
        .select("id,address")
        .eq("id", orderId)
        .maybeSingle();
      if (orderError) throw orderError;
      if (!order) return null;

      // External purchases require normalized ownership. Legacy client JSON is
      // intentionally not accepted as authorization evidence.
      const { data: ownedLine, error: ownershipError } = await adminClient
        .from("order_items")
        .select("id")
        .eq("order_id", orderId)
        .eq("seller_id", sellerId)
        .limit(1)
        .maybeSingle();
      if (ownershipError) throw ownershipError;
      if (!ownedLine) return null;

      const { data: fulfillment, error: fulfillmentError } = await adminClient
        .from("seller_fulfillments")
        .select("shipping_transaction_id")
        .eq("order_id", orderId)
        .eq("seller_id", sellerId)
        .maybeSingle();
      if (fulfillmentError) throw fulfillmentError;

      return { ...order, fulfillment };
    },
    reserveLabelPurchase: async ({ client, orderId, rateId }) => {
      const { data, error } = await client.rpc("reserve_seller_shippo_label", {
        p_order_id: orderId,
        p_rate_id: rateId,
      });
      if (error) throw error;
      return data;
    },
    recordLabelPurchase: async ({ client, ...params }) => {
      const { data, error } = await client.rpc("record_seller_shippo_label", {
        p_order_id: params.orderId,
        p_purchase_token: params.purchaseToken,
        p_rate_id: params.rateId,
        p_transaction_id: params.transactionId,
        p_carrier: params.carrier,
        p_service: params.service,
        p_rate_amount: params.rateAmount,
        p_rate_currency: params.rateCurrency,
        p_label_url: params.labelUrl,
        p_tracking_number: params.trackingNumber,
        p_tracking_url: params.trackingUrl,
      });
      if (error) throw error;
      return data;
    },
    releaseLabelReservation: async ({ client, orderId, purchaseToken }) => {
      const { error } = await client.rpc("release_seller_shippo_reservation", {
        p_order_id: orderId,
        p_purchase_token: purchaseToken,
      });
      if (error) throw error;
    },
  })
);
