import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2023-10-16",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DAY_MS = 24 * 60 * 60 * 1000;
const DEPOSIT_AUTH_WINDOW_DAYS = Number(
  Deno.env.get("DEPOSIT_AUTH_WINDOW_DAYS") || "7"
);
const DEPOSIT_REAUTHORIZE_INTERVAL_DAYS = Number(
  Deno.env.get("DEPOSIT_REAUTHORIZE_INTERVAL_DAYS") || "6"
);
const DEPOSIT_REAUTHORIZE_LEAD_HOURS = Number(
  Deno.env.get("DEPOSIT_REAUTHORIZE_LEAD_HOURS") || "12"
);

const ensureNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY_MS);

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mergeMetadata = (
  existing: Record<string, unknown> | null,
  entry: Record<string, unknown>
) => {
  const base =
    existing && typeof existing === "object" ? { ...existing } : ({} as Record<
      string,
      unknown
    >);
  const history = Array.isArray(base.history) ? [...base.history] : [];
  history.push(entry);
  base.history = history;
  base.updated_at = new Date().toISOString();
  return base;
};

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

  const now = new Date();
  const leadWindow = new Date(
    now.getTime() + Math.max(DEPOSIT_REAUTHORIZE_LEAD_HOURS, 1) * 60 * 60 * 1000
  );

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "id, deposit_total, deposit_currency, deposit_payment_intent_id, deposit_payment_method_id, deposit_customer_id, deposit_authorization_expires_at, deposit_rental_end_date, deposit_reauthorization_count, deposit_metadata, deposit_hold_status"
    )
    .eq("deposit_hold_status", "authorized")
    .gt("deposit_total", 0)
    .lte("deposit_authorization_expires_at", leadWindow.toISOString());

  if (error) {
    console.error("Failed to fetch orders for reauthorization:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500 }
    );
  }

  const results = {
    scanned: orders?.length || 0,
    renewed: 0,
    skipped: 0,
    failed: 0,
  };

  if (!orders || orders.length === 0) {
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
    });
  }

  for (const order of orders) {
    const orderId = order.id;
    const rentalEnd = parseDate(order.deposit_rental_end_date);

    if (!rentalEnd || rentalEnd <= now) {
      results.skipped += 1;
      await supabase
        .from("orders")
        .update({
          deposit_next_action_at: null,
          deposit_hold_status: "awaiting_release",
        })
        .eq("id", orderId);
      continue;
    }

    const depositAmount = ensureNumber(order.deposit_total);
    const paymentMethodId = order.deposit_payment_method_id;
    const customerId = order.deposit_customer_id;

    if (!depositAmount || !paymentMethodId || !customerId) {
      console.warn(
        "Skipping order lacking deposit artifacts",
        orderId,
        depositAmount,
        paymentMethodId,
        customerId
      );
      results.failed += 1;
      await supabase
        .from("orders")
        .update({
          deposit_hold_status: "reauthorization_failed",
          deposit_metadata: mergeMetadata(
            (order.deposit_metadata as Record<string, unknown>) || {},
            {
              type: "reauthorization_failed",
              message: "Missing payment artifacts for reauthorization",
              occurred_at: new Date().toISOString(),
            }
          ),
        })
        .eq("id", orderId);
      continue;
    }

    try {
      if (order.deposit_payment_intent_id) {
        try {
          await stripe.paymentIntents.cancel(order.deposit_payment_intent_id, {
            cancellation_reason: "abandoned",
          });
        } catch (cancelErr) {
          console.warn(
            "Previous deposit payment_intent cancel failed (continuing):",
            order.deposit_payment_intent_id,
            cancelErr instanceof Error ? cancelErr.message : cancelErr
          );
        }
      }

      const newIntent = await stripe.paymentIntents.create({
        amount: Math.round(depositAmount * 100),
        currency: (order.deposit_currency || "usd") as Stripe.Currency,
        capture_method: "manual",
        customer: customerId,
        payment_method: paymentMethodId,
        confirm: true,
        off_session: true,
        metadata: {
          orderId: String(orderId),
          type: "rental_deposit",
          sequence: String((order.deposit_reauthorization_count || 0) + 1),
        },
      });

      const authorizedAt = new Date();
      const expiresAt = addDays(
        authorizedAt,
        Math.max(DEPOSIT_AUTH_WINDOW_DAYS, 1)
      );
      const needsAnotherRenewal =
        rentalEnd.getTime() >
        addDays(authorizedAt, DEPOSIT_AUTH_WINDOW_DAYS - 1).getTime();
      const nextActionAt = needsAnotherRenewal
        ? addDays(authorizedAt, Math.max(DEPOSIT_REAUTHORIZE_INTERVAL_DAYS, 1))
        : null;

      const depositMeta = mergeMetadata(
        (order.deposit_metadata as Record<string, unknown>) || {},
        {
          type: "reauthorization",
          payment_intent_id: newIntent.id,
          amount: newIntent.amount / 100,
          authorized_at: authorizedAt.toISOString(),
        }
      );

      await supabase
        .from("orders")
        .update({
          deposit_payment_intent_id: newIntent.id,
          deposit_last_authorized_at: authorizedAt.toISOString(),
          deposit_authorization_expires_at: expiresAt.toISOString(),
          deposit_next_action_at: nextActionAt
            ? nextActionAt.toISOString()
            : null,
          deposit_hold_status:
            newIntent.status === "requires_capture"
              ? "authorized"
              : newIntent.status,
          deposit_reauthorization_count: (order.deposit_reauthorization_count || 0) + 1,
          deposit_metadata: depositMeta,
        })
        .eq("id", orderId);

      results.renewed += 1;
    } catch (renewErr) {
      const errMsg =
        renewErr instanceof Error ? renewErr.message : String(renewErr);
      console.error("Failed to renew deposit hold:", orderId, errMsg);
      results.failed += 1;
      await supabase
        .from("orders")
        .update({
          deposit_hold_status: "reauthorization_failed",
          deposit_metadata: mergeMetadata(
            (order.deposit_metadata as Record<string, unknown>) || {},
            {
              type: "reauthorization_failed",
              message: errMsg,
              occurred_at: new Date().toISOString(),
            }
          ),
        })
        .eq("id", orderId);
    }
  }

  return new Response(JSON.stringify({ success: true, results }), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
    },
  });
});
