import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { scanTargets, makeContext, scoreFindings } from '../src/scan.js';
import { walkFiles } from '../src/util.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(here, 'fixtures', name);

describe('scanTargets on the claude-home fixture', () => {
  const result = scanTargets([{ root: fixture('claude-home'), kind: 'claude' }]);
  const rules = result.findings.map((f) => f.rule);

  it('finds inline credentials', () => {
    expect(rules).toContain('secrets.inline-credential');
    expect(rules).toContain('secrets.anthropic-key');
  });

  it('never leaks the full secret in evidence', () => {
    const withEvidence = result.findings.filter((f) => f.evidence);
    expect(withEvidence.length).toBeGreaterThan(0);
    for (const f of withEvidence) {
      expect(f.evidence).not.toContain('AAAABBBBCCCCDDDDEEEEFFFF1234');
      expect(f.evidence).not.toContain('abcd1234efgh5678ijkl');
    }
  });

  it('flags overly broad permissions', () => {
    const broad = result.findings.filter((f) => f.rule === 'permissions.overly-broad');
    const entries = broad.map((f) => f.evidence);
    expect(entries).toContain('Bash(*)');
    expect(entries).toContain('mcp__*');
    expect(entries).toContain('Bash(curl:*)');
  });

  it('flags risky default mode', () => {
    expect(rules).toContain('permissions.risky-default-mode');
  });

  it('flags remote code execution hooks', () => {
    expect(rules).toContain('hooks.remote-code-execution');
  });

  it('flags unpinned, remote and plaintext MCP servers', () => {
    expect(rules).toContain('mcp.unpinned-package');
    expect(rules).toContain('mcp.remote-transport');
    expect(rules).toContain('mcp.insecure-transport');
    expect(rules).toContain('mcp.inline-credential');
  });

  it('does not flag the pinned local MCP server', () => {
    const unpinned = result.findings.filter((f) => f.rule === 'mcp.unpinned-package');
    expect(unpinned.every((f) => !f.evidence?.includes('server-everything'))).toBe(true);
  });

  it('flags the malicious skill but not the clean one', () => {
    expect(rules).toContain('skills.injection-pattern');
    expect(rules).toContain('skills.network-access');
    const injection = result.findings.filter((f) => f.rule === 'skills.injection-pattern');
    expect(injection.every((f) => f.file.includes('evil-skill'))).toBe(true);
  });

  it('produces a failing grade for the bad fixture', () => {
    expect(result.score).toBeLessThan(60);
    expect(['D', 'F']).toContain(result.grade);
  });
});

describe('scanTargets on the project fixture', () => {
  const result = scanTargets([{ root: fixture('project'), kind: 'project' }]);
  const rules = result.findings.map((f) => f.rule);

  it('flags .env not covered by .gitignore', () => {
    expect(rules).toContain('hygiene.env-not-ignored');
  });

  it('does not flag the pinned scoped MCP server as unpinned', () => {
    expect(rules).not.toContain('mcp.unpinned-package');
  });

  it('scores a mostly-clean project above the bad home', () => {
    expect(result.score).toBeGreaterThan(60);
  });
});

describe('makeContext', () => {
  const root = fixture('claude-home');
  const files = walkFiles(root);
  const ctx = makeContext(root, 'claude', files);

  it('exposes relative posix paths', () => {
    expect(ctx.files).toContain('settings.json');
    expect(ctx.files.some((f) => f.endsWith('SKILL.md'))).toBe(true);
  });

  it('reads existing files and returns null for missing ones', () => {
    expect(ctx.read('settings.json')).toContain('permissions');
    expect(ctx.read('does-not-exist.json')).toBeNull();
  });
});

describe('scoreFindings', () => {
  it('gives 100/A for no findings', () => {
    expect(scoreFindings([])).toEqual({ score: 100, grade: 'A' });
  });

  it('drops one grade band per high finding', () => {
    const one = scoreFindings([
      { rule: 'x', severity: 'high', title: '', file: '', detail: '', fix: '' },
    ]);
    expect(one.score).toBe(85);
    expect(one.grade).toBe('B');
  });

  it('floors at 0', () => {
    const many = scoreFindings(
      Array.from({ length: 20 }, () => ({
        rule: 'x',
        severity: 'high' as const,
        title: '',
        file: '',
        detail: '',
        fix: '',
      })),
    );
    expect(many.score).toBe(0);
    expect(many.grade).toBe('F');
  });
});
