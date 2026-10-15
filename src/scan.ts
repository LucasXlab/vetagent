import type { Finding, Rule, ScanContext, ScanResult, TargetKind } from './types.js';
import { absJoin, matchesAnyGlob, readText, relPosix, walkFiles } from './util.js';
import { secretsRule } from './rules/secrets.js';
import { permissionsRule } from './rules/permissions.js';
import { hooksRule } from './rules/hooks.js';
import { mcpRule } from './rules/mcp.js';
import { skillsRule } from './rules/skills.js';
import { hygieneRule } from './rules/hygiene.js';

export const RULES: Array<{ id: string; rule: Rule }> = [
  { id: 'secrets', rule: secretsRule },
  { id: 'permissions', rule: permissionsRule },
  { id: 'hooks', rule: hooksRule },
  { id: 'mcp', rule: mcpRule },
  { id: 'skills', rule: skillsRule },
  { id: 'hygiene', rule: hygieneRule },
];

export function makeContext(root: string, kind: TargetKind, absFiles: string[]): ScanContext {
  const rels = absFiles.map((f) => relPosix(root, f));
  const relSet = new Set(rels);
  return {
    root,
    kind,
    files: rels,
    read(rel: string): string | null {
      if (!relSet.has(rel)) return null;
      return readText(absJoin(root, rel));
    },
    exists(rel: string): boolean {
      return relSet.has(rel);
    },
    listDirs(rel: string): string[] {
      const prefix = rel === '' || rel === '.' ? '' : rel + '/';
      const dirs = new Set<string>();
      for (const r of rels) {
        if (!r.startsWith(prefix)) continue;
        const rest = r.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash > 0) dirs.add(prefix + rest.slice(0, slash));
      }
      return [...dirs];
    },
  };
}

const SEVERITY_WEIGHT: Record<Finding['severity'], number> = {
  high: 15,
  medium: 7,
  low: 2,
  info: 0,
};

export function scoreFindings(findings: Finding[]): { score: number; grade: string } {
  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHT[f.severity], 0);
  const score = Math.max(0, 100 - penalty);
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
  return { score, grade };
}

export interface ScanOptions {
  /** Roots to scan with their kind */
  targets: Array<{ root: string; kind: TargetKind }>;
  /** Glob patterns (relative POSIX paths) to skip, e.g. "test/fixtures/**" */
  exclude?: string[];
}

export function scanTargets(targets: ScanOptions['targets'], exclude: string[] = []): ScanResult {
  const started = Date.now();
  const allFindings: Finding[] = [];
  const scannedRoots: string[] = [];
  let filesScanned = 0;

  for (const target of targets) {
    const all = walkFiles(target.root);
    const absFiles = all.filter((f) => !matchesAnyGlob(relPosix(target.root, f), exclude));
    filesScanned += absFiles.length;
    scannedRoots.push(target.root);
    const ctx = makeContext(target.root, target.kind, absFiles);
    for (const { rule } of RULES) {
      try {
        allFindings.push(...rule(ctx));
      } catch {
        // A failing rule must never abort the whole scan.
      }
    }
  }

  // Dedupe identical findings (same rule+file+line+evidence)
  const seen = new Set<string>();
  const unique = allFindings.filter((f) => {
    const key = `${f.rule}|${f.file}|${f.line ?? ''}|${f.evidence ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Cross-rule dedup: when the MCP rule already reports an inline credential with
  // specific fix advice, drop the generic secrets finding for the same value.
  const mcpCredentials = unique
    .filter((f) => f.rule === 'mcp.inline-credential')
    .map((f) => `${f.file}|${f.evidence ?? ''}`);
  const findings = unique.filter((f) => {
    if (f.rule !== 'secrets.inline-credential') return true;
    const evidence = f.evidence ?? '';
    return !mcpCredentials.some((mc) => {
      const [file, redacted] = mc.split('|');
      return file === f.file && evidence.includes(redacted);
    });
  });

  const { score, grade } = scoreFindings(findings);
  return {
    findings,
    stats: {
      filesScanned,
      targets: scannedRoots,
      durationMs: Date.now() - started,
    },
    score,
    grade,
  };
}
