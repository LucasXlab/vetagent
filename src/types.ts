export type Severity = 'high' | 'medium' | 'low' | 'info';

export type TargetKind =
  | 'claude'
  | 'codex'
  | 'opencode'
  | 'gemini'
  | 'project'
  | 'generic';

export interface Finding {
  /** Stable rule id, e.g. "secrets.anthropic-key" */
  rule: string;
  severity: Severity;
  /** Short one-line title */
  title: string;
  /** Absolute path of the file the finding belongs to */
  file: string;
  /** 1-based line number when known */
  line?: number;
  /** Redacted evidence (never contains a full secret) */
  evidence?: string;
  /** Why this matters */
  detail: string;
  /** Concrete fix suggestion */
  fix: string;
}

export interface ScanContext {
  /** Absolute path of the scanned root (agent home or project dir) */
  root: string;
  kind: TargetKind;
  /** Relative POSIX paths of candidate files under root */
  files: string[];
  /** Read a file as utf8, or null if missing/unreadable */
  read(rel: string): string | null;
  /** Does a relative path exist? */
  exists(rel: string): boolean;
  /** List immediate subdirectories of a relative path (or root when rel === '') */
  listDirs(rel: string): string[];
}

export type Rule = (ctx: ScanContext) => Finding[];

export interface ScanStats {
  filesScanned: number;
  targets: string[];
  durationMs: number;
}

export interface ScanResult {
  findings: Finding[];
  stats: ScanStats;
  /** 0-100, 100 = clean */
  score: number;
  grade: string;
}
