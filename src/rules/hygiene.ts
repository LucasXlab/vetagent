import type { Finding, Rule, ScanContext } from '../types.js';

const LARGE_DOC_BYTES = 20 * 1024;

export const hygieneRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];

  // .env committed without gitignore coverage (project scans)
  if (ctx.exists('.env') && !ctx.exists('.env.example')) {
    findings.push({
      rule: 'hygiene.env-without-example',
      severity: 'low',
      title: '.env present without .env.example',
      file: ctx.root + '/.env',
      detail: 'Without an example file, teammates (and agents) tend to copy the real .env around.',
      fix: 'Add a .env.example with placeholder values.',
    });
  }

  if (ctx.exists('.env')) {
    const gi = ctx.read('.gitignore');
    if (gi !== null && !/(^|\n)\s*\.env\s*($|\n)/.test(gi)) {
      findings.push({
        rule: 'hygiene.env-not-ignored',
        severity: 'high',
        title: '.env is not covered by .gitignore',
        file: ctx.root + '/.gitignore',
        detail:
          'A .env file in a directory whose .gitignore does not list it is one ' +
          '"git add ." away from leaking every credential it holds.',
        fix: 'Add ".env" to .gitignore.',
      });
    }
  }

  // Oversized instruction files burn context on every run
  for (const rel of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) {
    if (!ctx.exists(rel)) continue;
    const text = ctx.read(rel);
    if (text && text.length > LARGE_DOC_BYTES) {
      findings.push({
        rule: 'hygiene.oversized-instructions',
        severity: 'low',
        title: `${rel} is ${(text.length / 1024).toFixed(0)}k chars`,
        file: ctx.root + '/' + rel,
        detail:
          'Instruction files are loaded on every session; past ~20k chars they dilute ' +
          'the agent\u2019s attention and burn tokens.',
        fix: 'Keep the essentials in the file; move details into linked docs or skills.',
      });
    }
  }

  // Settings tracked by git inside a project (common leak vector)
  if (ctx.kind === 'project' && ctx.exists('.claude/settings.json')) {
    const gi = ctx.read('.gitignore');
    if (gi !== null && /settings\.local\.json/.test(gi) === false && /\.claude/.test(gi) === false) {
      findings.push({
        rule: 'hygiene.settings-may-be-committed',
        severity: 'low',
        title: '.claude/settings.json may be committed to git',
        file: ctx.root + '/.gitignore',
        detail:
          'Project settings often contain local permissions and occasionally tokens. ' +
          'Check what is tracked before pushing.',
        fix: 'Review `git status`; keep machine-specific settings in settings.local.json.',
      });
    }
  }

  return findings;
};
