import React from 'react';
import { C } from './stil';

export type Izraz = 'happy' | 'shock' | 'worried' | 'skeptic' | 'laugh' | 'sly';

const EYE = C.amber;
const L = { x: 155, y: 165 };
const R = { x: 245, y: 165 };

/** Byte: the channel mascot. A small robot with a screen for a face. `usta` 0..1 is how open the mouth is. */
export const Byte: React.FC<{ izraz: Izraz; usta: number; trep: number; mahanje?: number; svetlo?: number }> = ({ izraz, usta, trep, mahanje = 0, svetlo = 1 }) => {
  const prica = usta > 0.06;
  return (
    <svg viewBox="0 0 400 470" width="100%" height="100%" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.amber} stopOpacity={0.35} />
          <stop offset="100%" stopColor={C.amber} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <line x1="200" y1="75" x2="200" y2="28" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
      <circle cx="200" cy="22" r="34" fill="url(#glow)" opacity={svetlo} />
      <circle cx="200" cy="22" r="13" fill={C.amber} opacity={0.55 + 0.45 * svetlo} />
      {/* ears */}
      <rect x="40" y="140" width="26" height="70" rx="12" fill="#475569" />
      <rect x="334" y="140" width="26" height="70" rx="12" fill="#475569" />
      {/* arms */}
      <g transform={`rotate(${-20 - mahanje * 70} 130 330)`}>
        <rect x="70" y="318" width="70" height="26" rx="13" fill="#475569" />
        <circle cx="70" cy="331" r="18" fill="#64748b" />
      </g>
      <g transform="rotate(20 270 330)">
        <rect x="260" y="318" width="70" height="26" rx="13" fill="#475569" />
        <circle cx="330" cy="331" r="18" fill="#64748b" />
      </g>
      {/* body */}
      <rect x="120" y="296" width="160" height="130" rx="44" fill="url(#metal)" stroke="#475569" strokeWidth="5" />
      <rect x="168" y="335" width="64" height="40" rx="12" fill={C.amber} />
      <text x="200" y="365" textAnchor="middle" fontWeight={800} fontSize="26" fill={C.bg} fontFamily="Inter, sans-serif">AI</text>
      {/* head */}
      <rect x="60" y="72" width="280" height="226" rx="64" fill="url(#metal)" stroke="#475569" strokeWidth="6" />
      <rect x="86" y="98" width="228" height="174" rx="44" fill="#020617" />
      <rect x="96" y="106" width="90" height="16" rx="8" fill="#fff" opacity={0.06} />
      <Oci izraz={izraz} trep={trep} />
      <Usta izraz={izraz} usta={usta} prica={prica} />
    </svg>
  );
};

const Oko: React.FC<{ x: number; y: number; trep: number; rx?: number; ry?: number }> = ({ x, y, trep, rx = 17, ry = 24 }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={Math.max(2, ry * (1 - trep))} fill={EYE} />
);

const Luk: React.FC<{ x: number; y: number }> = ({ x, y }) => (
  <path d={`M ${x - 22} ${y + 8} Q ${x} ${y - 22} ${x + 22} ${y + 8}`} stroke={EYE} strokeWidth="11" fill="none" strokeLinecap="round" />
);

const Obrva: React.FC<{ d: string }> = ({ d }) => <path d={d} stroke={EYE} strokeWidth="9" fill="none" strokeLinecap="round" />;

const Oci: React.FC<{ izraz: Izraz; trep: number }> = ({ izraz, trep }) => {
  switch (izraz) {
    case 'happy':
    case 'laugh':
      return (
        <>
          <Luk {...L} />
          <Luk {...R} />
        </>
      );
    case 'shock':
      return (
        <>
          <circle cx={L.x} cy={L.y} r={28} fill={EYE} />
          <circle cx={R.x} cy={R.y} r={28} fill={EYE} />
          <circle cx={L.x} cy={L.y} r={9} fill="#020617" />
          <circle cx={R.x} cy={R.y} r={9} fill="#020617" />
          <Obrva d={`M ${L.x - 26} 122 Q ${L.x} 108 ${L.x + 26} 122`} />
          <Obrva d={`M ${R.x - 26} 122 Q ${R.x} 108 ${R.x + 26} 122`} />
        </>
      );
    case 'worried':
      return (
        <>
          <Oko {...L} trep={trep} rx={15} ry={20} />
          <Oko {...R} trep={trep} rx={15} ry={20} />
          <Obrva d={`M ${L.x - 26} 140 L ${L.x + 22} 124`} />
          <Obrva d={`M ${R.x - 22} 124 L ${R.x + 26} 140`} />
        </>
      );
    case 'skeptic':
      return (
        <>
          <rect x={L.x - 20} y={L.y - 4} width={40} height={10} rx={5} fill={EYE} />
          <Oko {...R} trep={trep} />
          <Obrva d={`M ${L.x - 24} ${L.y - 18} L ${L.x + 22} ${L.y - 14}`} />
          <Obrva d={`M ${R.x - 24} 124 Q ${R.x} 104 ${R.x + 24} 118`} />
        </>
      );
    case 'sly':
      return (
        <>
          <ellipse cx={L.x} cy={L.y + 4} rx={18} ry={Math.max(2, 11 * (1 - trep))} fill={EYE} />
          <ellipse cx={R.x} cy={R.y + 4} rx={18} ry={Math.max(2, 11 * (1 - trep))} fill={EYE} />
          <Obrva d={`M ${L.x - 24} ${L.y - 12} L ${L.x + 24} ${L.y - 12}`} />
          <Obrva d={`M ${R.x - 24} ${R.y - 16} Q ${R.x} ${R.y - 34} ${R.x + 24} ${R.y - 20}`} />
        </>
      );
  }
};

const Usta: React.FC<{ izraz: Izraz; usta: number; prica: boolean }> = ({ izraz, usta, prica }) => {
  const y = 232;
  if (prica) {
    const h = 10 + usta * 46;
    const w = izraz === 'laugh' ? 90 : 64 + usta * 12;
    return <rect x={200 - w / 2} y={y - h / 2} width={w} height={h} rx={Math.min(h, w) / 2} fill={EYE} />;
  }
  switch (izraz) {
    case 'shock':
      return <ellipse cx={200} cy={y} rx={16} ry={20} fill={EYE} />;
    case 'worried':
      return <path d={`M 168 ${y + 4} Q 184 ${y - 8} 200 ${y + 2} Q 216 ${y + 10} 232 ${y - 2}`} stroke={EYE} strokeWidth="9" fill="none" strokeLinecap="round" />;
    case 'skeptic':
      return <path d={`M 172 ${y + 4} L 230 ${y - 4}`} stroke={EYE} strokeWidth="9" strokeLinecap="round" />;
    case 'sly':
      return <path d={`M 170 ${y} Q 205 ${y + 12} 236 ${y - 12}`} stroke={EYE} strokeWidth="9" fill="none" strokeLinecap="round" />;
    default:
      return <path d={`M 166 ${y - 8} Q 200 ${y + 26} 234 ${y - 8}`} stroke={EYE} strokeWidth="10" fill="none" strokeLinecap="round" />;
  }
};

export type Raspolozenje = 'calm' | 'sad' | 'sly' | 'shock';

/** A company as a character: a colored orb with a face. */
export const Lik: React.FC<{ ime: string; boja: string; slovo: string; size?: number; raspolozenje?: Raspolozenje; pogled?: number }> = ({
  ime,
  boja,
  slovo,
  size = 220,
  raspolozenje = 'calm',
  pogled = 0,
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
    <svg viewBox="0 0 200 200" width={size} height={size} style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id={`orb-${ime.replace(/\W/g, '')}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
          <stop offset="35%" stopColor={boja} />
          <stop offset="100%" stopColor={boja} stopOpacity={0.75} />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="96" fill={boja} opacity={0.22} />
      <circle cx="100" cy="100" r="84" fill={`url(#orb-${ime.replace(/\W/g, '')})`} />
      <text x="100" y="62" textAnchor="middle" fontWeight={800} fontSize={slovo.length > 2 ? 26 : 32} fill="#fff" opacity={0.85} fontFamily="Inter, sans-serif">
        {slovo}
      </text>
      {raspolozenje === 'sly' ? (
        <>
          <ellipse cx={74 + pogled * 6} cy={98} rx={13} ry={6} fill="#0b1120" />
          <ellipse cx={126 + pogled * 6} cy={98} rx={13} ry={6} fill="#0b1120" />
          <path d="M 76 132 Q 106 146 128 124" stroke="#0b1120" strokeWidth="7" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx={74 + pogled * 6} cy={98} rx={11} ry={raspolozenje === 'shock' ? 17 : 14} fill="#0b1120" />
          <ellipse cx={126 + pogled * 6} cy={98} rx={11} ry={raspolozenje === 'shock' ? 17 : 14} fill="#0b1120" />
          {raspolozenje === 'sad' && (
            <>
              <path d="M 58 78 L 88 70" stroke="#0b1120" strokeWidth="6" strokeLinecap="round" />
              <path d="M 112 70 L 142 78" stroke="#0b1120" strokeWidth="6" strokeLinecap="round" />
              <path d="M 76 138 Q 100 120 124 138" stroke="#0b1120" strokeWidth="7" fill="none" strokeLinecap="round" />
              <ellipse cx={142} cy={118} rx={6} ry={10} fill="#7dd3fc" />
            </>
          )}
          {raspolozenje === 'calm' && <path d="M 78 128 Q 100 144 122 128" stroke="#0b1120" strokeWidth="7" fill="none" strokeLinecap="round" />}
          {raspolozenje === 'shock' && <ellipse cx={100} cy={134} rx={12} ry={15} fill="#0b1120" />}
        </>
      )}
    </svg>
    <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: size * 0.17, color: C.text, letterSpacing: 1 }}>{ime}</div>
  </div>
);

/** Companies as recurring characters. Claude picks them by id; an unknown company gets a color from its name. */
export const LIKOVI: Record<string, { ime: string; boja: string; slovo: string }> = {
  openai: { ime: 'OpenAI', boja: '#10b981', slovo: 'OAI' },
  google: { ime: 'Google', boja: '#3b82f6', slovo: 'G' },
  anthropic: { ime: 'Anthropic', boja: '#d97757', slovo: 'A' },
  meta: { ime: 'Meta', boja: '#0866ff', slovo: 'M' },
  microsoft: { ime: 'Microsoft', boja: '#00a4ef', slovo: 'MS' },
  xai: { ime: 'xAI', boja: '#9ca3af', slovo: 'X' },
  nvidia: { ime: 'Nvidia', boja: '#76b900', slovo: 'NV' },
  apple: { ime: 'Apple', boja: '#a3a3a3', slovo: 'AP' },
  amazon: { ime: 'Amazon', boja: '#ff9900', slovo: 'AMZ' },
  mistral: { ime: 'Mistral', boja: '#fa520f', slovo: 'MI' },
  deepseek: { ime: 'DeepSeek', boja: '#4d6bfe', slovo: 'DS' },
  alibaba: { ime: 'Alibaba', boja: '#ff6a00', slovo: 'Q' },
  perplexity: { ime: 'Perplexity', boja: '#20808d', slovo: 'P' },
  huggingface: { ime: 'Hugging Face', boja: '#eab308', slovo: 'HF' },
  github: { ime: 'GitHub', boja: '#8b5cf6', slovo: 'GH' },
  cursor: { ime: 'Cursor', boja: '#6366f1', slovo: 'CU' },
  samsung: { ime: 'Samsung', boja: '#1428a0', slovo: 'S' },
  tesla: { ime: 'Tesla', boja: '#e11d48', slovo: 'T' },
};

const PALETA = ['#14b8a6', '#a855f7', '#f43f5e', '#0ea5e9', '#84cc16', '#f59e0b', '#ec4899'];

export function lik(id: string, ime?: string) {
  const poznat = LIKOVI[id];
  if (poznat) return { ...poznat, ime: ime || poznat.ime };
  const naziv = ime || id;
  const h = [...naziv].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const slovo = naziv.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  return { ime: naziv, boja: PALETA[h % PALETA.length], slovo };
}
