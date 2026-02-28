import api from "@/lib/api";

export type AssistantProduct = {
  id: number;
  name: string;
  slug: string;
  price: string | number;
  image: string;
  category: string;
  availability_status: string;
  available_stock: number;
};

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  products?: AssistantProduct[];
};

export const askAssistant = async (message: string) => {
  const response = await api.post("/ai/assistant/chat/", { message });
  const body = response.data || {};

  return {
    reply: String(body.reply || "I could not generate a response right now."),
    intent: String(body.intent || "GENERAL"),
    suggested_products: Array.isArray(body.suggested_products)
      ? body.suggested_products
      : [],
  };
};
