# Contributing to agentvet

Thanks for helping make agent configuration safer. This project is intentionally small and dependency-free at runtime — please keep it that way.

## Ground rules

- **Runtime has zero dependencies.** Only Node built-ins. Dev dependencies (typescript, vitest, @resvg/resvg-js) are fine.
- **Every finding needs three things**: a `title`, a `detail` (why it matters), and a `fix` (what to do). If you can't write the fix, it's probably an `info` finding, not a rule.
- **Never print full secrets.** Use `redact()` from `src/util.ts`.
- **Rules never throw.** A failing rule must not abort the scan (the orchestrator catches, but please don't rely on it).
- **Read-only.** agentvet must never write to scanned directories.

## Adding a rule

1. Create `src/rules/<name>.ts` exporting a `Rule` (`(ctx: ScanContext) => Finding[]`).
2. Register it in `src/scan.ts` (`RULES`).
3. Add a fixture under `test/fixtures/` with at least one positive and one negative case.
4. Add tests in `test/`. Run `npm test`.

Rule IDs are stable API (`secrets.anthropic-key`, `mcp.unpinned-package`, …) — don't rename existing ones.

## Development

```bash
npm install
npm test           # vitest
npm run build      # tsc
npm run typecheck  # tsc --noEmit
```

Try changes against the demo fixture:

```bash
node dist/cli.js --path demo/fixtures
```

## Reporting security issues

If you find a vulnerability in agentvet itself, please open a public issue — the project is local-only and read-only, so there is very little attack surface. Still, we appreciate the heads-up.

## Pull requests

- Keep PRs focused; one rule or one fix per PR.
- Include the test output in the description.
- New rules: add a row to the README "What it checks" table.
