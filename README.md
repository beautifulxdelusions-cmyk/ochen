# Ochen

**An open-source terminal agent** — the agentic-coder sibling of Trismegistus AI.

Ochen is a terminal coding agent that plans and acts: it reads, writes, edits, and
searches files, runs shell commands, and uses git. Same manner as Claude Code /
Codex CLI / Hermes-terminal, built in the open (MIT) so you own it.

It routes through **any OpenAI-compatible `/chat/completions` endpoint** — by default
your **Trismegistus AI** blend:

| Tier      | Slug          | Notes                                  |
|-----------|---------------|----------------------------------------|
| Free      | `base-intel`  | 3 free LLMs, rate-capped server-side   |
| Pro       | `pro`         | paid mid blend                         |
| Ultra     | `ultra`       | paid premium blend                     |

## Install

```bash
git clone https://github.com/beautifulxdelusions-cmyk/ochen
cd ochen
pnpm install
pnpm build
```

## Configure

```bash
export OCHEN_API_KEY=tk_xxx        # your Trismegistus key (or any OpenAI-compat key)
export OCHEN_MODEL=base-intel      # blend/entity slug, or a raw model like gpt-4o
export OCHEN_BASE_URL=https://trismegistus.app/api/v1   # optional
export OCHEN_ROOT=/path/to/project # optional, defaults to cwd
```

No key? Point `OCHEN_BASE_URL` at any local OpenAI-compatible server (Ollama, etc.).

## Use

```bash
ochen "add a typescript linter to this project and wire it into the build"
ochen -v "refactor src/ into modules and run the tests"   # verbose tool trace
```

## Architecture

```
src/
  index.ts        CLI entrypoint + config resolution
  core/
    types.ts      shared types
    api.ts        OpenAI-compatible chat client (zero deps)
    agent.ts      the planner → tool → observe loop
  tools/
    index.ts      file/shell/grep/git tools (Node built-ins only)
```

Zero runtime dependencies. The model drives tools via the OpenAI function-tool
schema.

## Roadmap (add as discrete tools/PRs — all ours, all OSS)

- `computer_use` — screenshot + click/type via a local driver companion
- `browser` — headless browser (Playwright/Puppeteer)
- `vision` — pass images to a multimodal blend (Pro/Ultra)
- `skills` — SKILL.md loader + registry

Trismegistus AI is the hosted blend backend. Ochen is the free, open client.

## License

MIT
