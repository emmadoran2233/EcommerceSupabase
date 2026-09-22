import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sendTransactionalEmail } from "../_shared/mailer.ts";
import { hydrateOrderWithItems } from "../_shared/orderItems.js";
import { SUPPORT_EMAIL } from "./knowledge.ts";

type OrderItem = {
  name?: string;
  price?: number | string;
  price_per_day?: number | string;
  quantity?: number | string;
  size?: string;
  rentInfo?: {
    startDate?: string;
    endDate?: string;
    rentFee?: number | string;
    deposit?: number | string;
    totalPrice?: number | string;
  };
};

type OrderRow = {
  id: number;
  order_number?: string;
  items?: OrderItem[];
  amount?: number | string;
  status?: string;
  date?: string;
  created_at?: string;
  payment?: boolean;
  paymentmethod?: string;
  charge_currency?: string;
  deposit_currency?: string;
  shipping_tracking_number?: string | null;
  shipping_tracking_url?: string | null;
};

const SELECT_ORDER_FIELDS = [
  "id",
  "order_number",
  "items",
  "amount",
  "status",
  "date",
  "created_at",
  "payment",
  "paymentmethod",
  "charge_currency",
  "deposit_currency",
  "shipping_tracking_number",
  "shipping_tracking_url",
].join(", ");

const BASE_ORDER_FIELDS = [
  "id",
  "order_number",
  "items",
  "amount",
  "status",
  "date",
  "created_at",
  "payment",
  "paymentmethod",
  "charge_currency",
  "deposit_currency",
].join(", ");

const ensureNumber = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatMoney = (value: unknown, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(ensureNumber(value));

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const itemQuantity = (item: OrderItem) =>
  Math.max(ensureNumber(item.quantity || 1), 1);

const itemAmount = (item: OrderItem) => {
  if (item.rentInfo) {
    return ensureNumber(item.rentInfo.rentFee || item.rentInfo.totalPrice);
  }
  return ensureNumber(item.price || item.price_per_day) * itemQuantity(item);
};

const extractOrderReference = (message: string) => {
  const match = message.match(
    /(?:order\s*#?|订单\s*#?)\s*([0-9]{14}-[a-f0-9]{6}-[0-9]{8,}|\d+)/i
  );
  return match ? match[1].toUpperCase() : null;
};

const getOrderNumber = (order: OrderRow) => order.order_number || String(order.id);

const getOrderCurrency = (order: OrderRow) =>
  String(order.charge_currency || order.deposit_currency || "USD")
    .toUpperCase();

const buildOrderText = (order: OrderRow) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const currency = getOrderCurrency(order);
  const itemLines = items.length
    ? items.map((item) => {
        const rentalDates =
          item.rentInfo?.startDate && item.rentInfo?.endDate
            ? ` | Rental dates: ${formatDate(item.rentInfo.startDate)} to ${
                formatDate(item.rentInfo.endDate)
              }`
            : "";
        return `- ${item.name || "Order item"} | Qty: ${itemQuantity(item)}${
          item.size ? ` | Size: ${item.size}` : ""
        }${rentalDates} | ${formatMoney(itemAmount(item), currency)}`;
      })
    : ["- No item details were included with this order."];

  return [
    `Order #${getOrderNumber(order)}`,
    `Date: ${formatDate(order.date || order.created_at)}`,
    `Status: ${order.status || "N/A"}`,
    `Payment: ${order.payment ? "Paid" : "Not paid"}`,
    `Payment method: ${order.paymentmethod || "N/A"}`,
    `Total: ${formatMoney(order.amount, currency)}`,
    order.shipping_tracking_number
      ? `Tracking number: ${order.shipping_tracking_number}`
      : "",
    order.shipping_tracking_url ? `Tracking link: ${order.shipping_tracking_url}` : "",
    "",
    "Items:",
    ...itemLines,
    "",
    `For account-specific help, contact ${SUPPORT_EMAIL}.`,
  ]
    .filter((line) => line !== "")
    .join("\n");
};

const buildOrderHtml = (order: OrderRow) => {
  const items = Array.isArray(order.items) ? order.items : [];
  const currency = getOrderCurrency(order);
  const itemRows = items.length
    ? items
        .map((item) => {
          const rentalDates =
            item.rentInfo?.startDate && item.rentInfo?.endDate
              ? `<div style="color:#64748b;font-size:13px;">Rental dates: ${
                  escapeHtml(formatDate(item.rentInfo.startDate))
                } to ${escapeHtml(formatDate(item.rentInfo.endDate))}</div>`
              : "";
          return `
            <tr>
              <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
                <div style="font-weight:700;color:#111827;">${escapeHtml(
                  item.name || "Order item"
                )}</div>
                <div style="color:#64748b;font-size:13px;">Qty: ${escapeHtml(
                  itemQuantity(item)
                )}${item.size ? ` | Size: ${escapeHtml(item.size)}` : ""}</div>
                ${rentalDates}
              </td>
              <td align="right" style="padding:10px 0;border-bottom:1px solid #e5e7eb;font-weight:700;">
                ${escapeHtml(formatMoney(itemAmount(item), currency))}
              </td>
            </tr>
          `;
        })
        .join("")
    : `<tr><td colspan="2" style="padding:10px 0;color:#64748b;">No item details were included with this order.</td></tr>`;

  const tracking = order.shipping_tracking_number
    ? `<p><strong>Tracking number:</strong> ${escapeHtml(order.shipping_tracking_number)}</p>`
    : "";
  const trackingLink = order.shipping_tracking_url
    ? `<p><a href="${escapeHtml(order.shipping_tracking_url)}">Open tracking link</a></p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
      <h1 style="font-size:22px;">Your ReShareLoop order summary</h1>
      <p>Here is the order information you requested from ReShareLoop chat.</p>
      <p><strong>Order #${escapeHtml(getOrderNumber(order))}</strong></p>
      <p><strong>Date:</strong> ${escapeHtml(formatDate(order.date || order.created_at))}</p>
      <p><strong>Status:</strong> ${escapeHtml(order.status || "N/A")}</p>
      <p><strong>Payment:</strong> ${escapeHtml(order.payment ? "Paid" : "Not paid")}</p>
      <p><strong>Payment method:</strong> ${escapeHtml(order.paymentmethod || "N/A")}</p>
      ${tracking}
      ${trackingLink}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:18px;">
        ${itemRows}
      </table>
      <p style="font-size:18px;"><strong>Total:</strong> ${escapeHtml(
        formatMoney(order.amount, currency)
      )}</p>
      <p>If anything looks incorrect, contact ReShareLoop support at ${escapeHtml(
        SUPPORT_EMAIL
      )}.</p>
    </div>
  `;
};

const createUserClient = (authorization: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase environment variables are not configured");
  }

  return createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
};

const createServiceClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service role is not configured");
  }

  return createClient(supabaseUrl, serviceKey);
};

export const sendOrderSummaryEmail = async (
  req: Request,
  latestUserMessage: string
) => {
  const authorization = req.headers.get("Authorization") || "";
  const userSupabase = createUserClient(authorization);
  const { data: authData, error: authError } = await userSupabase.auth.getUser();

  if (authError || !authData.user?.id || !authData.user.email) {
    return {
      success: true,
      reply:
        "Please sign in before asking me to email your order information. I can only send order details to the email address on your ReShareLoop account.",
      source: "order_email",
    };
  }

  const requestedOrderReference = extractOrderReference(latestUserMessage);
  const ownerFilter = `buyer_id.eq.${authData.user.id},user_id.eq.${authData.user.id}`;
  const buildQuery = (fields: string) => {
    if (requestedOrderReference) {
      const orderQuery = userSupabase
        .from("orders")
        .select(fields)
        .or(ownerFilter);
      return /^\d+$/.test(requestedOrderReference)
        ? orderQuery.eq("id", requestedOrderReference)
        : orderQuery.eq("order_number", requestedOrderReference);
    } else {
      return userSupabase
        .from("orders")
        .select(fields)
        .or(ownerFilter)
        .order("created_at", { ascending: false })
        .limit(1);
    }
  };

  let { data, error } = await buildQuery(SELECT_ORDER_FIELDS);
  if (error && error.message?.includes("shipping_tracking")) {
    const fallback = await buildQuery(BASE_ORDER_FIELDS);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  const legacyOrder = Array.isArray(data)
    ? (data[0] as OrderRow | undefined)
    : null;
  if (!legacyOrder) {
    return {
      success: true,
      reply: requestedOrderReference
        ? "I could not find that order on your ReShareLoop account. Please check the order number on your Orders page."
        : "I could not find any orders on your ReShareLoop account yet.",
      source: "order_email",
    };
  }

  const order = (await hydrateOrderWithItems(
    userSupabase,
    legacyOrder
  )) as OrderRow;
  const serviceSupabase = createServiceClient();
  const orderNumber = getOrderNumber(order);
  const result = await sendTransactionalEmail({
    supabase: serviceSupabase,
    to: authData.user.email,
    subject: `Your ReShareLoop order #${orderNumber} summary`,
    html: buildOrderHtml(order),
    text: buildOrderText(order),
    eventType: "chat_order_summary_requested",
    recipientRole: "buyer",
    userId: authData.user.id,
    orderId: order.id,
    idempotencyKey: [
      "chat_order_summary_requested",
      `order:${order.id}`,
      `user:${authData.user.id}`,
      `request:${crypto.randomUUID()}`,
    ].join(":"),
  }) as { sent?: boolean; skipped?: boolean; error?: string };

  if (result.sent || result.skipped) {
    return {
      success: true,
      reply: `I sent order #${orderNumber} to the email address on your ReShareLoop account.`,
      source: "order_email",
      orderId: order.id,
    };
  }

  return {
    success: false,
    error: result.error || "Unable to send the order email right now.",
    source: "order_email",
  };
};
