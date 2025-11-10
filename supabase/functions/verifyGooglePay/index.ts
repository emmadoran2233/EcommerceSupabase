import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const frontendUrl = (Deno.env.get("FRONTEND_URL") || "http://localhost:5173").replace(/\/$/, "");
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

  let parsed;
  try {
    parsed = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON" }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }

  const { orderId, amount } = parsed;
  if (!orderId || !amount) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing orderId or amount" }),
      {
        status: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Earn Share Repeat (Google Pay)" },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${frontendUrl}/verify?success=true&orderId=${orderId}`,
      cancel_url: `${frontendUrl}/verify?success=false&orderId=${orderId}`,
      metadata: {
        orderId: String(orderId),
        method: "googlepay", 
      },
    });

    return new Response(
      JSON.stringify({ success: true, session_url: session.url }),
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, x-client-info, apikey, content-type",
        },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
      },
    );
  }
});
