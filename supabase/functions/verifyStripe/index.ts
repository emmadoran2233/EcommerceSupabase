import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const { orderId, success, userId } = await req.json();

    if (success === "true") {
      await supabase.from("orders").update({ payment: true }).eq("id", orderId);
      await supabase.from("users").update({ cartData: {} }).eq("id", userId);

      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      await supabase.from("orders").delete().eq("id", orderId);

      return new Response(JSON.stringify({ success: false }), { status: 200 });
    }
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
    });
  }
});
