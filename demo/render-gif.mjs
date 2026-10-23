// Compatibility entry point for the synthetic-data demo renderer.
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
execFileSync('python3', ['scripts/render_assets.py'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit',
});
