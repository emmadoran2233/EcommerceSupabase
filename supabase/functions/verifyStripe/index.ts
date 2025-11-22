import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://www.reshareloop.com",
  "https://ecommerce-supabase-wine.vercel.app/",
  "https://vercel.com/emmadoran2233s-projects/ecommerce-supabase/7rJg9F2cMKHv5Lgdn1rgrWWsXHMU",
];

const ensureNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toCents = (value: number) => Math.round(value * 100);

const normalizeCurrency = (currency?: string | null) =>
  (currency || "usd").toLowerCase();

const buildLineItems = (
  order: any,
  currency: string
): Stripe.Checkout.SessionCreateParams.LineItem[] => {
  const items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const products = Array.isArray(order.items) ? order.items : [];

  for (const product of products) {
    const rentInfo = product?.rentInfo;
    if (rentInfo) {
      const rentFee = ensureNumber(rentInfo.rentFee);
      if (rentFee > 0) {
        items.push({
          quantity: 1,
          price_data: {
            currency,
            product_data: {
              name: `${product?.name || "Rental Item"} (rent)`,
            },
            unit_amount: toCents(rentFee),
          },
        });
      }
      continue;
    }

    const unitPrice = ensureNumber(product?.price);
    const quantity = ensureNumber(product?.quantity || 1);
    if (unitPrice > 0 && quantity > 0) {
      items.push({
        quantity,
        price_data: {
          currency,
          product_data: {
            name: product?.name || "Order Item",
          },
          unit_amount: toCents(unitPrice),
        },
      });
    }
  }

  const shippingFee = ensureNumber(order?.shipping_fee);
  if (shippingFee > 0) {
    items.push({
      quantity: 1,
      price_data: {
        currency,
        product_data: { name: "Shipping" },
        unit_amount: toCents(shippingFee),
      },
    });
  }

  return items.filter(
    (line) => (line.price_data?.unit_amount || 0) > 0 && (line.quantity || 0) > 0
  );
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    });
  }
  const bodyText = await req.text();
  console.log("verifyStripe raw body:", bodyText);

  let parsed;
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch (e) {
    console.error("Invalid JSON:", bodyText);
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
  const headerOrigin = req.headers.get("origin")?.trim() || null;
  const bodyOrigin = (parsed.origin && String(parsed.origin).trim()) || null;
  const envFrontend = (Deno.env.get("FRONTEND_URL") || "").trim() || null;
  const defaultProd = "https://www.reshareloop.com";

  console.log(
    "headerOrigin:",
    headerOrigin,
    "bodyOrigin:",
    bodyOrigin,
    "FRONTEND_URL:",
    envFrontend
  );

  const candidate = headerOrigin || bodyOrigin || envFrontend || defaultProd;
  const baseUrl = ALLOWED_ORIGINS.includes(candidate) ? candidate : defaultProd;

  console.log("Using baseUrl for stripe success/cancel:", baseUrl);
  const { orderId } = parsed;
  console.log("verifyStripe parsed:", { orderId });

  if (!orderId) {
    console.error("Missing orderId in request:", parsed);
    return new Response(
      JSON.stringify({ success: false, error: "Missing orderId" }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, items, amount, shipping_fee, rent_breakdown, rent_subtotal, purchase_subtotal, deposit_total, deposit_currency, charge_currency, deposit_hold_status, payment, paymentmethod, address, stripe_session_id"
    )
    .eq("id", Number(orderId))
    .single();

  if (error || !order) {
    console.error("Order lookup failed:", error?.message);
    return new Response(
      JSON.stringify({ success: false, error: "Order not found" }),
      {
        status: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  if (order.payment) {
    return new Response(
      JSON.stringify({ success: false, error: "Order already paid" }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  const currency = normalizeCurrency(order.charge_currency);
  const lineItems = buildLineItems(order, currency);
  if (lineItems.length === 0) {
    console.error("No payable line items derived for order:", orderId);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unable to build Stripe line items for this order",
      }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  const orderAmount = ensureNumber(order.amount);
  const payableCents = toCents(orderAmount);
  const constructedCents = lineItems.reduce(
    (sum, item) =>
      sum + (item.price_data?.unit_amount || 0) * (item.quantity || 0),
    0
  );
  if (constructedCents !== payableCents) {
    console.warn(
      "Line item total mismatch. Using order.amount as source of truth",
      {
        orderId,
        storedAmount: orderAmount,
        fromLineItems: constructedCents / 100,
      }
    );
  }

  try {
    const paymentIntentData =
      ensureNumber(order.deposit_total) > 0
        ? { setup_future_usage: "off_session" as const }
        : undefined;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer_creation: "always",
      customer_email: order.address?.email || undefined,
      line_items: lineItems,
      mode: "payment",
      payment_intent_data: paymentIntentData,
      success_url: `${baseUrl}/verify?success=true&orderId=${orderId}`,
      cancel_url: `${baseUrl}/verify?success=false&orderId=${orderId}`,
      metadata: {
        orderId: String(orderId),
        deposit_total: String(order.deposit_total ?? 0),
      },
    });

    console.log("Created Stripe session with metadata:", session.metadata);
    console.log("Created session id:", session.id, "session.url:", session.url);

    await supabase
      .from("orders")
      .update({
        stripe_session_id: session.id,
        charge_currency: currency,
      })
      .eq("id", orderId);

    return new Response(
      JSON.stringify({ success: true, session_url: session.url }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      }
    );
  } catch (err) {
    console.error("Stripe Error:", err.message, "raw body:", bodyText);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      }
    );
  }
});
