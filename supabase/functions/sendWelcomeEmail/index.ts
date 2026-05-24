import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  escapeHtml,
  sendTransactionalEmail,
} from "../_shared/mailer.ts";

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

const roleConfig = {
  buyer: {
    recipientRole: "buyer",
    subject: "Welcome to ReShareLoop",
    dashboardPath: "/",
    intro:
      "Your ReShareLoop account has been created successfully. You can now browse items, rent products, buy products, and manage your orders.",
    cta: "Start exploring",
  },
  seller: {
    recipientRole: "seller",
    subject: "Welcome to ReShareLoop Seller Center",
    dashboardPath: "/",
    intro:
      "Your ReShareLoop seller/lender account has been created successfully. You can now list items for sale or rent and manage your customer orders.",
    cta: "Go to your dashboard",
  },
} as const;

type WelcomeRole = keyof typeof roleConfig;

const normalizeRole = (value: unknown): WelcomeRole =>
  value === "seller" ? "seller" : "buyer";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeEmail = (value: unknown) => {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
};

const getSiteUrl = (role: WelcomeRole) => {
  if (role === "seller") {
    return (
      Deno.env.get("ADMIN_SITE_URL") ||
      Deno.env.get("SITE_URL") ||
      "https://admin.reshareloop.com"
    );
  }

  return Deno.env.get("SITE_URL") || "https://www.reshareloop.com";
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
    const userId = typeof body.userId === "string" ? body.userId : "";
    const submittedEmail = normalizeEmail(body.email);
    const role = normalizeRole(body.role);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing userId" }),
        { status: 400, headers: corsHeaders }
      );
    }

    let user = null;
    let lookupError = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { data, error } = await supabase.auth.admin.getUserById(userId);
      if (data.user?.email) {
        user = data.user;
        break;
      }

      lookupError = error?.message || "User email not found";
      if (attempt < 2) {
        await sleep(300);
      }
    }

    const recipientEmail = user?.email || submittedEmail;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          error: lookupError || "User email not found",
        }),
        { status: 404, headers: corsHeaders }
      );
    }

    const config = roleConfig[role];
    const displayName =
      String(user?.user_metadata?.name || body.name || "").trim() ||
      recipientEmail.split("@")[0];
    const siteUrl = getSiteUrl(role).replace(/\/$/, "");
    const dashboardUrl = `${siteUrl}${config.dashboardPath}`;

    const text = [
      `Hi ${displayName},`,
      "",
      config.intro,
      "",
      `${config.cta}: ${dashboardUrl}`,
      "",
      "Thanks,",
      "The ReShareLoop Team",
    ].join("\n");

    const html = `
      <p>Hi ${escapeHtml(displayName)},</p>
      <p>${escapeHtml(config.intro)}</p>
      <p>
        <a href="${escapeHtml(dashboardUrl)}">${escapeHtml(config.cta)}</a>
      </p>
      <p>Thanks,<br>The ReShareLoop Team</p>
    `;

    const result = await sendTransactionalEmail({
      supabase,
      to: recipientEmail,
      subject: config.subject,
      html,
      text,
      eventType: "user_registered",
      recipientRole: config.recipientRole,
      userId,
      idempotencyKey: `user_registered:${role}:${userId}`,
    });
    const emailResult = result as {
      sent?: boolean;
      skipped?: boolean;
      reason?: string;
    };

    if (emailResult.sent === false) {
      return new Response(JSON.stringify({ success: false, result }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    if (emailResult.skipped && emailResult.reason !== "already_sent") {
      return new Response(JSON.stringify({ success: false, result }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sendWelcomeEmail failed:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
