// Minimal OpenAI-compatible chat client. Points at any /chat/completions
// endpoint — your Trismegistus blend, OpenRouter, Anthropic (via gateway), or
// a local model. No SDK dependency.

import type { ChatMessage, ModelConfig, ToolDef, ToolCall } from "./types.js";

interface ChatCompletionTool {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export async function chat(
  cfg: ModelConfig,
  messages: ChatMessage[],
  tools: ToolDef[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<{ message: ChatMessage; raw: unknown }> {
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 4096,
  };
  if (tools.length) {
    body.tools = tools.map<ChatCompletionTool>((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = "auto";
  }

  const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Chat API ${res.status}: ${txt.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[];
  };
  const msg = data.choices?.[0]?.message;
  if (!msg) throw new Error("Chat API returned no message");
  return {
    message: {
      role: "assistant",
      content: msg.content ?? null,
      tool_calls: msg.tool_calls ?? [],
    },
    raw: data,
  };
}
