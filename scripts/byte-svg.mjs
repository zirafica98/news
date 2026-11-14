// Byte, maskota kanala, kao statičan SVG (isti crtež kao video/src/byte.tsx, bez animacije).
// Koristi se za naslovne slike vesti (slike-vesti.mjs) i za sajt (public/byte/*.svg).
// Pokretanje: node scripts/byte-svg.mjs  — upisuje public/byte/<izraz>.svg

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLIC_DIR } from './lib.mjs';

export const IZRAZI = ['happy', 'shock', 'worried', 'skeptic', 'sly'];

const AMBER = '#fbbf24';
const BG = '#020617';
const L = { x: 155, y: 165 };
const R = { x: 245, y: 165 };

const luk = ({ x, y }) => `<path d="M ${x - 22} ${y + 8} Q ${x} ${y - 22} ${x + 22} ${y + 8}" stroke="${AMBER}" stroke-width="11" fill="none" stroke-linecap="round"/>`;
const oko = ({ x, y }, rx = 17, ry = 24) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${AMBER}"/>`;
const obrva = (d) => `<path d="${d}" stroke="${AMBER}" stroke-width="9" fill="none" stroke-linecap="round"/>`;

function oci(izraz) {
  switch (izraz) {
    case 'shock':
      return `<circle cx="${L.x}" cy="${L.y}" r="28" fill="${AMBER}"/><circle cx="${R.x}" cy="${R.y}" r="28" fill="${AMBER}"/>
<circle cx="${L.x}" cy="${L.y}" r="9" fill="${BG}"/><circle cx="${R.x}" cy="${R.y}" r="9" fill="${BG}"/>
${obrva(`M ${L.x - 26} 122 Q ${L.x} 108 ${L.x + 26} 122`)}${obrva(`M ${R.x - 26} 122 Q ${R.x} 108 ${R.x + 26} 122`)}`;
    case 'worried':
      return `${oko(L, 15, 20)}${oko(R, 15, 20)}${obrva(`M ${L.x - 26} 140 L ${L.x + 22} 124`)}${obrva(`M ${R.x - 22} 124 L ${R.x + 26} 140`)}`;
    case 'skeptic':
      return `<rect x="${L.x - 20}" y="${L.y - 4}" width="40" height="10" rx="5" fill="${AMBER}"/>${oko(R)}
${obrva(`M ${L.x - 24} ${L.y - 18} L ${L.x + 22} ${L.y - 14}`)}${obrva(`M ${R.x - 24} 124 Q ${R.x} 104 ${R.x + 24} 118`)}`;
    case 'sly':
      return `<ellipse cx="${L.x}" cy="${L.y + 4}" rx="18" ry="11" fill="${AMBER}"/><ellipse cx="${R.x}" cy="${R.y + 4}" rx="18" ry="11" fill="${AMBER}"/>
${obrva(`M ${L.x - 24} ${L.y - 12} L ${L.x + 24} ${L.y - 12}`)}${obrva(`M ${R.x - 24} ${R.y - 16} Q ${R.x} ${R.y - 34} ${R.x + 24} ${R.y - 20}`)}`;
    default:
      return `${luk(L)}${luk(R)}`;
  }
}

function usta(izraz) {
  const y = 232;
  switch (izraz) {
    case 'shock':
      return `<ellipse cx="200" cy="${y}" rx="16" ry="20" fill="${AMBER}"/>`;
    case 'worried':
      return `<path d="M 168 ${y + 4} Q 184 ${y - 8} 200 ${y + 2} Q 216 ${y + 10} 232 ${y - 2}" stroke="${AMBER}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    case 'skeptic':
      return `<path d="M 172 ${y + 4} L 230 ${y - 4}" stroke="${AMBER}" stroke-width="9" stroke-linecap="round"/>`;
    case 'sly':
      return `<path d="M 170 ${y} Q 205 ${y + 12} 236 ${y - 12}" stroke="${AMBER}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
    default:
      return `<path d="M 166 ${y - 8} Q 200 ${y + 26} 234 ${y - 8}" stroke="${AMBER}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
  }
}

/** SVG string Byte-a (viewBox 400×470). `mahanje` podiže levu ruku (0..1). */
export function byteSvg(izraz = 'happy', { mahanje = 0 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 470" width="400" height="470">
<defs>
<radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="${AMBER}" stop-opacity="0.35"/><stop offset="100%" stop-color="${AMBER}" stop-opacity="0"/></radialGradient>
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#334155"/><stop offset="100%" stop-color="#1e293b"/></linearGradient>
</defs>
<line x1="200" y1="75" x2="200" y2="28" stroke="#475569" stroke-width="8" stroke-linecap="round"/>
<circle cx="200" cy="22" r="34" fill="url(#glow)"/>
<circle cx="200" cy="22" r="13" fill="${AMBER}"/>
<rect x="40" y="140" width="26" height="70" rx="12" fill="#475569"/>
<rect x="334" y="140" width="26" height="70" rx="12" fill="#475569"/>
<g transform="rotate(${-20 - mahanje * 70} 130 330)"><rect x="70" y="318" width="70" height="26" rx="13" fill="#475569"/><circle cx="70" cy="331" r="18" fill="#64748b"/></g>
<g transform="rotate(20 270 330)"><rect x="260" y="318" width="70" height="26" rx="13" fill="#475569"/><circle cx="330" cy="331" r="18" fill="#64748b"/></g>
<rect x="120" y="296" width="160" height="130" rx="44" fill="url(#metal)" stroke="#475569" stroke-width="5"/>
<rect x="168" y="335" width="64" height="40" rx="12" fill="${AMBER}"/>
<path d="M 186 364 L 193 344 L 200 364 M 189 357 L 197 357 M 211 344 L 211 364" stroke="${BG}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="60" y="72" width="280" height="226" rx="64" fill="url(#metal)" stroke="#475569" stroke-width="6"/>
<rect x="86" y="98" width="228" height="174" rx="44" fill="${BG}"/>
<rect x="96" y="106" width="90" height="16" rx="8" fill="#fff" opacity="0.06"/>
${oci(izraz)}
${usta(izraz)}
</svg>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(PUBLIC_DIR, 'byte');
  await mkdir(dir, { recursive: true });
  for (const izraz of IZRAZI) await writeFile(join(dir, `${izraz}.svg`), byteSvg(izraz));
  await writeFile(join(dir, 'wave.svg'), byteSvg('happy', { mahanje: 1 }));
  console.log(`Byte SVG: ${IZRAZI.length + 1} fajlova u public/byte/`);
}
