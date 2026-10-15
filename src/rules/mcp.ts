import type { Finding, Rule, ScanContext } from '../types.js';
import { isCredentialKey, looksLikeCredential } from '../patterns.js';
import { redact } from '../util.js';

interface McpServer {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  type?: unknown;
}

interface McpFile {
  mcpServers?: Record<string, McpServer>;
}

function parseJson(text: string): McpFile | undefined {
  try {
    return JSON.parse(text) as McpFile;
  } catch {
    return undefined;
  }
}

/** Is this package reference pinned to a version? e.g. "pkg@1.2.3" or "@scope/pkg@1.2.3" */
function isPinnedVersion(arg: string): boolean {
  // strip scope
  const withoutScope = arg.startsWith('@') ? arg.slice(arg.indexOf('/') + 1) : arg;
  return /@[0-9]/.test(withoutScope) || withoutScope.includes('@latest') === false && /\d+\.\d+/.test(withoutScope);
}

export const mcpRule: Rule = (ctx: ScanContext): Finding[] => {
  const findings: Finding[] = [];
  const mcpFiles = ctx.files.filter((f) => /(^|\/)\.mcp\.json$/.test(f) || /(^|\/)mcp\.json$/.test(f));

  for (const rel of mcpFiles) {
    const text = ctx.read(rel);
    if (!text) continue;
    const parsed = parseJson(text);
    if (!parsed?.mcpServers) continue;

    for (const [name, server] of Object.entries(parsed.mcpServers)) {
      const s = server as McpServer;

      // 1. Unpinned npx/uvx packages
      if (typeof s.command === 'string' && ['npx', 'uvx', 'bunx', 'pnpx', 'pipx'].includes(s.command)) {
        const args = Array.isArray(s.args) ? s.args.filter((a): a is string => typeof a === 'string') : [];
        const pkg = args.find((a) => !a.startsWith('-') && a !== s.command);
        if (pkg && !isPinnedVersion(pkg)) {
          findings.push({
            rule: 'mcp.unpinned-package',
            severity: 'medium',
            title: `MCP server "${name}" runs an unpinned package`,
            file: rel,
            evidence: `${s.command} ${pkg}`,
            detail:
              'Without a version pin, every launch can pull a different build. ' +
              'A compromised publish becomes remote code execution on your machine.',
            fix: `Pin it: ${s.command} ${pkg}@<exact-version> (check the project's releases for the current version).`,
          });
        }
        // Flags that auto-approve installs
        if (args.some((a) => a === '-y' || a === '--yes')) {
          findings.push({
            rule: 'mcp.auto-yes',
            severity: 'low',
            title: `MCP server "${name}" auto-confirms package installs (-y)`,
            file: rel,
            evidence: args.join(' '),
            detail: 'The -y flag suppresses install prompts, hiding what gets downloaded.',
            fix: 'Remove -y and install the package explicitly with a pinned version.',
          });
        }
      }

      // 2. Remote transports
      if (typeof s.url === 'string') {
        const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(s.url);
        if (!isLocal) {
          findings.push({
            rule: 'mcp.remote-transport',
            severity: 'medium',
            title: `MCP server "${name}" points at a remote URL`,
            file: rel,
            evidence: s.url,
            detail:
              'A remote MCP endpoint receives your prompts and tool results. ' +
              'Only use endpoints you trust and operate.',
            fix: 'Prefer a local stdio server, or verify the endpoint owner and its data policy.',
          });
        }
        if (/^http:\/\//i.test(s.url) && !isLocal) {
          findings.push({
            rule: 'mcp.insecure-transport',
            severity: 'high',
            title: `MCP server "${name}" uses plaintext HTTP`,
            file: rel,
            evidence: s.url,
            detail: 'Traffic to this server (including credentials in headers) can be intercepted.',
            fix: 'Switch to an https:// endpoint.',
          });
        }
      }

      // 3. Inline credentials in env
      if (s.env && typeof s.env === 'object') {
        for (const [k, v] of Object.entries(s.env as Record<string, unknown>)) {
          if (typeof v === 'string' && isCredentialKey(k) && looksLikeCredential(v)) {
            findings.push({
              rule: 'mcp.inline-credential',
              severity: 'high',
              title: `MCP server "${name}" has an inline credential in env.${k}`,
              file: rel,
              evidence: `${k}: "${redact(v)}"`,
              detail: 'The credential is stored in plaintext next to the server definition.',
              fix: `Reference an environment variable instead: "${k}: "\${${k}}""`,
            });
          }
        }
      }

      // 4. Shell wrapper commands
      if (typeof s.command === 'string' && /\b(?:ba|z|fi)?sh\s+-c\b/.test(s.command) && /\b(?:curl|wget)\b/i.test(s.command)) {
        findings.push({
          rule: 'mcp.shell-download',
          severity: 'high',
          title: `MCP server "${name}" downloads code in its command`,
          file: rel,
          evidence: s.command.slice(0, 120),
          detail: 'The server command fetches remote code before running.',
          fix: 'Install the server as a reviewed local package instead.',
        });
      }
    }
  }

  return findings;
};
