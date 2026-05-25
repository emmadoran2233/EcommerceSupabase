import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupabaseClient = ReturnType<typeof createClient>;

type SendTransactionalEmailOptions = {
  supabase: SupabaseClient;
  to: string;
  subject: string;
  html: string;
  text: string;
  eventType: string;
  recipientRole: string;
  userId?: string | null;
  orderId?: number | null;
  idempotencyKey?: string;
};

const RESEND_API_URL = "https://api.resend.com/emails";

export const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const buildIdempotencyKey = ({
  eventType,
  recipientRole,
  userId,
  orderId,
  to,
}: Pick<
  SendTransactionalEmailOptions,
  "eventType" | "recipientRole" | "userId" | "orderId" | "to"
>) =>
  [
    eventType,
    orderId ? `order:${orderId}` : null,
    userId ? `user:${userId}` : null,
    recipientRole,
    to.toLowerCase(),
  ]
    .filter(Boolean)
    .join(":");

const createPendingEvent = async (
  options: SendTransactionalEmailOptions,
  idempotencyKey: string
) => {
  const { supabase } = options;
  const existing = await supabase
    .from("email_events")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existing.error && existing.data?.status === "sent") {
    return { skip: true, eventId: existing.data.id };
  }

  if (existing.error && existing.error.code !== "42P01") {
    console.warn("Email event lookup failed:", existing.error.message);
  }

  const inserted = await supabase
    .from("email_events")
    .insert({
      order_id: options.orderId || null,
      user_id: options.userId || null,
      event_type: options.eventType,
      recipient_email: options.to,
      recipient_role: options.recipientRole,
      subject: options.subject,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (inserted.error && inserted.error.code !== "42P01") {
    console.warn("Email event insert failed:", inserted.error.message);
  }

  return { skip: false, eventId: inserted.data?.id || null };
};

const updateEvent = async (
  supabase: SupabaseClient,
  eventId: string | null,
  status: "sent" | "failed",
  providerId?: string,
  errorMessage?: string
) => {
  if (!eventId) return;

  const { error } = await supabase
    .from("email_events")
    .update({
      status,
      provider_id: providerId || null,
      error_message: errorMessage || null,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    })
    .eq("id", eventId);

  if (error && error.code !== "42P01") {
    console.warn("Email event update failed:", error.message);
  }
};

export const sendTransactionalEmail = async (
  options: SendTransactionalEmailOptions
) => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from =
    Deno.env.get("MAIL_FROM") || "ReShareLoop <orders@reshareloop.com>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping email.");
    return { skipped: true, reason: "missing_api_key" };
  }

  const idempotencyKey =
    options.idempotencyKey || buildIdempotencyKey(options);
  const event = await createPendingEvent(options, idempotencyKey);

  if (event.skip) {
    return { skipped: true, reason: "already_sent" };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.message || `Resend responded with ${response.status}`;
      await updateEvent(
        options.supabase,
        event.eventId,
        "failed",
        undefined,
        message
      );
      throw new Error(message);
    }

    await updateEvent(options.supabase, event.eventId, "sent", data?.id);
    return { sent: true, providerId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateEvent(
      options.supabase,
      event.eventId,
      "failed",
      undefined,
      message
    );
    console.error("Email send failed:", message);
    return { sent: false, error: message };
  }
};
