/**
 * Secret patterns for known API key / token formats.
 * Each pattern is applied line-by-line. Matches are redacted before display.
 */
export interface SecretPattern {
  id: string;
  label: string;
  severity: 'high' | 'medium';
  re: RegExp;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  { id: 'anthropic-key', label: 'Anthropic API key', severity: 'high', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: 'openrouter-key', label: 'OpenRouter API key', severity: 'high', re: /\bsk-or-v1-[A-Za-z0-9]{20,}/g },
  { id: 'github-token', label: 'GitHub token', severity: 'high', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}/g },
  { id: 'github-pat', label: 'GitHub fine-grained PAT', severity: 'high', re: /\bgithub_pat_[A-Za-z0-9_]{20,}/g },
  { id: 'aws-access-key', label: 'AWS access key id', severity: 'high', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { id: 'slack-token', label: 'Slack token', severity: 'medium', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { id: 'google-api-key', label: 'Google API key', severity: 'medium', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'openrouter-key', label: 'OpenRouter API key', severity: 'high', re: /\bsk-or-v1-[A-Za-z0-9]{20,}/g },
  { id: 'npm-token', label: 'npm access token', severity: 'high', re: /\bnpm_[A-Za-z0-9]{30,}/g },
  { id: 'gitlab-pat', label: 'GitLab personal access token', severity: 'medium', re: /\bglpat-[A-Za-z0-9_-]{20,}/g },
  { id: 'stripe-key', label: 'Stripe API key', severity: 'high', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/g },
  { id: 'private-key', label: 'Private key block', severity: 'high', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { id: 'deepseek-key', label: 'DeepSeek API key', severity: 'high', re: /\bsk-[0-9a-f]{32}\b/g },
  { id: 'openai-key', label: 'OpenAI API key', severity: 'high', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { id: 'generic-bearer', label: 'Hardcoded bearer token', severity: 'medium', re: /["']?authorization["']?\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._-]{16,}/gi },
];

/** Keys whose values in JSON configs commonly hold credentials. */
export const SECRET_JSON_KEYS = [
  'apiKey',
  'api_key',
  'apiToken',
  'api_token',
  'token',
  'accessToken',
  'access_token',
  'secret',
  'secretKey',
  'password',
  'authToken',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
];

/** Case-insensitive membership test for credential-ish JSON keys. */
export function isCredentialKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SECRET_JSON_KEYS.some((k) => k.toLowerCase() === lower);
}
export function looksLikeCredential(value: string): boolean {
  const v = value.trim();
  if (v.length < 12) return false;
  if (/^\$\{?[A-Z0-9_]+\}?$/.test(v)) return false; // env var reference
  if (/^(your|my|the)[-_ ]/i.test(v)) return false;
  if (/^(xxx|todo|changeme|placeholder|redacted|\*+)$/i.test(v)) return false;
  if (/^[<\[(]/.test(v)) return false;
  // High-entropy-ish: mix of letters and digits, no spaces
  if (!/^[A-Za-z0-9._\-+/=]{12,}$/.test(v)) return false;
  const hasDigit = /[0-9]/.test(v);
  const hasAlpha = /[A-Za-z]/.test(v);
  return hasDigit && hasAlpha;
}
