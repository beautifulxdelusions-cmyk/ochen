// Shared types for the Ochen terminal agent.
// Ochen routes through any OpenAI-compatible /chat/completions endpoint — by
// default your Trismegistus AI blend (Base Intel / Pro / Ultra). Tools are
// described to the model in the OpenAI function-tool schema so it can call them.

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON-schema object
  run: (args: Record<string, unknown>) => Promise<string>;
}

export interface ToolResult {
  id: string;
  content: string;
}

export interface ModelConfig {
  baseUrl: string; // e.g. https://trismegistus.app/api/v1  (OpenAI-compatible)
  apiKey: string;
  model: string; // blend/entity slug, e.g. "base-intel" or "gpt-4o"
}
