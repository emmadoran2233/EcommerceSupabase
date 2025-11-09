import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const user_id = body.user_id;
    const order_id = Number(body.order_id);

    if (!user_id || !order_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing user_id or order_id" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("items")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.log("⚠️ Order not found:", orderError);
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    console.log("🧠 ORDER DEBUG:", order_id, user_id, order);

    const { data: existingCart, error: cartError } = await supabase
      .from("carts")
      .select("items")
      .eq("user_id", user_id)
      .maybeSingle();

    if (cartError) throw cartError;
    const existingItems = Array.isArray(existingCart?.items) ? existingCart.items : [];

    const combinedMap = new Map();
    existingItems.forEach(item => {
      if (item && item.id && item.size) {
        combinedMap.set(`${item.id}_${item.size}`, { ...item });
      }
    });
    orderItems.forEach(item => {
      if (!item || !item.id || !item.size) return;
      const key = `${item.id}_${item.size}`;
      if (combinedMap.has(key)) {
        combinedMap.get(key).quantity += item.quantity || 1;
      } else {
        combinedMap.set(key, { ...item });
      }
    });

    const mergedItems = Array.from(combinedMap.values());
    if (existingCart) {
      await supabase
        .from("carts")
        .update({ items: mergedItems })
        .eq("user_id", user_id);
    } else {
      await supabase
        .from("carts")
        .insert([{ user_id, items: orderItems }]);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Reorder items merged into cart!" }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("💥 Reorder Error:", err);
    return new Response(
      JSON.stringify({ success: false, message: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
<<<<<<< HEAD
});
=======
});
>>>>>>> feature/merged-Han
