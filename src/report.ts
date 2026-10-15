import type { Finding, ScanResult } from './types.js';
import { relative } from 'node:path';
import { homedir } from 'node:os';

const C = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  dim: '\u001b[2m',
  red: '\u001b[31m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  blue: '\u001b[34m',
  cyan: '\u001b[36m',
  gray: '\u001b[90m',
};

export function colorsEnabled(noColor: boolean): boolean {
  if (noColor) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function paint(text: string, color: keyof typeof C, on: boolean): string {
  return on ? C[color] + text + C.reset : text;
}

const SEV_ORDER: Array<Finding['severity']> = ['high', 'medium', 'low', 'info'];
const SEV_LABEL: Record<Finding['severity'], string> = {
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'LOW',
  info: 'INFO',
};
const SEV_COLOR: Record<Finding['severity'], keyof typeof C> = {
  high: 'red',
  medium: 'yellow',
  low: 'blue',
  info: 'gray',
};

function shortPath(file: string): string {
  const home = homedir();
  if (file.startsWith(home + '/')) return '~' + file.slice(home.length);
  const cwd = process.cwd();
  if (file.startsWith(cwd + '/')) return relative(cwd, file);
  return file;
}

function countBy(findings: Finding[]): Record<Finding['severity'], number> {
  const counts = { high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

export function renderReport(result: ScanResult, opts: { color: boolean }): string {
  const lines: string[] = [];
  const { findings } = result;
  const counts = countBy(findings);

  lines.push('');
  lines.push(paint('  agentvet', 'bold', opts.color) + paint('  — AI agent setup audit', 'dim', opts.color));
  lines.push('');
  lines.push(
    `  Score: ${paint(result.grade + ' (' + result.score + '/100)', result.score >= 75 ? 'green' : result.score >= 40 ? 'yellow' : 'red', opts.color)}` +
      `   files: ${result.stats.filesScanned}   targets: ${result.stats.targets.length}   ${result.stats.durationMs}ms`,
  );
  lines.push(
    `  Findings: ${paint(String(counts.high), 'red', opts.color)} high · ` +
      `${paint(String(counts.medium), 'yellow', opts.color)} medium · ` +
      `${paint(String(counts.low), 'blue', opts.color)} low · ` +
      `${paint(String(counts.info), 'gray', opts.color)} info`,
  );
  lines.push('');

  if (findings.length === 0) {
    lines.push(paint('  No issues found. Your agent setup looks clean.', 'green', opts.color));
    lines.push('');
    return lines.join('\n');
  }

  for (const sev of SEV_ORDER) {
    const group = findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    lines.push(paint(`  ${SEV_LABEL[sev]} (${group.length})`, SEV_COLOR[sev], opts.color));
    lines.push('');
    for (const f of group) {
      const loc = f.line ? `${shortPath(f.file)}:${f.line}` : shortPath(f.file);
      lines.push(`  ${paint('▸', SEV_COLOR[sev], opts.color)} ${f.title}`);
      lines.push(paint(`    ${loc}`, 'dim', opts.color));
      if (f.evidence) lines.push(paint(`    evidence: ${f.evidence}`, 'gray', opts.color));
      lines.push(`    why: ${f.detail}`);
      lines.push(paint(`    fix: ${f.fix}`, 'cyan', opts.color));
      lines.push('');
    }
  }

  if (counts.high > 0) {
    lines.push(
      paint(`  ⚠ ${counts.high} high-severity finding(s). Rotate any exposed credentials now.`, 'red', opts.color),
    );
    lines.push('');
  }

  return lines.join('\n');
}

export function toJson(result: ScanResult): string {
  return JSON.stringify(
    {
      tool: 'agentvet',
      version: 1,
      score: result.score,
      grade: result.grade,
      stats: result.stats,
      findings: result.findings,
    },
    null,
    2,
  );
}
