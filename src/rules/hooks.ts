import type { Finding, Rule, ScanContext } from '../types.js';

interface HookEntry {
  type?: unknown;
  command?: unknown;
}

interface HooksShape {
  hooks?: Record<string, unknown>;
}

function parseJson(text: string): HooksShape | undefined {
  try {
    return JSON.parse(text) as HooksShape;
  } catch {
    return undefined;
  }
}

/** Command fragments that download and execute remote code. */
const REMOTE_EXEC: RegExp[] = [
  /\bcurl\b[^|;&]*\|\s*(?:sudo\s+)?(?:ba|z|fi)?sh\b/i,
  /\bwget\b[^|;&]*\|\s*(?:sudo\s+)?(?:ba|z|fi)?sh\b/i,
  /\bcurl\b[^|;&]*\|\s*(?:sudo\s+)?python[0-9.]*\b/i,
  /\beval\s+"?\$\(/i,
  /\bbase64\s+(?:-d|--decode)\b/i,
  /\bnc\s+-[a-z]*e\b/i,
];

/** Commands that exfiltrate data to the network. */
const EXFIL: RegExp[] = [
  /\bcurl\b[^|;&]*\s(?:-d|--data)\s*[^|;&]*\$\(/i,
  /\bnslookup\s+\$\(/i,
  /\bdig\s+\$\(/i,
];

function collectHookCommands(value: unknown, out: Array<{ event: string; command: string }>): void {
  if (!value || typeof value !== 'object') return;
  const record = value as Record<string, unknown>;
  for (const [event, matchers] of Object.entries(record)) {
    if (!Array.isArray(matchers)) continue;
    for (const matcher of matchers) {
      if (!matcher || typeof matcher !== 'object') continue;
      const hooks = (matcher as { hooks?: unknown }).hooks;
      if (!Array.isArray(hooks)) continue;
      for (const h of hooks as HookEntry[]) {
        if (h && typeof h === 'object' && typeof h.command === 'string') {
          out.push({ event, command: h.command });
        }
      }
    }
  }
}

export const hooksRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];
  const settingsFiles = ctx.files.filter((f) => /(^|\/)settings(\.local)?\.json$/.test(f));

  for (const rel of settingsFiles) {
    const text = ctx.read(rel);
    if (!text) continue;
    const settings = parseJson(text);
    if (!settings?.hooks) continue;

    const commands: Array<{ event: string; command: string }> = [];
    collectHookCommands(settings.hooks, commands);

    for (const { event, command } of commands) {
      for (const re of REMOTE_EXEC) {
        if (re.test(command)) {
          findings.push({
            rule: 'hooks.remote-code-execution',
            severity: 'high',
            title: `Hook downloads and executes remote code (${event})`,
            file: rel,
            evidence: command.length > 120 ? command.slice(0, 117) + '...' : command,
            detail:
              'A hook that pipes a remote URL into a shell runs arbitrary third-party code ' +
              'inside your agent session. If the remote host is compromised, your machine is too.',
            fix: 'Pin the script to a reviewed commit, verify a checksum, or vendor it into the repo.',
          });
          break;
        }
      }
      for (const re of EXFIL) {
        if (re.test(command)) {
          findings.push({
            rule: 'hooks.possible-exfiltration',
            severity: 'medium',
            title: `Hook may send session data to the network (${event})`,
            file: rel,
            evidence: command.length > 120 ? command.slice(0, 117) + '...' : command,
            detail: 'This hook embeds command output into a network request, a common exfiltration pattern.',
            fix: 'Review what data the hook sends; remove it unless it is essential and trusted.',
          });
          break;
        }
      }
    }
  }

  return findings;
};
