import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Max file size we will read (bytes) */
export const MAX_FILE_BYTES = 1024 * 1024;

/** Extensions we consider text-like and worth scanning */
export const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.markdown',
  '.txt',
  '.sh',
  '.bash',
  '.zsh',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.py',
  '.yml',
  '.yaml',
  '.toml',
  '.env',
  '.cfg',
  '.ini',
  '.ps1',
  '.bat',
  '.cmd',
  '.gitignore',
  '.npmrc',
  '.dockerignore',
]);

export function isTextFile(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot === -1) {
    // extension-less files like "CLAUDE.md" have a dot; "install" does not.
    // Allow known extension-less names.
    return false;
  }
  return TEXT_EXTENSIONS.has(path.slice(dot).toLowerCase());
}

export function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

export function readText(path: string): string | null {
  try {
    if (fileSize(path) > MAX_FILE_BYTES) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export function toPosix(p: string): string {
  return p.split(sep).join('/');
}

/** Relative POSIX path of `abs` under `root` (or the absolute path if outside). */
export function relPosix(root: string, abs: string): string {
  const r = relative(root, abs);
  return r === '' ? '.' : toPosix(r);
}

export function absJoin(root: string, rel: string): string {
  return rel === '' || rel === '.' ? root : join(root, rel);
}

/**
 * Redact a secret for display: keep a short prefix and suffix, mask the middle.
 * Never returns the full secret.
 */
export function redact(secret: string): string {
  const s = secret.trim();
  if (s.length <= 8) return s.slice(0, 2) + '****';
  const head = s.slice(0, 6);
  const tail = s.slice(-2);
  return `${head}${'*'.repeat(Math.min(10, s.length - 8))}${tail}`;
}

/** Stable short hash, used to dedupe repeated findings. */
export function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 8);
}

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.cache',
  'coverage',
  '.next',
  '.venv',
  'venv',
  '__pycache__',
]);

export interface WalkOptions {
  maxDepth?: number;
  maxFiles?: number;
}

/**
 * Walk `root` and return absolute paths of candidate text files.
 * Skips heavy/vendored directories. Never follows symlinks.
 */
export function walkFiles(root: string, opts: WalkOptions = {}): string[] {
  const maxDepth = opts.maxDepth ?? 6;
  const maxFiles = opts.maxFiles ?? 5000;
  const out: string[] = [];
  const stack: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  while (stack.length > 0 && out.length < maxFiles) {
    const { dir, depth } = stack.pop()!;
    let entries: import('node:fs').Dirent[];
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (out.length >= maxFiles) break;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (depth < maxDepth) stack.push({ dir: full, depth: depth + 1 });
      } else if (entry.isFile() && isTextFile(entry.name)) {
        if (fileSize(full) <= MAX_FILE_BYTES) out.push(full);
      }
    }
  }
  return out.sort();
}

import { readdirSync } from 'node:fs';
