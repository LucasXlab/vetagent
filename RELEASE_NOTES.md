# vetagent v1.0.0 — "the npm audit your agent setup never had"

First public release. One command to audit the configuration layer your AI
coding agents actually execute — `~/.claude`, `~/.codex`, `~/.config/opencode`,
project-level `.claude/`, `.mcp.json`, `CLAUDE.md` / `AGENTS.md`, and skills.

## Install

```bash
npx vetagent            # zero-install, Node 18+
npm install -g vetagent # or global
```

## What it checks

| Area | Examples |
|------|----------|
| Secrets | `sk-ant-…`, `ghp_…`, `AKIA…`, OpenRouter/DeepSeek/npm keys, private key blocks, credentials pasted into `settings.json` or MCP `env` |
| Permissions | `Bash(*)`, `mcp__*`, `Bash(curl:*)`, `defaultMode: bypassPermissions`, 40+ entry allow-lists |
| Hooks | `curl … \| sh` in SessionStart/Stop hooks, command substitution piped to `nc`, exfiltration patterns |
| MCP servers | unpinned `npx`/`uvx` packages, remote `http://` transports, `-y` auto-installs, inline credentials |
| Skills | instruction-override language, network instructions, oversized skills, 15+ skill hoarding |
| Hygiene | `.env` not in `.gitignore`, 30k-char `CLAUDE.md`, settings that may be committed |

Every finding carries the file, the line, **redacted** evidence, why it
matters, and a concrete fix.

## Features

- **Graded report** — score A–F with per-severity counts; a leaked live
  credential is an emergency (15 points), not a style nit.
- **CI-ready** — exit `0` clean, `1` high-severity findings (`--strict` also
  fails on medium), `2` usage error; `--json` for dashboards.
- **Scannable targets** — `--path` for any repo/CI workspace, repeatable
  `--exclude` globs.
- **Read-only, zero network, zero telemetry** — ~1,500 lines of
  dependency-free TypeScript you can read before you run it.
- 33 tests (`npm test`), CI on push/PR.

## Not in v1.0.0 (roadmap)

`--baseline` to pin accepted findings, `vetagent fix` auto-remediation, more
agent platforms as community rules, `--format sarif`, token-cost summary.

## Known limitations

Rule-based and deliberately conservative — it prefers false negatives over
false positives. It is a hygiene and exposure audit, not a malware scanner,
not a code linter, and not a replacement for your model provider's safety
systems.

Feedback welcome — especially agent configs that *should* have been flagged
but weren't. Good first issues are labeled
[`good first issue`](https://github.com/LucasYanzy/vetagent/labels/good%20first%20issue).
