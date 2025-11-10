import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const ALLOWED_ORIGINS = [
  // "http://localhost:5173",
  "https://www.reshareloop.com",
  "https://ecommerce-supabase-wine.vercel.app/",
  "https://vercel.com/emmadoran2233s-projects/ecommerce-supabase/7rJg9F2cMKHv5Lgdn1rgrWWsXHMU",
];
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

  // read raw body safely
  const bodyText = await req.text();
  let parsed: any = {};
  try {
    parsed = bodyText ? JSON.parse(bodyText) : {};
  } catch (e) {
    console.error("Invalid JSON body:", bodyText);
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON" }), {
      status: 400,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  // Determine origin: prefer header -> body.origin -> env -> default production
  const headerOrigin = req.headers.get("origin")?.trim() || null;
  const bodyOrigin = parsed.origin ? String(parsed.origin).trim() : null;
  const envFrontend = (Deno.env.get("FRONTEND_URL") || "").trim() || null;
  const defaultProd = "https://www.reshareloop.com";

  console.log("headerOrigin:", headerOrigin, "bodyOrigin:", bodyOrigin, "FRONTEND_URL(env):", envFrontend);

  const candidate = headerOrigin || bodyOrigin || envFrontend || defaultProd;
  const baseUrl = ALLOWED_ORIGINS.includes(candidate) ? candidate : defaultProd;

  console.log("Using baseUrl for Stripe:", baseUrl);

  const { orderId, amount } = parsed;
  if (!orderId || !amount) {
    console.error("Missing orderId or amount in request:", parsed);
    return new Response(
      JSON.stringify({ success: false, error: "Missing orderId or amount" }),
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "ReShareLoop Order" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${baseUrl}/verify?success=true&orderId=${orderId}`,
      cancel_url: `${baseUrl}/verify?success=false&orderId=${orderId}`,
      metadata: {
        orderId: String(orderId),
        method: "googlepay",
      },
    });

    console.log("Stripe session created:", {
      session_url: session.url,
      success_url: session.success_url,
      cancel_url: session.cancel_url,
    });

    return new Response(JSON.stringify({ success: true, session_url: session.url }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("Stripe error:", err);
    return new Response(JSON.stringify({ success: false, error: err?.message || String(err) }), {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});