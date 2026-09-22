import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeHtml, sendTransactionalEmail } from "../_shared/mailer.ts";
import { hydrateOrdersWithItems } from "../_shared/orderItems.js";
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

const RECENT_ORDER_LIMIT = 5;

const ORDER_SELECT_FIELDS = [
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

const BASE_ORDER_SELECT_FIELDS = [
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

const getCurrency = (order: OrderRow) =>
  String(order.charge_currency || order.deposit_currency || "USD")
    .toUpperCase();

const getOrderNumber = (order: OrderRow) => order.order_number || String(order.id);

const itemQuantity = (item: OrderItem) =>
  Math.max(ensureNumber(item.quantity || 1), 1);

const itemAmount = (item: OrderItem) => {
  if (item.rentInfo) {
    return ensureNumber(item.rentInfo.rentFee || item.rentInfo.totalPrice);
  }
  return ensureNumber(item.price || item.price_per_day) * itemQuantity(item);
};

const itemLabel = (item: OrderItem, currency: string) => {
  const rentalDates =
    item.rentInfo?.startDate && item.rentInfo?.endDate
      ? ` | Rental: ${formatDate(item.rentInfo.startDate)} to ${
          formatDate(item.rentInfo.endDate)
        }`
      : "";

  return `${item.name || "Order item"} | Qty: ${itemQuantity(item)}${
    item.size ? ` | Size: ${item.size}` : ""
  }${rentalDates} | ${formatMoney(itemAmount(item), currency)}`;
};

const orderTextBlock = (order: OrderRow) => {
  const currency = getCurrency(order);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemLines = items.length
    ? items.slice(0, 6).map((item) => `  - ${itemLabel(item, currency)}`)
    : ["  - No item details were included with this order."];

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
    order.shipping_tracking_url
      ? `Tracking link: ${order.shipping_tracking_url}`
      : "",
    "Items:",
    ...itemLines,
  ]
    .filter(Boolean)
    .join("\n");
};

const orderHtmlBlock = (order: OrderRow) => {
  const currency = getCurrency(order);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemRows = items.length
    ? items.slice(0, 6).map((item) => {
      const rentalDates =
        item.rentInfo?.startDate && item.rentInfo?.endDate
          ? `<div style="color:#64748b;font-size:13px;">Rental: ${
            escapeHtml(formatDate(item.rentInfo.startDate))
          } to ${escapeHtml(formatDate(item.rentInfo.endDate))}</div>`
          : "";

      return `
          <li style="margin:8px 0;">
            <strong>${escapeHtml(item.name || "Order item")}</strong>
            <div style="color:#475569;font-size:13px;">Qty: ${escapeHtml(
              itemQuantity(item)
            )}${item.size ? ` | Size: ${escapeHtml(item.size)}` : ""}</div>
            ${rentalDates}
            <div style="color:#111827;font-size:13px;">${escapeHtml(
              formatMoney(itemAmount(item), currency)
            )}</div>
          </li>
        `;
    }).join("")
    : `<li style="margin:8px 0;color:#64748b;">No item details were included with this order.</li>`;

  const tracking = order.shipping_tracking_number
    ? `<p style="margin:4px 0;"><strong>Tracking:</strong> ${escapeHtml(
      order.shipping_tracking_number
    )}</p>`
    : "";
  const trackingLink = order.shipping_tracking_url
    ? `<p style="margin:4px 0;"><a href="${
      escapeHtml(order.shipping_tracking_url)
    }">Open tracking link</a></p>`
    : "";

  return `
    <section style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:16px 0;">
      <h2 style="font-size:18px;margin:0 0 8px;">Order #${escapeHtml(getOrderNumber(order))}</h2>
      <p style="margin:4px 0;"><strong>Date:</strong> ${escapeHtml(
        formatDate(order.date || order.created_at)
      )}</p>
      <p style="margin:4px 0;"><strong>Status:</strong> ${escapeHtml(
        order.status || "N/A"
      )}</p>
      <p style="margin:4px 0;"><strong>Payment:</strong> ${escapeHtml(
        order.payment ? "Paid" : "Not paid"
      )}</p>
      <p style="margin:4px 0;"><strong>Payment method:</strong> ${escapeHtml(
        order.paymentmethod || "N/A"
      )}</p>
      ${tracking}
      ${trackingLink}
      <ul style="padding-left:18px;margin:12px 0;">${itemRows}</ul>
      <p style="margin:8px 0 0;font-size:16px;"><strong>Total:</strong> ${
    escapeHtml(formatMoney(order.amount, currency))
  }</p>
    </section>
  `;
};

const buildEmailText = (orders: OrderRow[]) =>
  [
    "Here is a summary of your recent ReShareLoop orders.",
    "",
    ...orders.map(orderTextBlock),
    "",
    `For account-specific help, contact ${SUPPORT_EMAIL}.`,
  ].join("\n\n");

const buildEmailHtml = (orders: OrderRow[]) => `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
    <h1 style="font-size:22px;margin-bottom:8px;">Your recent ReShareLoop orders</h1>
    <p>Here is a summary of your latest ${escapeHtml(orders.length)} order${
  orders.length === 1 ? "" : "s"
} from ReShareLoop.</p>
    ${orders.map(orderHtmlBlock).join("")}
    <p>If anything looks incorrect, contact ReShareLoop support at ${
  escapeHtml(SUPPORT_EMAIL)
}.</p>
  </div>
`;

const createUserClient = (authorization: string) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) {
    throw new Error("Supabase auth environment is not configured");
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

const fetchRecentOrders = async (
  userSupabase: ReturnType<typeof createClient>,
  userId: string
) => {
  const ownerFilter = `buyer_id.eq.${userId},user_id.eq.${userId}`;
  const buildQuery = (fields: string) =>
    userSupabase
      .from("orders")
      .select(fields)
      .or(ownerFilter)
      .order("created_at", { ascending: false })
      .limit(RECENT_ORDER_LIMIT);

  let { data, error } = await buildQuery(ORDER_SELECT_FIELDS);
  if (error && error.message?.includes("shipping_tracking")) {
    const fallback = await buildQuery(BASE_ORDER_SELECT_FIELDS);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) throw new Error(error.message);
  const orders = Array.isArray(data) ? (data as OrderRow[]) : [];
  return (await hydrateOrdersWithItems(
    userSupabase,
    orders
  )) as OrderRow[];
};

export const sendRecentOrderSummaryEmail = async (req: Request) => {
  const authorization = req.headers.get("Authorization") || "";
  const userSupabase = createUserClient(authorization);
  const { data: authData, error: authError } = await userSupabase.auth.getUser();

  if (authError || !authData.user?.id || !authData.user.email) {
    return {
      success: true,
      authenticated: false,
      source: "order_summary_email",
      reply:
        "Please sign in before asking me to email your order information.",
    };
  }

  const orders = await fetchRecentOrders(userSupabase, authData.user.id);
  if (!orders.length) {
    return {
      success: true,
      authenticated: true,
      source: "order_summary_email",
      reply: "I could not find any orders on your ReShareLoop account yet.",
    };
  }

  const serviceSupabase = createServiceClient();
  const result = await sendTransactionalEmail({
    supabase: serviceSupabase,
    to: authData.user.email,
    subject: "Your recent ReShareLoop order summary",
    html: buildEmailHtml(orders),
    text: buildEmailText(orders),
    eventType: "chat_recent_orders_summary_requested",
    recipientRole: "buyer",
    userId: authData.user.id,
    orderId: null,
    idempotencyKey: [
      "chat_recent_orders_summary_requested",
      `user:${authData.user.id}`,
      `request:${crypto.randomUUID()}`,
    ].join(":"),
  }) as { sent?: boolean; skipped?: boolean; error?: string };

  if (result.sent || result.skipped) {
    return {
      success: true,
      authenticated: true,
      source: "order_summary_email",
      reply: `I sent a summary of your latest ${orders.length} order${
        orders.length === 1 ? "" : "s"
      } to the email address on your ReShareLoop account.`,
    };
  }

  return {
    success: false,
    authenticated: true,
    source: "order_summary_email",
    error: result.error || "Unable to send the order summary email right now.",
  };
};
