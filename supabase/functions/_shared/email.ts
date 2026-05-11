import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupabaseClient = ReturnType<typeof createClient>;

type OrderItem = {
  id?: string | number;
  name?: string;
  price?: number | string;
  quantity?: number | string;
  size?: string;
  seller_id?: string;
  rentable?: boolean;
  rentInfo?: {
    startDate?: string;
    endDate?: string;
    rentFee?: number | string;
    deposit?: number | string;
    totalPrice?: number | string;
  };
  customization?: {
    lines?: string[];
    font?: string;
    color?: string;
  };
};

type OrderAddress = {
  firstName?: string;
  lastName?: string;
  email?: string;
  street?: string;
  city?: string;
  state?: string;
  zipcode?: string;
  country?: string;
  phone?: string;
};

type SendEmailOptions = {
  supabase: SupabaseClient;
  orderId: number;
  eventType: string;
  status?: string;
};

type EmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  eventType: string;
  recipientRole: "buyer" | "seller";
  sellerId?: string | null;
};

const RESEND_API_URL = "https://api.resend.com/emails";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const ensureNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const money = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(ensureNumber(value));

const fullName = (address?: OrderAddress) =>
  [address?.firstName, address?.lastName].filter(Boolean).join(" ").trim() ||
  "Customer";

const addressLines = (address?: OrderAddress) =>
  [
    address?.street,
    [address?.city, address?.state, address?.country, address?.zipcode]
      .filter(Boolean)
      .join(", "),
    address?.phone ? `Phone: ${address.phone}` : "",
  ].filter(Boolean);

const itemAmount = (item: OrderItem) => {
  if (item.rentInfo) {
    return ensureNumber(item.rentInfo.rentFee || item.rentInfo.totalPrice);
  }
  return ensureNumber(item.price) * Math.max(ensureNumber(item.quantity || 1), 1);
};

const itemDescription = (item: OrderItem) => {
  const quantity = Math.max(ensureNumber(item.quantity || 1), 1);
  const parts = [
    item.name || "Order item",
    item.rentInfo ? "Rental" : "Sale",
    item.size ? `Size: ${item.size}` : "",
    item.rentInfo?.startDate && item.rentInfo?.endDate
      ? `Rental dates: ${item.rentInfo.startDate} to ${item.rentInfo.endDate}`
      : "",
    item.rentInfo?.deposit
      ? `Deposit: ${money(item.rentInfo.deposit)}`
      : "",
    item.customization?.lines?.filter(Boolean).length
      ? `Custom: ${item.customization.lines.filter(Boolean).join(" / ")}`
      : "",
  ].filter(Boolean);

  return `${parts.join(" | ")} | Qty: ${quantity} | ${money(itemAmount(item))}`;
};

const itemListHtml = (items: OrderItem[]) =>
  `<ul>${items
    .map((item) => `<li>${escapeHtml(itemDescription(item))}</li>`)
    .join("")}</ul>`;

const itemListText = (items: OrderItem[]) =>
  items.map((item) => `- ${itemDescription(item)}`).join("\n");

const groupItemsBySeller = (items: OrderItem[]) => {
  const groups = new Map<string, OrderItem[]>();
  for (const item of items) {
    if (!item.seller_id) continue;
    const current = groups.get(item.seller_id) || [];
    current.push(item);
    groups.set(item.seller_id, current);
  }
  return groups;
};

const safeInsertEvent = async (
  supabase: SupabaseClient,
  orderId: number,
  payload: EmailPayload
) => {
  const idempotencyKey = [
    payload.eventType,
    orderId,
    payload.recipientRole,
    payload.sellerId || "buyer",
  ].join(":");

  const existing = await supabase
    .from("email_events")
    .select("id, status")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!existing.error && existing.data?.status === "sent") {
    return { skip: true, idempotencyKey, eventId: existing.data.id };
  }

  if (existing.error && existing.error.code !== "42P01") {
    console.warn("Email event lookup failed:", existing.error.message);
  }

  const inserted = await supabase
    .from("email_events")
    .insert({
      order_id: orderId,
      event_type: payload.eventType,
      recipient_email: payload.to,
      recipient_role: payload.recipientRole,
      seller_id: payload.sellerId || null,
      subject: payload.subject,
      status: "pending",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (inserted.error && inserted.error.code !== "42P01") {
    console.warn("Email event insert failed:", inserted.error.message);
  }

  return {
    skip: false,
    idempotencyKey,
    eventId: inserted.data?.id || null,
  };
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

const sendEmail = async (
  supabase: SupabaseClient,
  orderId: number,
  payload: EmailPayload
) => {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "ReShareLoop <orders@reshareloop.com>";
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping email.");
    return { skipped: true, reason: "missing_api_key" };
  }

  const event = await safeInsertEvent(supabase, orderId, payload);
  if (event.skip) return { skipped: true, reason: "already_sent" };

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "Idempotency-Key": event.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = data?.message || `Resend responded with ${res.status}`;
      await updateEvent(supabase, event.eventId, "failed", undefined, message);
      throw new Error(message);
    }

    await updateEvent(supabase, event.eventId, "sent", data?.id);
    return { sent: true, providerId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateEvent(supabase, event.eventId, "failed", undefined, message);
    console.error("Email send failed:", message);
    return { sent: false, error: message };
  }
};

const getUserEmail = async (supabase: SupabaseClient, userId?: string | null) => {
  if (!userId) return null;
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error) {
    console.warn("Could not fetch user email:", userId, error.message);
    return null;
  }
  return data.user?.email || null;
};

export const sendOrderEmails = async ({
  supabase,
  orderId,
  eventType,
  status,
}: SendEmailOptions) => {
  const { data: order, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (error || !order) {
    throw new Error(error?.message || "Order not found");
  }

  const items = Array.isArray(order.items) ? (order.items as OrderItem[]) : [];
  const address = (order.address || {}) as OrderAddress;
  const currency = String(order.charge_currency || order.deposit_currency || "USD").toUpperCase();
  const siteUrl = Deno.env.get("SITE_URL") || Deno.env.get("FRONTEND_URL") || "https://www.reshareloop.com";
  const orderUrl = `${siteUrl.replace(/\/$/, "")}/orders`;
  const buyerEmail =
    address.email || (await getUserEmail(supabase, order.buyer_id || order.user_id));
  const results: unknown[] = [];

  if (buyerEmail) {
    const isStatusUpdate = eventType === "order_status_updated";
    const buyerSubject = isStatusUpdate
      ? `Your ReShareLoop order #${order.id} is ${status || order.status}`
      : `Your ReShareLoop order #${order.id} is confirmed`;
    const buyerText = [
      `Hi ${fullName(address)},`,
      "",
      isStatusUpdate
        ? `Your order status is now: ${status || order.status}.`
        : "Thanks for your order. We received the details below.",
      "",
      itemListText(items),
      "",
      `Order total: ${money(order.amount, currency)}`,
      `Payment method: ${order.paymentmethod || "N/A"}`,
      `View your order: ${orderUrl}`,
    ].join("\n");

    const buyerHtml = `
      <p>Hi ${escapeHtml(fullName(address))},</p>
      <p>${
        isStatusUpdate
          ? `Your order status is now: <strong>${escapeHtml(status || order.status)}</strong>.`
          : "Thanks for your order. We received the details below."
      }</p>
      ${itemListHtml(items)}
      <p><strong>Order total:</strong> ${escapeHtml(money(order.amount, currency))}</p>
      <p><strong>Payment method:</strong> ${escapeHtml(order.paymentmethod || "N/A")}</p>
      <p><a href="${escapeHtml(orderUrl)}">View your order</a></p>
    `;

    results.push(
      await sendEmail(supabase, orderId, {
        to: buyerEmail,
        subject: buyerSubject,
        html: buyerHtml,
        text: buyerText,
        eventType,
        recipientRole: "buyer",
      })
    );
  }

  if (eventType !== "order_status_updated") {
    for (const [sellerId, sellerItems] of groupItemsBySeller(items)) {
      const sellerEmail = await getUserEmail(supabase, sellerId);
      if (!sellerEmail) continue;

      const hasRental = sellerItems.some((item) => Boolean(item.rentInfo));
      const hasSale = sellerItems.some((item) => !item.rentInfo);
      const sellerSubtotal = sellerItems.reduce((sum, item) => sum + itemAmount(item), 0);
      const typeLabel = hasRental && hasSale ? "sale/rental" : hasRental ? "rental" : "sale";
      const buyerLines = addressLines(address);
      const sellerText = [
        `You have a new ${typeLabel} on ReShareLoop.`,
        "",
        `Order #${order.id}`,
        `Buyer: ${fullName(address)}`,
        ...buyerLines,
        "",
        itemListText(sellerItems),
        "",
        `Your subtotal: ${money(sellerSubtotal, currency)}`,
      ].join("\n");

      const sellerHtml = `
        <p>You have a new ${escapeHtml(typeLabel)} on ReShareLoop.</p>
        <p><strong>Order #${escapeHtml(order.id)}</strong></p>
        <p><strong>Buyer:</strong> ${escapeHtml(fullName(address))}<br>${buyerLines
          .map(escapeHtml)
          .join("<br>")}</p>
        ${itemListHtml(sellerItems)}
        <p><strong>Your subtotal:</strong> ${escapeHtml(money(sellerSubtotal, currency))}</p>
      `;

      results.push(
        await sendEmail(supabase, orderId, {
          to: sellerEmail,
          subject: `New ${typeLabel} on ReShareLoop: order #${order.id}`,
          html: sellerHtml,
          text: sellerText,
          eventType,
          recipientRole: "seller",
          sellerId,
        })
      );
    }
  }

  return results;
};
