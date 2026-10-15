# agentvet

**Vet your AI coding agent setup in one command.** agentvet audits the config behind Claude Code, Codex and friends — leaked API keys, `Bash(*)` permissions, hooks that pipe the internet into your shell, unpinned MCP servers, and skills with instruction-override language — then tells you exactly what to fix.

<p align="center">
  <img src="docs/demo.gif" alt="agentvet scanning a sloppy .claude directory: score F, 3 high-severity findings, each with a fix" width="760" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/agentvet"><img src="https://img.shields.io/npm/v/agentvet" alt="npm"></a>
  <a href="https://github.com/LucasYanzy/agentvet/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/LucasYanzy/agentvet/ci.yml?branch=main&label=ci" alt="CI"></a>
  <img src="https://img.shields.io/badge/tests-23%20passing-brightgreen" alt="tests">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"></a>
  <img src="https://img.shields.io/badge/network-zero%20requests-gray" alt="no network">
</p>

```bash
npx agentvet
```

That's the whole setup. agentvet finds your agent homes (`~/.claude`, `~/.codex`, `~/.config/opencode`, …) and the current project, scans them read-only, and prints a graded report. Exit code `1` on high-severity findings, so it drops straight into CI.

---

## What it checks

| Area | Examples of what it finds |
|------|---------------------------|
| 🔑 **Secrets** | `sk-ant-…`, `ghp_…`, `AKIA…`, OpenRouter/DeepSeek/npm keys, private key blocks, credentials pasted into `settings.json` or MCP `env` |
| 🛡️ **Permissions** | `Bash(*)`, `mcp__*`, `Bash(curl:*)`, `defaultMode: bypassPermissions`, 40+ entry allow-lists |
| 🪝 **Hooks** | `curl … \| sh` in SessionStart/Stop hooks, command substitution piped to `nc`, possible exfiltration patterns |
| 🔌 **MCP servers** | unpinned `npx`/`uvx` packages, remote `http://` transports, `-y` auto-installs, inline credentials |
| 📦 **Skills** | instruction-override language ("ignore all previous instructions"), network instructions, oversized skills, 15+ skill hoarding |
| 🧹 **Hygiene** | `.env` not in `.gitignore`, 30k-char `CLAUDE.md`, settings that may be committed |

Every finding carries the file, the line, **redacted** evidence, why it matters, and a concrete fix.

## Install & use

```bash
# Zero-install (any Node 18+):
npx agentvet

# Or install globally:
npm install -g agentvet

# Scan a specific directory (a repo, a copied .claude, a CI workspace):
agentvet --path ./my-project

# Skip paths (repeatable glob):
agentvet --path ./my-project --exclude "vendor/**" --exclude "third_party/.claude"

# Machine-readable output for CI / dashboards:
agentvet --json

# Fail the build on medium findings too:
agentvet --strict
```

Exit codes: `0` clean, `1` high-severity findings (or medium with `--strict`), `2` usage error.

## How it compares

| | agentvet | gitleaks / trufflehog | vendor "security review" skills | manual review |
|---|:---:|:---:|:---:|:---:|
| Understands agent config semantics (`settings.json`, `.mcp.json`, skills, hooks) | ✅ | ❌ generic | ⚠️ code only | ⚠️ you |
| One command, zero config, read-only | ✅ | ⚠️ needs rules/repo | ✅ | ❌ |
| Graded score + per-finding fix | ✅ | ⚠️ raw findings | ❌ | ❌ |
| CI gate (exit codes, `--json`) | ✅ | ✅ | ❌ | ❌ |
| 100% local — no network, no telemetry, no account | ✅ | ✅ | ⚠️ model calls | ✅ |
| Finds `Bash(*)`-style permission blowouts | ✅ | ❌ | ❌ | ⚠️ |

agentvet is **not** a malware scanner, not a replacement for your model provider's safety systems, and not a code linter. It is a hygiene and exposure audit for the configuration layer that agents actually execute.

## FAQ

**Is it safe to run? Does anything leave my machine?**
agentvet is read-only and makes zero network requests. There is no telemetry, no account, no phone-home. The source is ~1,500 lines of dependency-free TypeScript — read it before you run it, that's the point.

**It flagged something that is intentional.**
Pass `--path` to scope scans, edit your config, or (for a known-acceptable case) just acknowledge it — agentvet never modifies files. A future `--baseline` flag will let you pin accepted findings (see roadmap).

**Why is my score F with only 3 findings?**
High-severity findings cost 15 points each. A leaked live credential is an emergency, not a style nit.

**Which agents are supported?**
Claude Code, Codex CLI, opencode, Gemini CLI, Hermes, OpenClaw homes, plus project-level `.claude/`, `.mcp.json`, `CLAUDE.md` / `AGENTS.md`. More platforms are rules, not rewrites — PRs welcome.

**Does it work on Windows?**
Yes — everything is plain file parsing.

**Why did you build this?**
Agent configs became the new `.env`: keys, shell permissions and third-party skill packs that execute on your machine — with none of the review that infrastructure used to get. agentvet is the `npm audit` that layer never had.

## Roadmap

- [ ] `--baseline` to pin accepted findings
- [ ] `agentvet fix` for auto-remediable findings (gitignore, unpinned→pinned suggestions)
- [ ] More agent platforms (Cline, Aider, Crush) as community rules
- [ ] `--format sarif` for GitHub code scanning
- [ ] Token-cost summary from local session logs (opt-in)

## Development

```bash
npm install
npm test        # 23 tests, no network
npm run build   # tsc → dist/
node dist/cli.js --path demo/fixtures
```

See [CONTRIBUTING.md](CONTRIBUTING.md). Good first issues are labeled [`good first issue`](https://github.com/LucasYanzy/agentvet/labels/good%20first%20issue).

## License

MIT © agentvet contributors
