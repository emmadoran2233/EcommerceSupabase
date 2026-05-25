import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendOrderEmails } from "../_shared/email.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const orderId = Number(body.orderId);
    const eventType = String(body.eventType || "order_submitted");
    const status = body.status ? String(body.status) : undefined;

    if (!orderId || Number.isNaN(orderId)) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing orderId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const results = await sendOrderEmails({
      supabase,
      orderId,
      eventType,
      status,
    });

    const failedResult = Array.isArray(results)
      ? results.find((result) => {
          const item = result as {
            sent?: boolean;
            skipped?: boolean;
            reason?: string;
          };
          return (
            item.sent === false ||
            (item.skipped && item.reason !== "already_sent")
          );
        })
      : null;

    if (failedResult) {
      return new Response(
        JSON.stringify({ success: false, failedResult, results }),
        {
          status: 200,
          headers: corsHeaders,
        }
      );
    }

    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sendOrderEmails failed:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
