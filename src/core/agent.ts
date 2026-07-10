// The agentic loop. Mirrors the architecture of Claude Code / Codex CLI /
// Hermes-terminal: prompt -> plan -> tool calls -> observe -> repeat, until the
// model emits a final answer or the step budget is hit.
//
// Ochen is the *open* terminal sibling: same manner, our own code, routes
// through Trismegistus AI blends or any OpenAI-compatible endpoint.

import type { ChatMessage, ModelConfig, ToolDef, ToolCall } from "./types.js";
import { chat } from "./api.js";

const SYSTEM = `You are Ochen, an open-source terminal coding agent.
You help the user by reading, writing, editing, and searching files; running
shell commands; and using git. Work step by step. Prefer small, verifiable
changes. After gathering what you need, call tools to make the change, then
summarize. When the task is fully done, reply with a final message (no tool
call). Never invent file contents — read before editing. Stay inside the
project directory.`;

export interface RunOptions {
  maxSteps?: number;
  verbose?: boolean;
}

export async function runAgent(
  cfg: ModelConfig,
  userPrompt: string,
  tools: ToolDef[],
  opts: RunOptions = {},
): Promise<string> {
  const maxSteps = opts.maxSteps ?? 25;
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userPrompt },
  ];

  for (let step = 0; step < maxSteps; step++) {
    const { message } = await chat(cfg, messages, tools, { temperature: 0.2 });
    messages.push(message);

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? "(no response)";
    }

    for (const call of message.tool_calls as ToolCall[]) {
      const fn = tools.find((t) => t.name === call.function.name);
      let result: string;
      if (!fn) {
        result = `Unknown tool: ${call.function.name}`;
      } else {
        try {
          const args = JSON.parse(call.function.arguments || "{}");
          result = await fn.run(args);
        } catch (e) {
          result = `Tool error: ${(e as Error).message}`;
        }
      }
      if (opts.verbose) {
        console.error(`  · ${call.function.name}(${call.function.arguments}) -> ${result.slice(0, 120)}`);
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        name: call.function.name,
        content: result,
      });
    }
  }
  return "(reached step limit — task may be incomplete)";
}
