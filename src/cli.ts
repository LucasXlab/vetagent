#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { homedir } from 'node:os';
import type { TargetKind } from './types.js';
import { agentHomes, isProjectWithAgentConfig } from './targets.js';
import { scanTargets } from './scan.js';
import { renderReport, toJson, colorsEnabled } from './report.js';

const VERSION = '1.0.0';

const HELP = `vetagent v${VERSION} — vet your AI coding agent setup in one command.

Usage:
  vetagent [options]

Options:
  --path <dir>   Scan a directory for project-level agent config (.claude, .mcp.json, CLAUDE.md...)
                 Default: current directory (if it has agent config) plus detected agent homes
  --homes-only   Only scan agent homes (~/.claude, ~/.codex, ...), skip the current directory
  --exclude <g>  Skip paths matching a glob (repeatable), e.g. --exclude "test/fixtures/**"
  --json         Machine-readable output
  --strict       Exit with code 1 on medium findings too (default: high only)
  --no-color     Disable colored output
  -h, --help     Show this help
  -v, --version  Show version

Exit codes:
  0  no high-severity findings
  1  at least one high-severity finding (or medium with --strict)

vetagent runs entirely on your machine. It reads config files, never writes,
and makes no network requests.
`;

interface Args {
  path?: string;
  homesOnly: boolean;
  json: boolean;
  strict: boolean;
  noColor: boolean;
  exclude: string[];
  help: boolean;
  version: boolean;
}

export function parseArgs(argv: string[]): Args {
  const args: Args = {
    homesOnly: false,
    json: false,
    strict: false,
    noColor: false,
    exclude: [],
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--path':
        args.path = argv[++i];
        break;
      case '--homes-only':
        args.homesOnly = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--strict':
        args.strict = true;
        break;
      case '--no-color':
        args.noColor = true;
        break;
      case '--exclude':
        if (argv[i + 1]) args.exclude.push(argv[++i]);
        break;
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      default:
        if (a.startsWith('--path=')) {
          args.path = a.slice('--path='.length);
        } else if (a.startsWith('--exclude=')) {
          args.exclude.push(a.slice('--exclude='.length));
        } else {
          process.stderr.write(`Unknown option: ${a}\n`);
          args.help = true;
        }
    }
  }
  return args;
}

function resolveTargets(args: Args): Array<{ root: string; kind: TargetKind }> {
  const targets: Array<{ root: string; kind: TargetKind }> = [];

  if (args.path) {
    let dir = resolve(args.path);
    if (!existsSync(dir)) {
      process.stderr.write(`Path not found: ${dir}\n`);
      process.exit(2);
    }
    // If a file was given, scan its containing directory.
    try {
      if (statSync(dir).isFile()) dir = dirname(dir);
    } catch {
      /* ignore */
    }
    targets.push({ root: dir, kind: isProjectWithAgentConfig(dir) ? 'project' : 'generic' });
    return targets;
  }

  if (!args.homesOnly) {
    const cwd = process.cwd();
    const home = homedir();
    // Never walk the entire home directory implicitly.
    if (cwd !== home && isProjectWithAgentConfig(cwd)) {
      targets.push({ root: cwd, kind: 'project' });
    }
  }
  for (const h of agentHomes()) targets.push({ root: h.root, kind: h.kind });
  return targets;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    process.exit(0);
  }

  const targets = resolveTargets(args);

  if (targets.length === 0) {
    if (args.json) {
      process.stdout.write(
        toJson({ findings: [], stats: { filesScanned: 0, targets: [], durationMs: 0 }, score: 100, grade: 'A' }),
      );
    } else {
      process.stdout.write(
        '\n  No agent configuration found (looked in the current directory and ~/.claude, ~/.codex, ...).\n' +
          '  Run vetagent inside a project with agent config, or point it at one with --path <dir>.\n\n',
      );
    }
    process.exit(0);
  }

  const result = scanTargets(targets, args.exclude);

  if (args.json) {
    process.stdout.write(toJson(result) + '\n');
  } else {
    process.stdout.write(renderReport(result, { color: colorsEnabled(args.noColor) }));
  }

  const high = result.findings.filter((f) => f.severity === 'high').length;
  const medium = result.findings.filter((f) => f.severity === 'medium').length;
  if (high > 0 || (args.strict && medium > 0)) {
    process.exit(1);
  }
  process.exit(0);
}

main();
