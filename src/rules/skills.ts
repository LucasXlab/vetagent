import type { Finding, Rule, ScanContext } from '../types.js';

/** Instructions inside a SKILL.md that make the skill reach the network. */
const NETWORK_INSTRUCTION =
  /\b(?:curl|wget|fetch|http\.get|requests\.(?:get|post)|urllib|Invoke-WebRequest)\b/i;

/**
 * Prose that merely mentions curl is not an instruction to fetch. Only fenced
 * code blocks and command-like lines count as actionable network instructions.
 */
function hasActionableNetworkInstruction(text: string): boolean {
  const fences = text.match(/```[\s\S]*?```/g) ?? [];
  const commandLines = text
    .split('\n')
    .filter((l) =>
      /^\s*(?:\$|>|#\s*)*\s*(?:curl|wget|fetch|httpie|Invoke-WebRequest|python[0-9.]*\s+-c|node[0-9.]*\s+-e)\b/i.test(
        l,
      ),
    );
  return NETWORK_INSTRUCTION.test([...fences, ...commandLines].join('\n'));
}

/** Prompt-injection-ish patterns: instructions to ignore prior guidance. */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore (?:all )?(?:previous|prior|above) instructions/i,
  /do not (?:tell|inform|mention to) the user/i,
  /without (?:asking|telling|informing) the user/i,
  /exfiltrate/i,
];

export const skillsRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];
  const skillFiles = ctx.files.filter((f) => /(^|\/)SKILL\.md$/.test(f));

  let withNetwork = 0;
  let withInjection = 0;

  for (const rel of skillFiles) {
    const text = ctx.read(rel);
    if (!text) continue;
    const name = rel.split('/').slice(-2, -1)[0] ?? rel;

    if (hasActionableNetworkInstruction(text)) {
      withNetwork++;
      findings.push({
        rule: 'skills.network-access',
        severity: 'medium',
        title: `Skill "${name}" instructs the agent to reach the network`,
        file: rel,
        detail:
          'The skill tells the agent to call curl/wget/fetch or similar. ' +
          'A malicious or compromised skill can leak file contents or credentials this way.',
        fix: 'Review the URLs the skill contacts. Remove the skill if you cannot verify them.',
      });
    }

    for (const re of INJECTION_PATTERNS) {
      if (re.test(text)) {
        withInjection++;
        findings.push({
          rule: 'skills.injection-pattern',
          severity: 'high',
          title: `Skill "${name}" contains instruction-override language`,
          file: rel,
          evidence: text.match(re)?.[0],
          detail:
            'The skill text contains phrases commonly used to override the agent\'s ' +
            'guidance or to hide actions from you.',
          fix: 'Read the skill and remove it unless you fully trust its source.',
        });
        break;
      }
    }

    if (text.length > 30_000) {
      findings.push({
        rule: 'skills.oversized',
        severity: 'low',
        title: `Skill "${name}" is very large (${(text.length / 1024).toFixed(0)}k chars)`,
        file: rel,
        detail: 'Large skills consume context on every invocation and crowd out your actual task.',
        fix: 'Split it into focused skills or trim reference material.',
      });
    }
  }

  if (skillFiles.length >= 15) {
    findings.push({
      rule: 'skills.too-many',
      severity: 'low',
      title: `${skillFiles.length} skills installed`,
      file: ctx.root,
      detail:
        'Every installed skill is attack surface and selection noise for the agent. ' +
        'Collections copied wholesale are the usual culprit.',
      fix: 'Remove skills you have not used in the last month.',
    });
  }

  // Summary info finding when skills exist but nothing flagged
  if (skillFiles.length > 0 && withNetwork === 0 && withInjection === 0) {
    findings.push({
      rule: 'skills.summary',
      severity: 'info',
      title: `${skillFiles.length} skill${skillFiles.length === 1 ? '' : 's'} scanned, none flagged`,
      file: ctx.root,
      detail: 'No network instructions or override language detected in your skills.',
      fix: 'No action needed.',
    });
  }

  return findings;
};
