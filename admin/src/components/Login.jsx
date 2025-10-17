import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, X-Client-Info, apikey, Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id, order_id } = await req.json();

    if (!user_id || !order_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Missing user_id or order_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🟢 查询订单
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("items")
      .eq("id", order_id)
      .eq("user_id", user_id)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, message: "Order not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 🟢 查询购物车
    const { data: existingCart, error: cartError } = await supabase
      .from("carts")
      .select("items")
      .eq("user_id", user_id)
      .maybeSingle();

    if (cartError) throw cartError;

    const existingItems = existingCart?.items ?? [];
    const newItems = [...existingItems, ...order.items];

    // 🟢 更新或插入购物车
    if (existingCart) {
      await supabase.from("carts").update({ items: newItems }).eq("user_id", user_id);
    } else {
      await supabase.from("carts").insert([{ user_id, items: newItems }]);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Items added to cart!" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Reorder Error:", err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || "Internal Server Error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
