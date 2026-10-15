import type { Finding, Rule, ScanContext } from '../types.js';
import { SECRET_PATTERNS, isCredentialKey, looksLikeCredential } from '../patterns.js';
import { redact } from '../util.js';

function tryParseJson(text: string): unknown | undefined {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/** Walk a parsed JSON structure, reporting credential-looking values at known keys. */
function scanJsonForCredentials(
  value: unknown,
  path: string,
  file: string,
  out: Finding[],
  seen: Set<string>,
  alreadyReported: Set<string> = new Set(),
): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanJsonForCredentials(v, `${path}[${i}]`, file, out, seen, alreadyReported));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${k}` : k;
      if (typeof v === 'string' && isCredentialKey(k) && looksLikeCredential(v)) {
        if (alreadyReported.has(v)) continue;
        const id = `${file}:${keyPath}:${v.slice(0, 4)}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            rule: 'secrets.inline-credential',
            severity: 'high',
            title: `Inline credential at "${keyPath}"`,
            file,
            evidence: `${k}: "${redact(v)}"`,
            detail:
              'A credential is stored in plaintext inside a config file. ' +
              'Config files are frequently committed to git or shared in screenshots.',
            fix: `Move the value to an environment variable and reference it as "${k}: "\${${k.toUpperCase()}}"".`,
          });
        }
      } else {
        scanJsonForCredentials(v, keyPath, file, out, seen);
      }
    }
  }
}

export const secretsRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  /** Values already reported by pattern matching, per file, to avoid double-reporting. */
  const reportedValues = new Map<string, Set<string>>();

  const noteValue = (file: string, value: string): boolean => {
    let set = reportedValues.get(file);
    if (!set) {
      set = new Set();
      reportedValues.set(file, set);
    }
    if (set.has(value)) return false;
    set.add(value);
    return true;
  };

  for (const rel of ctx.files) {
    const text = ctx.read(rel);
    if (!text) continue;
    const file = rel;

    // Line-based pattern scan (skip .env.example style placeholders)
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const p of SECRET_PATTERNS) {
        p.re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = p.re.exec(line)) !== null) {
          const matched = m[0];
          // Ignore obvious placeholders
          if (/^(sk-ant-)?(xxx|your|example)/i.test(matched)) continue;
          const id = `${file}:${i + 1}:${matched.slice(0, 8)}`;
          if (seen.has(id)) continue;
          seen.add(id);
          noteValue(file, matched);
          findings.push({
            rule: `secrets.${p.id}`,
            severity: p.severity,
            title: `${p.label} found in plaintext`,
            file,
            line: i + 1,
            evidence: redact(matched),
            detail:
              'This looks like a live credential. Anyone with read access to this file ' +
              '(or a screenshot of it) can use it.',
            fix: 'Rotate the key now, then store it in an environment variable or a secret manager.',
          });
        }
      }
    }

    // JSON credential values (skip values already caught by pattern matching)
    if (rel.endsWith('.json')) {
      const parsed = tryParseJson(text);
      if (parsed !== undefined) {
        const alreadyReported = reportedValues.get(file) ?? new Set<string>();
        scanJsonForCredentials(parsed, '', file, findings, seen, alreadyReported);
      }
    }
  }

  return findings;
};
