import type { Finding, Rule, ScanContext } from '../types.js';

interface SettingsShape {
  permissions?: {
    allow?: unknown;
    deny?: unknown;
    defaultMode?: unknown;
    additionalDirectories?: unknown;
  };
  [key: string]: unknown;
}

function parseSettings(text: string): SettingsShape | undefined {
  try {
    return JSON.parse(text) as SettingsShape;
  } catch {
    return undefined;
  }
}

/** Permission patterns that are effectively unrestricted. */
const DANGEROUS_PERMISSIONS: Array<{ re: RegExp; why: string }> = [
  { re: /^Bash\(\*\)$/i, why: 'allows every shell command with no confirmation' },
  // Single-token command wildcards only, e.g. "Bash(curl:*)" — "Bash(git status:*)" is fine.
  { re: /^Bash\([a-zA-Z0-9_.-]+:\*\)$/i, why: 'allows every subcommand of a tool family' },
  { re: /^Bash\((?:rm|sudo|dd|mkfs|chmod|chown|curl|wget|nc|ssh)\b/i, why: 'grants a destructive or network-capable command' },
  { re: /^\*$/, why: 'matches every tool' },
  { re: /^mcp__\*$/i, why: 'allows every MCP server tool' },
  { re: /^WebFetch\(\*\)$/i, why: 'allows fetching any URL' },
];

const RISKY_DEFAULT_MODES: Record<string, string> = {
  bypassPermissions: 'runs every tool call without asking, including shell commands',
  acceptEdits: 'auto-accepts all file edits without review',
};

export const permissionsRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];
  const settingsFiles = ctx.files.filter((f) =>
    /(^|\/)settings(\.local)?\.json$/.test(f),
  );

  for (const rel of settingsFiles) {
    const text = ctx.read(rel);
    if (!text) continue;
    const settings = parseSettings(text);
    if (!settings) {
      findings.push({
        rule: 'permissions.invalid-json',
        severity: 'low',
        title: 'settings.json is not valid JSON',
        file: rel,
        detail: 'The file could not be parsed, so its permissions could not be verified.',
        fix: 'Fix the JSON syntax (a trailing comma is the usual culprit).',
      });
      continue;
    }

    const perms = settings.permissions;
    if (perms && Array.isArray(perms.allow)) {
      for (const entry of perms.allow) {
        if (typeof entry !== 'string') continue;
        for (const d of DANGEROUS_PERMISSIONS) {
          if (d.re.test(entry)) {
            findings.push({
              rule: 'permissions.overly-broad',
              severity: 'high',
              title: `Overly broad permission: ${entry}`,
              file: rel,
              evidence: entry,
              detail: `This permission ${d.why}.`,
              fix: 'Replace with the narrowest pattern that covers your workflow, e.g. Bash(git status:*).',
            });
            break;
          }
        }
      }
      if ((perms.allow as unknown[]).length > 40) {
        findings.push({
          rule: 'permissions.too-many',
          severity: 'low',
          title: `Large allow-list (${(perms.allow as unknown[]).length} entries)`,
          file: rel,
          detail: 'Very large allow-lists usually accumulate stale entries and widen the attack surface over time.',
          fix: 'Prune entries you no longer use; prefer project-local settings over global.',
        });
      }
    }

    if (perms && typeof perms.defaultMode === 'string' && RISKY_DEFAULT_MODES[perms.defaultMode]) {
      findings.push({
        rule: 'permissions.risky-default-mode',
        severity: 'medium',
        title: `Risky default permission mode: ${perms.defaultMode}`,
        file: rel,
        evidence: String(perms.defaultMode),
        detail: `This mode ${RISKY_DEFAULT_MODES[perms.defaultMode]}.`,
        fix: 'Use the default interactive mode, or scope bypassPermissions to a throwaway container.',
      });
    }
  }

  return findings;
};
