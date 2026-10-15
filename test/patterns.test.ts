import { describe, expect, it } from 'vitest';
import { SECRET_PATTERNS, looksLikeCredential } from '../src/patterns.js';
import { redact } from '../src/util.js';

function findSecret(line: string): string | null {
  for (const p of SECRET_PATTERNS) {
    p.re.lastIndex = 0;
    const m = p.re.exec(line);
    if (m) return p.id;
  }
  return null;
}

describe('SECRET_PATTERNS', () => {
  it('detects known key formats', () => {
    expect(findSecret('ANTHROPIC_API_KEY=sk-ant-api03-ABCDEFGHIJKLMNOPQRST')).toBe('anthropic-key');
    expect(findSecret('token: ghp_abcdefghijklmnopqrst')).toBe('github-token');
    expect(findSecret('aws_key = AKIAIOSFODNN7EXAMPLE')).toBe('aws-access-key');
    expect(findSecret('OPENROUTER=sk-or-v1-abcdefghijklmnopqrstuvwx')).toBe('openrouter-key');
  });

  it('does not fire on ordinary text', () => {
    expect(findSecret('const greeting = "hello world";')).toBeNull();
    expect(findSecret('# TODO: rotate keys before release')).toBeNull();
  });
});

describe('looksLikeCredential', () => {
  it('accepts high-entropy strings', () => {
    expect(looksLikeCredential('sk-proj-abcd1234efgh5678')).toBe(true);
  });

  it('rejects env var references and placeholders', () => {
    expect(looksLikeCredential('${OPENAI_API_KEY}')).toBe(false);
    expect(looksLikeCredential('$OPENAI_API_KEY')).toBe(false);
    expect(looksLikeCredential('your-api-key-here')).toBe(false);
    expect(looksLikeCredential('changeme')).toBe(false);
    expect(looksLikeCredential('short')).toBe(false);
  });
});

describe('redact', () => {
  it('masks the middle of long secrets', () => {
    const r = redact('sk-ant-api03-AAAABBBBCCCCDDDDEEEE');
    expect(r.startsWith('sk-ant')).toBe(true);
    expect(r.endsWith('EE')).toBe(true);
    expect(r).not.toContain('AAAABBBBCCCC');
    expect(r).toContain('*');
  });

  it('never returns the full input for long secrets', () => {
    const s = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';
    expect(redact(s)).not.toBe(s);
  });
});
