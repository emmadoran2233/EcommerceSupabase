import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
// Added authentication and scoped the payment status query so users can only check orders that belong to their own account.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ success: false, error: "Missing orderId" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .select("id, status, payment")
      .eq("id", orderId)
      .or(`buyer_id.eq.${authData.user.id},user_id.eq.${authData.user.id}`)
      .single();

    if (error) {
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, order: data }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
