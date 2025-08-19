export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface Chat {
  id: string;
  title: string;
  messages: ChatMessage[];
  type?: "planner" | "general";
}