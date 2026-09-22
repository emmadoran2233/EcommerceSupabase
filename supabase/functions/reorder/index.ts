import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, X-Client-Info, apikey, Content-Type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userSupabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: {
            Authorization: req.headers.get("Authorization") || "",
          },
        },
      }
    );

    const { data: authData, error: authError } = await userSupabase.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ success: false, message: "Unauthorized" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.order_id);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "A valid order_id is required",
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data, error } = await userSupabase.rpc("reorder_into_cart", {
      p_order_id: orderId,
    });

    if (error) {
      const orderNotFound = error.message === "Order not found";
      console.error("Reorder transaction failed:", error.message);
      return new Response(
        JSON.stringify({
          success: false,
          message: orderNotFound ? "Order not found" : "Unable to reorder items",
        }),
        { status: orderNotFound ? 404 : 500, headers: corsHeaders }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Reorder items merged into cart!",
        result: data,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Reorder error:", message);
    return new Response(
      JSON.stringify({ success: false, message: "Unable to reorder items" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
