import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
//CORS and JSON headers, which allow front-end POST requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const MAX_MESSAGES = 12;
const MAX_CONTENT_LENGTH = 1200;
const MAX_PAGE_CONTEXT_LENGTH = 1800;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";//not sure
const DEFAULT_MODEL = "gpt-5.5";//not sure yet

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};
//define message category
const sanitizeText = (value: unknown, maxLength = MAX_CONTENT_LENGTH) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });
//mock AI response roles
const getSiteInstructions = (pageContext: unknown) => {
  const context =
    pageContext && typeof pageContext === "object"
      ? JSON.stringify(pageContext).slice(0, MAX_PAGE_CONTEXT_LENGTH)
      : "";

  return [
    "You are ReShareLoop's AI shopping assistant.",
    "Help customers with buying, renting, lending, selling, product discovery, checkout, returns, shipping, account navigation, and basic platform questions.",
    "Use a calm, concise, helpful tone. Keep answers under 140 words unless the customer asks for details.",
    "Do not invent live order status, inventory changes, payment outcomes, seller promises, legal advice, or policy exceptions.",
    "For private account, payment, order-specific, refund-specific, or seller-specific issues, explain what the customer can check in the app and recommend contacting ReShareLoop support at contact@reshareloop.com.",
    "Known ReShareLoop facts:",
    "- ReShareLoop lets users buy, rent, lend, sell unused items, and offer services.",
    "- Buyers can browse products, add items to cart, place orders, and manage orders from the Orders page.",
    "- Sellers/lenders use the seller center to list sale items, lendable items, manage inventory, orders, banners, and store profile.",
    "- Eligible purchase returns are accepted within 30 days of delivery.",
    "- New unused return items must be unused, unworn, and in original packaging, with proof of purchase.",
    "- Clearance, personalized, or final-sale products may not be returnable.",
    "- Buyers pay return shipping unless the item is defective or incorrect.",
    "- Approved refunds go back to the original payment method within 5-10 business days.",
    "- Defective or incorrect items should be reported within 7 days of delivery.",
    context ? `Current page context: ${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};
//Normalize messages received from the browser, 
//retaining only valid roles and non-empty content, 
//and retrieve only the most recent 12 entries.
const normalizeMessages = (messages: unknown): ChatMessage[] => {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-MAX_MESSAGES)
    .map((message) => {
      if (!message || typeof message !== "object") return null;
      const role = (message as { role?: unknown }).role;
      const content = sanitizeText((message as { content?: unknown }).content);
      if ((role !== "user" && role !== "assistant") || !content) return null;
      return { role, content };
    })
    .filter(Boolean) as ChatMessage[];
};
//
// Responses may expose text as a shortcut or nested message content.
const extractText = (response: Record<string, unknown>) => {
  if (typeof response.output_text === "string") {
    return response.output_text.trim();
  }

  const output = Array.isArray(response.output) ? response.output : [];
  const chunks: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") chunks.push(text);
    }
  }

  return chunks.join("\n").trim();
};
//Extract readable error messages from OpenAI error responses.
const getOpenAiError = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;

  const error = (payload as { error?: unknown }).error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
};

serve(async (req) => {
  //deal w/ CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  //only POST
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return jsonResponse(
        {
          success: false,
          error: "OPENAI_API_KEY is not configured",
        },
        500
      );
    }

    const body = await req.json().catch(() => ({}));
    const messages = normalizeMessages(body.messages);
    // Require at least one user turn after sanitizing untrusted browser input.
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage) {
      return jsonResponse({ success: false, error: "Missing user message" }, 400);
    }

    const model = Deno.env.get("OPENAI_MODEL") || DEFAULT_MODEL;
    const openAiResponse = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: getSiteInstructions(body.pageContext),
        input: messages,
        max_output_tokens: 450,
      }),
    });

    const data = await openAiResponse.json().catch(() => ({}));

    if (!openAiResponse.ok) {
      const message = getOpenAiError(
        data,
        `OpenAI request failed with status ${openAiResponse.status}`
      );
      return jsonResponse({ success: false, error: message }, 502);
    }

    const reply = extractText(data);
    if (!reply) {
      return jsonResponse(
        {
          success: false,
          error: "The assistant did not return a message",
        },
        502
      );
    }

    return jsonResponse({ success: true, reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("aiChat failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
