// Tool implementations — the agentic-coder core. Each tool is a plain function
// surfaced to the model as an OpenAI function-tool. All use Node built-ins so
// Ochen has ZERO runtime dependencies.
//
// Capability roadmap (add over time as discrete tools/PRs):
//   - computer_use  : screenshot + click/type via a local driver companion
//   - browser       : headless browser via Playwright/Puppeteer
//   - vision        : pass images to a multimodal blend (Pro/Ultra)
//   - skills        : SKILL.md loader + registry

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDef } from "../core/types.js";

const exec = promisify(execFile);

// Resolve a path relative to the agent's working directory, blocking escapes
// outside it (no absolute paths, no ../ past root).
function safeResolve(root: string, target: string): string {
  const full = path.isAbsolute(target) ? target : path.join(root, target);
  const rel = path.relative(root, full);
  if (rel.startsWith("..")) throw new Error(`Path escapes working dir: ${target}`);
  return full;
}

function trunc(s: string, n = 4000): string {
  return s.length > n ? s.slice(0, n) + `\n…(${s.length - n} more chars)` : s;
}

export function buildTools(root: string): ToolDef[] {
  return [
    {
      name: "read_file",
      description: "Read a file's contents (text). Returns up to ~4000 chars.",
      parameters: {
        type: "object",
        properties: { path: { type: "string", description: "File path, relative to project root" } },
        required: ["path"],
      },
      run: async (a) => {
        const p = safeResolve(root, String(a.path));
        const buf = await fs.readFile(p);
        return trunc(buf.toString("utf8"));
      },
    },
    {
      name: "write_file",
      description: "Create or overwrite a file with new content.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
        },
        required: ["path", "content"],
      },
      run: async (a) => {
        const p = safeResolve(root, String(a.path));
        await fs.mkdir(path.dirname(p), { recursive: true });
        await fs.writeFile(p, String(a.content), "utf8");
        return `Wrote ${String(a.path)} (${String(a.content).length} chars)`;
      },
    },
    {
      name: "edit_file",
      description: "Replace the first occurrence of `old` with `new` in a file (fuzzy match).",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          old: { type: "string" },
          new: { type: "string" },
        },
        required: ["path", "old", "new"],
      },
      run: async (a) => {
        const p = safeResolve(root, String(a.path));
        const text = await fs.readFile(p, "utf8");
        const oldS = String(a.old);
        const idx = text.indexOf(oldS);
        if (idx === -1) return `edit_file: 'old' not found in ${String(a.path)}`;
        const next = text.slice(0, idx) + String(a.new) + text.slice(idx + oldS.length);
        await fs.writeFile(p, next, "utf8");
        return `Edited ${String(a.path)}`;
      },
    },
    {
      name: "run_shell",
      description: "Run a shell command (non-interactive). Returns stdout+stderr, truncated.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "Command + args" },
          cwd: { type: "string", description: "Optional relative dir" },
        },
        required: ["command"],
      },
      run: async (a) => {
        const cwd = a.cwd ? safeResolve(root, String(a.cwd)) : root;
        try {
          const { stdout, stderr } = await exec("/bin/sh", ["-c", String(a.command)], {
            cwd,
            maxBuffer: 2 * 1024 * 1024,
            timeout: 120_000,
          });
          return trunc([stdout, stderr].filter(Boolean).join("\n"));
        } catch (e: any) {
          return trunc(`exit ${e.code ?? "?"}:\n${(e.stdout ?? "") + (e.stderr ?? "")}`);
        }
      },
    },
    {
      name: "grep",
      description: "Search file contents for a regex (ripgrep-like, recursive).",
      parameters: {
        type: "object",
        properties: {
          pattern: { type: "string" },
          glob: { type: "string", description: "Optional file glob, e.g. '*.ts'" },
        },
        required: ["pattern"],
      },
      run: async (a) => {
        // Portable: BSD grep (macOS) and GNU grep both support -r -n -I.
        // Exclude noisy dirs; if grep hits an unreadable socket it still prints
        // matches to stdout, so we treat partial output as success.
        const args = ["-r", "-n", "-I", "--exclude-dir=.git", "--exclude-dir=node_modules"];
        args.push("--", String(a.pattern));
        try {
          const { stdout } = await exec("grep", args, { cwd: root, maxBuffer: 4 * 1024 * 1024 });
          const lines = stdout.split("\n").filter(Boolean);
          return trunc(lines.join("\n") || "(no matches)");
        } catch (e: any) {
          // grep exits 1 = no matches (clean); 2 = error (but may have partial stdout)
          if (e.code === 1) return "(no matches)";
          const partial = (e.stdout || "").split("\n").filter(Boolean);
          if (partial.length) return trunc(partial.join("\n") + "\n…(some paths unreadable)");
          return trunc(`grep error: ${e.stderr ?? e.message}`);
        }
      },
    },
    {
      name: "git",
      description: "Run a git subcommand (status, diff, add, commit, log, etc.).",
      parameters: {
        type: "object",
        properties: { args: { type: "string", description: "git args, e.g. 'status --short'" } },
        required: ["args"],
      },
      run: async (a) => {
        const parts = String(a.args).split(/\s+/).filter(Boolean);
        try {
          const { stdout, stderr } = await exec("git", parts, { cwd: root, maxBuffer: 2 * 1024 * 1024 });
          return trunc([stdout, stderr].filter(Boolean).join("\n") || "(done)");
        } catch (e: any) {
          return trunc(`git ${String(a.args)} -> ${(e.stdout ?? "") + (e.stderr ?? "")}`);
        }
      },
    },
  ];
}
