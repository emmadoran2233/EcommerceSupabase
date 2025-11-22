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
const DAY_MS = 24 * 60 * 60 * 1000;
const DEPOSIT_AUTH_WINDOW_DAYS = Number(
  Deno.env.get("DEPOSIT_AUTH_WINDOW_DAYS") || "7"
);
const DEPOSIT_REAUTHORIZE_INTERVAL_DAYS = Number(
  Deno.env.get("DEPOSIT_REAUTHORIZE_INTERVAL_DAYS") || "6"
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

const mergeDepositMetadata = (
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
    const orderIdRaw = session.metadata?.orderId;
    const orderId = orderIdRaw ? Number(orderIdRaw) : null;
    const sessionCustomer =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer as Stripe.Customer | null)?.id || null;
    const checkoutPaymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as Stripe.PaymentIntent | null)?.id || null;

    console.log("Webhook triggered, orderId:", orderId);

    if (!orderId) {
      console.error("orderId missing in session.metadata:", session.metadata);
    } else {
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select(
          "id, deposit_total, deposit_currency, deposit_hold_status, deposit_payment_intent_id, deposit_payment_method_id, deposit_customer_id, deposit_rental_end_date, deposit_metadata, deposit_reauthorization_count"
        )
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        console.error("Supabase fetch error:", fetchError?.message);
      } else {
        const updateResult = await supabase
          .from("orders")
          .update({
            status: "paid",
            payment: true,
            stripe_payment_intent_id: checkoutPaymentIntentId,
            deposit_customer_id: sessionCustomer || order.deposit_customer_id,
          })
          .eq("id", orderId)
          .select();

        if (updateResult.error) {
          console.error("Supabase update error:", updateResult.error.message);
        } else {
          console.log("Supabase payment update success:", orderId);
        }

        const depositTotal = ensureNumber(order.deposit_total);
        const depositAlreadyExists = Boolean(order.deposit_payment_intent_id);
        if (depositTotal > 0 && !depositAlreadyExists) {
          try {
            let paymentMethodId = order.deposit_payment_method_id || null;
            let customerId = sessionCustomer || order.deposit_customer_id || null;

            if (checkoutPaymentIntentId) {
              const checkoutIntent = await stripe.paymentIntents.retrieve(
                checkoutPaymentIntentId,
                { expand: ["payment_method"] }
              );
              if (!paymentMethodId) {
                const pm = checkoutIntent.payment_method as
                  | string
                  | Stripe.PaymentMethod
                  | null;
                paymentMethodId =
                  typeof pm === "string" ? pm : pm?.id || paymentMethodId;
              }
              if (!customerId) {
                const customer = checkoutIntent.customer as
                  | string
                  | Stripe.Customer
                  | null;
                customerId =
                  typeof customer === "string"
                    ? customer
                    : customer?.id || customerId;
              }
            }

            if (!paymentMethodId || !customerId) {
              throw new Error(
                "Missing payment_method or customer for deposit hold"
              );
            }

            const depositIntent = await stripe.paymentIntents.create({
              amount: Math.round(depositTotal * 100),
              currency: (order.deposit_currency || "usd") as Stripe.Currency,
              capture_method: "manual",
              customer: customerId,
              payment_method: paymentMethodId,
              confirm: true,
              off_session: true,
              metadata: {
                orderId: String(orderId),
                type: "rental_deposit",
                source_payment_intent: checkoutPaymentIntentId || "",
              },
            });

            const authorizedAt = new Date();
            const expiresAt = addDays(
              authorizedAt,
              Math.max(DEPOSIT_AUTH_WINDOW_DAYS, 1)
            );
            const rentalEnd = parseDate(order.deposit_rental_end_date);
            const needsRenewal =
              rentalEnd &&
              rentalEnd.getTime() >
                addDays(authorizedAt, DEPOSIT_AUTH_WINDOW_DAYS - 1).getTime();
            const nextActionAt = needsRenewal
              ? addDays(authorizedAt, Math.max(DEPOSIT_REAUTHORIZE_INTERVAL_DAYS, 1))
              : null;

            const depositMeta = mergeDepositMetadata(
              (order.deposit_metadata as Record<string, unknown>) || {},
              {
                type: "initial_authorization",
                payment_intent_id: depositIntent.id,
                amount: depositIntent.amount / 100,
                authorized_at: authorizedAt.toISOString(),
              }
            );

            await supabase
              .from("orders")
              .update({
                deposit_payment_intent_id: depositIntent.id,
                deposit_payment_method_id: paymentMethodId,
                deposit_customer_id: customerId,
                deposit_last_authorized_at: authorizedAt.toISOString(),
                deposit_authorization_expires_at: expiresAt.toISOString(),
                deposit_next_action_at: nextActionAt
                  ? nextActionAt.toISOString()
                  : null,
                deposit_hold_status:
                  depositIntent.status === "requires_capture"
                    ? "authorized"
                    : depositIntent.status,
                deposit_reauthorization_count: 0,
                deposit_metadata: depositMeta,
              })
              .eq("id", orderId);

            console.log(
              "Deposit authorization created",
              depositIntent.id,
              "for order",
              orderId
            );
          } catch (depositErr) {
            const errMsg =
              depositErr instanceof Error
                ? depositErr.message
                : String(depositErr);
            console.error("Failed to authorize deposit hold:", errMsg);
            await supabase
              .from("orders")
              .update({
                deposit_hold_status: "authorization_failed",
                deposit_metadata: mergeDepositMetadata(
                  (order.deposit_metadata as Record<string, unknown>) || {},
                  {
                    type: "authorization_failed",
                    message: errMsg,
                    occurred_at: new Date().toISOString(),
                  }
                ),
              })
              .eq("id", orderId);
          }
        }
      }
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
