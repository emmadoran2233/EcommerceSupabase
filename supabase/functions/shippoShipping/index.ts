import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, X-Client-Info, apikey, Content-Type",
  "Content-Type": "application/json",
};

type ShippoAddressInput = {
  name?: string;
  street1?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
};

type ShippoParcelInput = {
  length?: string | number;
  width?: string | number;
  height?: string | number;
  distanceUnit?: string;
  weight?: string | number;
  massUnit?: string;
};

type SelectedRate = {
  id?: string;
  carrier?: string;
  service?: string;
  amount?: string | number;
  currency?: string;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const cleanString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeCountry = (value: unknown) => {
  const country = cleanString(value).toUpperCase();
  if (!country || country === "USA" || country === "UNITED STATES") return "US";
  return country;
};

const requireFields = (value: Record<string, unknown>, fields: string[]) => {
  const missing = fields.find((field) => !cleanString(value[field]));
  return missing ? `Missing ${missing}` : "";
};

const shippoFetch = async (
  token: string,
  path: string,
  body: Record<string, unknown>
) => {
  const response = await fetch(`https://api.goshippo.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      data?.detail ||
      data?.message ||
      data?.error ||
      `Shippo responded with ${response.status}`;
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }

  return data;
};

const toShippoAddress = (address: ShippoAddressInput) => ({
  name: cleanString(address.name),
  street1: cleanString(address.street1),
  city: cleanString(address.city),
  state: cleanString(address.state),
  zip: cleanString(address.zip),
  country: normalizeCountry(address.country),
  phone: cleanString(address.phone),
  email: cleanString(address.email),
});

const toShippoBuyerAddress = (address: Record<string, unknown>) => ({
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

const toShippoParcel = (parcel: ShippoParcelInput) => ({
  length: cleanString(String(parcel.length ?? "")),
  width: cleanString(String(parcel.width ?? "")),
  height: cleanString(String(parcel.height ?? "")),
  distance_unit: cleanString(parcel.distanceUnit || "in"),
  weight: cleanString(String(parcel.weight ?? "")),
  mass_unit: cleanString(parcel.massUnit || "lb"),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const shippoToken = Deno.env.get("SHIPPO_API_TOKEN");

    if (!shippoToken) {
      return json(
        {
          success: false,
          error:
            "SHIPPO_API_TOKEN is not configured. Add it in Supabase secrets before using live labels.",
        },
        501
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userSupabase = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data: authData, error: authError } =
      await userSupabase.auth.getUser();
    if (authError || !authData.user) {
      return json({ success: false, error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const action = cleanString(body.action);
    const orderId = Number(body.orderId);

    if (!orderId || Number.isNaN(orderId)) {
      return json({ success: false, error: "Missing orderId" }, 400);
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, address, items")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return json({ success: false, error: "Order not found" }, 404);
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    const sellerOwnsOrder = orderItems.some(
      (item) => item?.seller_id === authData.user.id
    );

    if (!sellerOwnsOrder) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    if (action === "get_rates") {
      const fromAddress = toShippoAddress(body.fromAddress || {});
      const toAddress = toShippoBuyerAddress(order.address || {});
      const parcel = toShippoParcel(body.parcel || {});

      const fromError = requireFields(fromAddress, [
        "name",
        "street1",
        "city",
        "state",
        "zip",
        "country",
      ]);
      if (fromError) return json({ success: false, error: fromError }, 400);

      const toError = requireFields(toAddress, [
        "name",
        "street1",
        "city",
        "state",
        "zip",
        "country",
      ]);
      if (toError) return json({ success: false, error: `Buyer address: ${toError}` }, 400);

      const parcelError = requireFields(parcel, [
        "length",
        "width",
        "height",
        "weight",
      ]);
      if (parcelError) return json({ success: false, error: parcelError }, 400);

      const shipment = await shippoFetch(shippoToken, "/shipments/", {
        address_from: fromAddress,
        address_to: toAddress,
        parcels: [parcel],
        async: false,
      });

      const rates = Array.isArray(shipment.rates) ? shipment.rates : [];
      return json({
        success: true,
        shipmentId: shipment.object_id,
        rates: rates.map((rate: Record<string, unknown>) => ({
          id: rate.object_id,
          carrier: rate.provider,
          service:
            (rate.servicelevel as Record<string, unknown> | undefined)?.name ||
            rate.servicelevel_name ||
            rate.service,
          amount: rate.amount,
          currency: rate.currency,
          estimatedDays: rate.estimated_days,
        })),
      });
    }

    if (action === "buy_label") {
      const rateId = cleanString(body.rateId);
      const selectedRate = (body.selectedRate || {}) as SelectedRate;
      if (!rateId) {
        return json({ success: false, error: "Missing rateId" }, 400);
      }

      const transaction = await shippoFetch(shippoToken, "/transactions/", {
        rate: rateId,
        label_file_type: "PDF",
        async: false,
      });

      if (transaction.status && transaction.status !== "SUCCESS") {
        const messages = Array.isArray(transaction.messages)
          ? transaction.messages.map((message: unknown) => JSON.stringify(message)).join(", ")
          : "Shippo label purchase failed";
        throw new Error(messages);
      }

      const trackingNumber = cleanString(transaction.tracking_number);
      const trackingUrl = cleanString(transaction.tracking_url_provider);
      const labelUrl = cleanString(transaction.label_url);

      const { error: updateError } = await supabase
        .from("orders")
        .update({
          status: "Shipped",
          shipping_provider: "shippo",
          shipping_carrier: cleanString(selectedRate.carrier),
          shipping_service: cleanString(selectedRate.service),
          shipping_rate_amount: selectedRate.amount
            ? Number(selectedRate.amount)
            : null,
          shipping_rate_currency: cleanString(selectedRate.currency || "USD"),
          shipping_label_url: labelUrl || null,
          shipping_transaction_id: cleanString(transaction.object_id),
          shipping_rate_id: rateId,
          shipping_tracking_number: trackingNumber || null,
          shipping_tracking_url: trackingUrl || null,
        })
        .eq("id", orderId);

      if (updateError) throw updateError;

      return json({
        success: true,
        trackingNumber,
        trackingUrl,
        labelUrl,
        transactionId: transaction.object_id,
      });
    }

    return json({ success: false, error: "Unsupported action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("shippoShipping failed:", message);
    return json({ success: false, error: message }, 500);
  }
});
