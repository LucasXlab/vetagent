// Render demo/demo-output.txt into docs/demo.gif.
// Frames are SVG (rendered to PNG by @resvg/resvg-js), assembled by ffmpeg.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { Resvg } from '@resvg/resvg-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const framesDir = join(root, 'demo', '.frames');
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const W = 1180;
const H = 600;
const FS = 15;
const LINE_H = 21;
const BG = '#0d1117';
const FG = '#c9d1d9';
const GREEN = '#7ee787';
const YELLOW = '#e3b341';
const RED = '#ff7b72';
const GRAY = '#8b949e';
const PER_FRAME = 2;

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function colorFor(line) {
  if (line.startsWith('$')) return GREEN;
  if (/^\s*▸/.test(line)) return RED;
  if (/HIGH|MEDIUM|LOW|Score|Findings|⚠/.test(line)) return YELLOW;
  if (/^\s*(why|fix):/.test(line)) return GRAY;
  if (/^\s+\./.test(line)) return GRAY;
  return FG;
}

const raw = readFileSync(join(root, 'demo', 'demo-output.txt'), 'utf8');
const lines = raw.split('\n');
const total = lines.length;
const nFrames = Math.floor((total + PER_FRAME - 1) / PER_FRAME) + 1;

for (let i = 0; i < nFrames; i++) {
  const show = i * PER_FRAME;
  const visible = lines.slice(0, show);
  const texts = visible
    .map((line, idx) => {
      const y = 24 + idx * LINE_H;
      const color = colorFor(line);
      return `<text x="24" y="${y}" font-family="Menlo, monospace" font-size="${FS}" fill="${color}" xml:space="preserve">${escapeXml(line)}</text>`;
    })
    .join('');
  const cursor = `<rect x="24" y="${24 + visible.length * LINE_H - FS}" width="9" height="${FS}" fill="${GREEN}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${BG}"/>${texts}${cursor}</svg>`;
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(join(framesDir, `frame_${String(i).padStart(3, '0')}.png`), png);
}

execSync(
  `ffmpeg -loglevel error -y -framerate 4 -i "${framesDir}/frame_%03d.png" ` +
    `-vf "split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse=dither=bayer" ` +
    `"${join(root, 'docs', 'demo.gif')}"`,
  { stdio: 'inherit' },
);

rmSync(framesDir, { recursive: true, force: true });
console.log('wrote docs/demo.gif');
