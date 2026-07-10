#!/usr/bin/env node
// Ochen CLI entrypoint. Resolves config, reads the task (arg or editor), runs
// the agent, prints the result.
//
// Config precedence (env): OCHEN_BASE_URL, OCHEN_API_KEY, OCHEN_MODEL
//   defaults point at Trismegistus AI (your blend) with the free Base Intel
//   tier when OCHEN_API_KEY is set, else an OPENAI-compatible local endpoint.
//
//   Free users route through Base Intel (3 free LLMs, rate-capped server-side).
//   Pro / Ultra = paid blend slugs you pass as OCHEN_MODEL.

import * as os from "node:os";
import * as path from "node:path";
import { runAgent } from "./core/agent.js";
import { buildTools } from "./tools/index.js";
import type { ModelConfig } from "./core/types.js";

function resolveConfig(): ModelConfig {
  const baseUrl =
    process.env.OCHEN_BASE_URL ||
    (process.env.OCHEN_API_KEY ? "https://trismegistus.app/api/v1" : "http://localhost:11434/v1");
  const apiKey = process.env.OCHEN_API_KEY || "ochen-local";
  const model = process.env.OCHEN_MODEL || (process.env.OCHEN_API_KEY ? "base-intel" : "local");
  return { baseUrl, apiKey, model };
}

function banner(cfg: ModelConfig) {
  console.error(`Ochen · ${cfg.model} @ ${cfg.baseUrl}`);
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("-v") || args.includes("--verbose");
  const taskArgs = args.filter((a) => !a.startsWith("-"));
  const task = taskArgs.join(" ").trim();

  if (!task) {
    console.error("Usage: ochen \"<task>\"   (or pipe via stdin)");
    process.exit(1);
  }

  const root = process.env.OCHEN_ROOT || process.cwd();
  const cfg = resolveConfig();
  const tools = buildTools(root);

  banner(cfg);
  const answer = await runAgent(cfg, task, tools, { verbose });
  console.log("\n" + answer + "\n");
}

main().catch((e) => {
  console.error("Ochen failed:", (e as Error).message);
  process.exit(1);
});
