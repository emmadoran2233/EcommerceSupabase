import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

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

  const sig = req.headers.get("stripe-signature")!;
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;

    console.log("Webhook triggered, orderId:", orderId);

    if (orderId) {
      const { data, error } = await supabase
        .from("orders")
        .update({
          status: "paid",
          payment: true,
        })
        .eq("id", Number(orderId))  
        .select();

      if (error) {
        console.error("Supabase update error:", error.message);
      } else {
        console.log("Supabase update success:", data);
      }
    } else {
      console.error("orderId missing in session.metadata:", session.metadata);
    }

  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
});
