export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type Chat = {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** FastAPI returns snake_case; normalize at extraction point */
  created_at?: string;
  createdAt?: string;
};
