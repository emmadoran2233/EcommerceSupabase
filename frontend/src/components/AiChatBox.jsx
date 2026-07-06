import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import { ShopContext } from "../context/ShopContext";
import { supabase } from "../supabaseClient";

const starterPrompts = [
  "How does renting work?",
  "What is the return policy?",
  "How do I become a seller?",
];

const CLIENT_MESSAGE_LIMIT = 12;
const SUPPORT_EMAIL = "contact@reshareloop.com";

const initialMessages = [
  {
    role: "assistant",
    content:
      "Hi, I can help with shopping, renting, returns, seller setup, and using ReShareLoop.",
  },
];
//define chatBox components
const AiChatBox = () => {
  const { products, currency } = useContext(ShopContext);
  const location = useLocation(); //which page looking at
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState(""); //keep draft
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef(null); //auto scroll

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  // Give the AI lightweight page context without exposing private account data.
  const pageContext = useMemo(() => {
    const productMatch = location.pathname.match(/^\/product\/([^/]+)/);
    const currentProduct = productMatch
      ? products.find((product) => String(product.id) === productMatch[1])
      : null;

    if (currentProduct) {
      return {
        page: "product",
        product: {
          name: currentProduct.name,
          category: currentProduct.category,
          subCategory: currentProduct.subCategory,
          price: `${currency}${currentProduct.price}`,
          rentable: Boolean(currentProduct.rentable),
          stock: currentProduct.stock,
          description: currentProduct.description,
        },
      };
    }

    return {
      page: location.pathname,
    };
  }, [currency, location.pathname, products]);
  // sent user message
  const sendMessage = async (content) => {
    const text = content.trim();//trim space between content
    if (!text || isSending) return;//check null

    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setDraft("");
    setIsSending(true);
    //call supabase edge function
    try {
      const { data, error } = await supabase.functions.invoke("aiChat", {
        body: {
          messages: nextMessages.slice(-CLIENT_MESSAGE_LIMIT),
          pageContext,
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "Unable to get an AI response.");
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            data?.reply ||
            "I could not generate a response. Please try again.",
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI chat is unavailable.";
      toast.error(message);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            `I am having trouble connecting right now. Please try again, or contact ${SUPPORT_EMAIL} for help.`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };
  //Process form submission, 
  const handleSubmit = (event) => {
    event.preventDefault();//prevent the browser from refreshing by default,
    sendMessage(draft);
    console.log("form submitted");
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 sm:right-6">
      {isOpen && (
        <section className="mb-3 flex h-[min(620px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[380px] flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b bg-black px-4 py-3 text-white">
            <div>
              <h2 className="text-sm font-semibold">ReShareLoop Assistant</h2>
              <p className="text-xs text-gray-300">AI help for common questions</p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center border border-white/30 text-lg leading-none hover:bg-white hover:text-black"
              aria-label="Close AI chat"
            >
              ×
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-gray-50 px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <p
                  className={`max-w-[82%] whitespace-pre-wrap rounded-sm px-3 py-2 text-sm leading-5 ${
                    message.role === "user"
                      ? "bg-black text-white"
                      : "border border-gray-200 bg-white text-gray-700"
                  }`}
                >
                  {message.content}
                </p>
              </div>
            ))}
            {isSending && (
              <div className="flex justify-start">
                <p className="border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500">
                  Thinking...
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t bg-white p-3">
            <div className="mb-3 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  disabled={isSending}
                  className="border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:border-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit(event);
                  }
                }}
                placeholder="Ask a question..."
                rows={2}
                className="min-h-[44px] flex-1 resize-none border border-gray-300 px-3 py-2 text-sm outline-none focus:border-black"
              />
              <button
                type="submit"
                disabled={!draft.trim() || isSending}
                className="w-16 bg-black text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                Send
              </button>
            </form>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-sm font-semibold text-white shadow-xl hover:bg-gray-800"
        aria-label={isOpen ? "Hide AI chat" : "Open AI chat"}
      >
        AI
      </button>
    </div>
  );
};

export default AiChatBox;
