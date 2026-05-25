import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupabaseClient = ReturnType<typeof createClient>;

type OrderItem = {
  id?: string | number;
  name?: string;
  price?: number | string;
  price_per_day?: number | string;
  quantity?: number | string;
  size?: string;
  seller_id?: string;
  rentable?: boolean;
  category?: string;
  sub_category?: string;
  images?: string[];
  image_urls?: string[];
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

const itemQuantity = (item: OrderItem) =>
  Math.max(ensureNumber(item.quantity || 1), 1);

const itemAmount = (item: OrderItem) => {
  if (item.rentInfo) {
    return ensureNumber(item.rentInfo.rentFee || item.rentInfo.totalPrice);
  }
  return ensureNumber(item.price) * itemQuantity(item);
};

const firstItemImage = (item: OrderItem) => {
  const image = item.images?.[0] || item.image_urls?.[0];
  return typeof image === "string" && image.startsWith("http") ? image : "";
};

const formatDate = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const itemTypeLabel = (item: OrderItem) => (item.rentInfo ? "Rental" : "Sale");

const itemDetails = (item: OrderItem) =>
  [
    item.category ? `Category: ${item.category}` : "",
    item.size ? `Size: ${item.size}` : "",
    item.rentInfo?.startDate && item.rentInfo?.endDate
      ? `Rental dates: ${formatDate(item.rentInfo.startDate)} to ${formatDate(
          item.rentInfo.endDate
        )}`
      : "",
    item.customization?.lines?.filter(Boolean).length
      ? `Custom: ${item.customization.lines.filter(Boolean).join(" / ")}`
      : "",
  ].filter(Boolean);

const itemDescription = (item: OrderItem) => {
  const parts = [
    item.name || "Order item",
    itemTypeLabel(item),
    ...itemDetails(item),
    item.rentInfo?.deposit
      ? `Deposit: ${money(item.rentInfo.deposit)}`
      : "",
  ].filter(Boolean);

  return `${parts.join(" | ")} | Qty: ${itemQuantity(item)} | ${money(itemAmount(item))}`;
};

const itemListHtml = (items: OrderItem[], currency = "USD") => {
  if (!items.length) {
    return `<p style="margin:0;color:#64748b;">No item details were included with this order.</p>`;
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 12px;">
      ${items
        .map((item) => {
          const image = firstItemImage(item);
          const details = itemDetails(item);
          const rentRows = item.rentInfo
            ? [
                item.rentInfo.rentFee
                  ? `<div style="margin-top:6px;color:#64748b;font-size:13px;">Rent fee: ${escapeHtml(
                      money(item.rentInfo.rentFee, currency)
                    )}</div>`
                  : "",
                item.rentInfo.deposit
                  ? `<div style="margin-top:4px;color:#64748b;font-size:13px;">Deposit: ${escapeHtml(
                      money(item.rentInfo.deposit, currency)
                    )}</div>`
                  : "",
              ].join("")
            : "";

          return `
            <tr>
              <td style="padding:0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;background:#ffffff;">
                  <tr>
                    <td width="84" valign="top" style="padding:14px 0 14px 14px;">
                      ${
                        image
                          ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(
                              item.name || "Order item"
                            )}" width="70" height="70" style="display:block;width:70px;height:70px;border-radius:8px;object-fit:cover;border:1px solid #e5e7eb;">`
                          : `<div style="width:70px;height:70px;border-radius:8px;background:#f1f5f9;border:1px solid #e5e7eb;"></div>`
                      }
                    </td>
                    <td valign="top" style="padding:14px 12px;">
                      <div style="font-size:15px;line-height:20px;font-weight:700;color:#111827;">${escapeHtml(
                        item.name || "Order item"
                      )}</div>
                      <div style="margin-top:6px;">
                        <span style="display:inline-block;padding:3px 8px;border-radius:999px;background:${
                          item.rentInfo ? "#ecfeff" : "#f0fdf4"
                        };color:${
                          item.rentInfo ? "#155e75" : "#166534"
                        };font-size:12px;font-weight:700;">${escapeHtml(itemTypeLabel(item))}</span>
                        <span style="display:inline-block;margin-left:6px;color:#64748b;font-size:13px;">Qty ${escapeHtml(
                          itemQuantity(item)
                        )}</span>
                      </div>
                      ${
                        details.length
                          ? `<div style="margin-top:8px;color:#475569;font-size:13px;line-height:19px;">${details
                              .map(escapeHtml)
                              .join("<br>")}</div>`
                          : ""
                      }
                      ${rentRows}
                    </td>
                    <td valign="top" align="right" width="110" style="padding:14px 14px 14px 0;">
                      <div style="font-size:14px;font-weight:700;color:#111827;">${escapeHtml(
                        money(itemAmount(item), currency)
                      )}</div>
                      ${
                        !item.rentInfo
                          ? `<div style="margin-top:6px;color:#64748b;font-size:12px;">${escapeHtml(
                              money(item.price, currency)
                            )} each</div>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          `;
        })
        .join("")}
    </table>
  `;
};

const itemListText = (items: OrderItem[]) =>
  items.map((item) => `- ${itemDescription(item)}`).join("\n");

const emailLayout = ({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: string;
}) => `
  <div style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
            <tr>
              <td style="padding:26px 28px;background:#111827;color:#ffffff;">
                <div style="font-size:12px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:#cbd5e1;">ReShareLoop</div>
                <h1 style="margin:8px 0 0;font-size:24px;line-height:32px;font-weight:700;color:#ffffff;">${escapeHtml(
                  title
                )}</h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:22px;color:#e5e7eb;">${escapeHtml(
                  intro
                )}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px;">
                ${children}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

const summaryRow = (label: string, value: unknown) => `
  <tr>
    <td style="padding:7px 0;color:#64748b;font-size:14px;">${escapeHtml(label)}</td>
    <td align="right" style="padding:7px 0;color:#111827;font-size:14px;font-weight:700;">${escapeHtml(
      value || "N/A"
    )}</td>
  </tr>
`;

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
  const resultMeta = {
    recipientRole: payload.recipientRole,
    to: payload.to,
    sellerId: payload.sellerId || null,
  };
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM") || "ReShareLoop <orders@reshareloop.com>";
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not configured; skipping email.");
    return { ...resultMeta, skipped: true, reason: "missing_api_key" };
  }

  const event = await safeInsertEvent(supabase, orderId, payload);
  if (event.skip) return { ...resultMeta, skipped: true, reason: "already_sent" };

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
    return { ...resultMeta, sent: true, providerId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateEvent(supabase, event.eventId, "failed", undefined, message);
    console.error("Email send failed:", message);
    return { ...resultMeta, sent: false, error: message };
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
    const isCancellation = eventType === "order_cancelled";
    const buyerSubject = isStatusUpdate
      ? `Your ReShareLoop order #${order.id} is ${status || order.status}`
      : isCancellation
        ? `Your ReShareLoop order #${order.id} has been cancelled`
        : `Your ReShareLoop order #${order.id} is confirmed`;
    const buyerText = [
      `Hi ${fullName(address)},`,
      "",
      isStatusUpdate
        ? `Your order status is now: ${status || order.status}.`
        : isCancellation
          ? "Your order has been cancelled. The order details are below for your records."
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
          : isCancellation
            ? "Your order has been cancelled. The order details are below for your records."
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

      const isCancellation = eventType === "order_cancelled";
      const hasRental = sellerItems.some((item) => Boolean(item.rentInfo));
      const hasSale = sellerItems.some((item) => !item.rentInfo);
      const sellerSubtotal = sellerItems.reduce((sum, item) => sum + itemAmount(item), 0);
      const typeLabel = hasRental && hasSale ? "sale/rental" : hasRental ? "rental" : "sale";
      const buyerLines = addressLines(address);
      const sellerText = [
        isCancellation
          ? `A ${typeLabel} order has been cancelled on ReShareLoop.`
          : `You have a new ${typeLabel} on ReShareLoop.`,
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
        <p>${
          isCancellation
            ? `A ${escapeHtml(typeLabel)} order has been cancelled on ReShareLoop.`
            : `You have a new ${escapeHtml(typeLabel)} on ReShareLoop.`
        }</p>
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
          subject: isCancellation
            ? `Cancelled ${typeLabel} on ReShareLoop: order #${order.id}`
            : `New ${typeLabel} on ReShareLoop: order #${order.id}`,
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
