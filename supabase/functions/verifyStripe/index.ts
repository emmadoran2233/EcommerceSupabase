import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const bodyText = await req.text();
    console.log("Raw Body:", bodyText);

    let orderData = {};
    try {
      orderData = JSON.parse(bodyText);
    } catch (e) {
      console.error("JSON parse failed:", e.message);
    }

    console.log("Order Data:", orderData);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Emazing Store Order",
            },
            unit_amount: 5000,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: "http://localhost:5173/verify?success=true",
      cancel_url: "http://localhost:5173/verify?success=false",
    });

    return new Response(
      JSON.stringify({ success: true, session_url: session.url }),
      { status: 200,
        headers: {
      "Access-Control-Allow-Origin": "*",  // 允许所有域访问（开发环境用）
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
       }
    );
  } catch (err) {
    console.error("Stripe Error:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
    });
  }
});

