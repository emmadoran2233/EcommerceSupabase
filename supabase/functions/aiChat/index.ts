import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  FAQ_ENTRIES,
  KNOWLEDGE_FACTS,
  OUT_OF_SCOPE_REPLY,
  PLATFORM_KEYWORDS,
  PRODUCT_CONTEXT_KEYWORDS,
  SUPPORT_EMAIL,
} from "./knowledge.ts";

// CORS and JSON headers for browser POST requests.
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
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5-mini";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// Normalize a text field and cap input length before it reaches the model.
const sanitizeText = (value: unknown, maxLength = MAX_CONTENT_LENGTH) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeSearchText = (value: string) => value.toLowerCase();

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const includesKeyword = (text: string, keyword: string) => {
  const normalizedKeyword = normalizeSearchText(keyword).trim();
  if (!normalizedKeyword) return false;

  if (/[a-z0-9]/i.test(normalizedKeyword)) {
    const escapedKeyword = escapeRegExp(normalizedKeyword);
    const suffix = /^[a-z]+$/i.test(normalizedKeyword)
      ? "(?:s|ed|ing)?"
      : "";
    return new RegExp(`\\b${escapedKeyword}${suffix}\\b`, "i").test(text);
  }

  return text.includes(normalizedKeyword);
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders,
  });

// Build model instructions from local ReShareLoop facts and safe page context.
const getSiteInstructions = (pageContext: unknown) => {
  const context =
    pageContext && typeof pageContext === "object"
      ? JSON.stringify(pageContext).slice(0, MAX_PAGE_CONTEXT_LENGTH)
      : "";

  return [
    "You are ReShareLoop's AI shopping assistant.",
    "Help customers with buying, renting, lending, selling, product discovery, checkout, returns, shipping, account navigation, and basic platform questions.",
    "Use a calm, concise, helpful tone. Keep answers under 140 words unless the customer asks for details.",
    "Only answer using the known facts and current page context below.",
    "If the information is not available, say you do not have enough information and recommend the next in-app step or support contact.",
    "Do not invent live order status, inventory changes, payment outcomes, seller promises, legal advice, or policy exceptions.",
    `For private account, payment, order-specific, refund-specific, or seller-specific issues, explain what the customer can check in the app and recommend contacting ReShareLoop support at ${SUPPORT_EMAIL}.`,
    "Known ReShareLoop facts:",
    ...KNOWLEDGE_FACTS.map((fact) => `- ${fact}`),
    context ? `Current page context: ${context}` : "",
  ]
    .filter(Boolean)
    .join("\n");
};
// Keep only trusted chat roles and bounded text from browser input.
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

const isProductPage = (pageContext: unknown) =>
  Boolean(
    pageContext &&
      typeof pageContext === "object" &&
      (pageContext as { page?: unknown }).page === "product"
  );

const isProductContextQuestion = (text: string, pageContext: unknown) =>
  isProductPage(pageContext) &&
  PRODUCT_CONTEXT_KEYWORDS.some((keyword) => includesKeyword(text, keyword));

const isPlatformQuestion = (text: string, pageContext: unknown) => {
  const normalized = normalizeSearchText(text);
  return (
    isProductContextQuestion(normalized, pageContext) ||
    PLATFORM_KEYWORDS.some((keyword) => includesKeyword(normalized, keyword))
  );
};

const findFaqAnswer = (text: string) => {
  const normalized = normalizeSearchText(text);
  return FAQ_ENTRIES.find((entry) =>
    entry.keywords.some((keyword) => includesKeyword(normalized, keyword))
  );
};

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
// Extract readable error messages from OpenAI error responses.
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
  // Handle CORS preflight requests.
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Only POST is supported for chat requests.
  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const messages = normalizeMessages(body.messages);
    // Allows the user to bypass FAQ/scope guard when they explicitly request AI.
    const forceAi = body.forceAi === true || body.responseMode === "ai";
    // Require at least one user turn after sanitizing untrusted browser input.
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user");

    if (!latestUserMessage) {
      return jsonResponse({ success: false, error: "Missing user message" }, 400);
    }

    // Reject unrelated questions locally so they do not spend OpenAI tokens.
    if (!forceAi && !isPlatformQuestion(latestUserMessage.content, body.pageContext)) {
      return jsonResponse({
        success: true,
        reply: OUT_OF_SCOPE_REPLY,
        source: "scope_guard",
      });
    }

    // Return known FAQ answers locally before using the OpenAI API.
    const faqMatch = forceAi ? null : findFaqAnswer(latestUserMessage.content);
    if (faqMatch) {
      return jsonResponse({
        success: true,
        reply: faqMatch.answer,
        source: "faq",
        faqId: faqMatch.id,
      });
    }

    // OpenAI is only required after local answers are exhausted.
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
      const requestId = openAiResponse.headers.get("x-request-id");
      const message = getOpenAiError(
        data,
        `OpenAI request failed with status ${openAiResponse.status}`
      );
      console.error("OpenAI request failed", {
        status: openAiResponse.status,
        requestId,
        error: data,
      });
      return jsonResponse(
        {
          success: false,
          error: message,
          upstreamStatus: openAiResponse.status,
          requestId,
        },
        502
      );
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

    return jsonResponse({ success: true, reply, source: "openai" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("aiChat failed:", message);
    return jsonResponse({ success: false, error: message }, 500);
  }
});
