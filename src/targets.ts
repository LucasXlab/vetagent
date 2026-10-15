import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { TargetKind } from './types.js';

export interface ScanTarget {
  /** Absolute root path */
  root: string;
  kind: TargetKind;
  /** How this target was found, for the report */
  via: string;
}

/**
 * Well-known agent configuration homes. Order matters only for display.
 */
export function agentHomes(): ScanTarget[] {
  const home = homedir();
  const candidates: Array<{ rel: string; kind: TargetKind; via: string }> = [
    { rel: '.claude', kind: 'claude', via: 'Claude Code home' },
    { rel: '.codex', kind: 'codex', via: 'Codex CLI home' },
    { rel: '.config/opencode', kind: 'opencode', via: 'opencode home' },
    { rel: '.gemini', kind: 'gemini', via: 'Gemini CLI home' },
    { rel: '.config/hermes', kind: 'generic', via: 'Hermes agent home' },
    { rel: '.openclaw', kind: 'generic', via: 'OpenClaw home' },
  ];
  const out: ScanTarget[] = [];
  for (const c of candidates) {
    const abs = join(home, c.rel);
    if (existsSync(abs)) {
      out.push({ root: abs, kind: c.kind, via: c.via });
    }
  }
  return out;
}

/** Project-level markers, relative to a directory. */
const PROJECT_MARKERS: Array<{ rel: string; kind: TargetKind; via: string }> = [
  { rel: '.claude', kind: 'project', via: 'project .claude' },
  { rel: '.mcp.json', kind: 'project', via: 'project .mcp.json' },
  { rel: '.codex', kind: 'project', via: 'project .codex' },
  { rel: 'CLAUDE.md', kind: 'project', via: 'project CLAUDE.md' },
  { rel: 'AGENTS.md', kind: 'project', via: 'project AGENTS.md' },
];

/** Does `dir` look like it holds agent configuration? */
export function isProjectWithAgentConfig(dir: string): boolean {
  return PROJECT_MARKERS.some((m) => existsSync(join(dir, m.rel)));
}

export function projectTargets(dir: string): ScanTarget[] {
  return PROJECT_MARKERS.filter((m) => existsSync(join(dir, m.rel))).map((m) => ({
    root: join(dir, m.rel),
    kind: m.kind,
    via: m.via,
  }));
}
