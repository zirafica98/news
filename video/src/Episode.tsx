// AI Wars: daily episode with the mascot Byte. Script comes from scripts/ai-wars.mjs (Claude writes it, Kokoro voices it).
import React from 'react';
import { AbsoluteFill, Audio, CalculateMetadataFunction, Easing, interpolate, Sequence, spring, staticFile, useCurrentFrame } from 'remotion';
import { Byte, Izraz, Lik, lik, Raspolozenje } from './byte';
import { C, fontFamily } from './stil';

export const EP_FPS = 30;
const POCETAK = 8; // frames before the first line
const RAZMAK = 6; // frames of silence between lines
const KRAJ = 45; // frames after the last line

export type LikUKadru = { id: string; ime?: string; raspolozenje?: Raspolozenje };
export type Kartica = {
  tip: 'intro' | 'likovi' | 'trake' | 'grafik' | 'broj' | 'tekst' | 'reflektor' | 'mera' | 'sucelje' | 'prati';
  likovi?: LikUKadru[];
  pecat?: string;
  trake?: { label: string; vrednost: string; udeo: number }[];
  smer?: 'gore' | 'dole';
  tekst?: string;
  podtekst?: string;
  broj?: string;
  naslov?: string;
  levo?: string;
  desno?: string;
  vrednost?: number;
};
export type Replika = { izraz: Izraz; tekst: string; sekundi: number; jacina: number[]; audio: string; kartica: Kartica };
export type EpizodaProps = { epizoda: number; podnaslov: string; replike: Replika[] };

const poceci = (replike: Replika[]) => {
  const p: number[] = [];
  let t = POCETAK;
  for (const r of replike) {
    p.push(t);
    t += Math.ceil(r.sekundi * EP_FPS) + RAZMAK;
  }
  p.push(t);
  return p;
};

export const izracunaj: CalculateMetadataFunction<EpizodaProps> = ({ props }) => {
  const p = poceci(props.replike);
  return { durationInFrames: p[p.length - 1] + KRAJ };
};

const Kontekst = React.createContext<EpizodaProps & { ukupno: number }>(null);

export const Episode: React.FC<EpizodaProps> = (props) => {
  const f = useCurrentFrame();
  const P = poceci(props.replike);
  const ukupno = P[P.length - 1] + KRAJ;
  let i = 0;
  while (i < props.replike.length - 1 && f >= P[i + 1]) i++;
  const r = props.replike[i];
  const lf = f - P[i];
  const a = r.jacina;
  const usta = lf >= 0 && lf < a.length ? (a[lf] + (a[lf - 1] ?? 0)) / 2 : 0;
  return (
    <Kontekst.Provider value={{ ...props, ukupno }}>
      <AbsoluteFill style={{ fontFamily, overflow: 'hidden' }}>
        <Pozadina />
        <Zaglavlje />
        {props.replike.map((rep, j) => (
          <Sequence key={j} from={P[j]} durationInFrames={P[j + 1] - P[j] + (j === props.replike.length - 1 ? KRAJ : 0)} layout="none">
            <Audio src={staticFile(rep.audio)} />
            <AbsoluteFill style={{ top: 250, height: 820 }}>
              <Kartica k={rep.kartica} trajanje={P[j + 1] - P[j]} />
            </AbsoluteFill>
            <Titl rep={rep} />
          </Sequence>
        ))}
        <Maskota izraz={r.izraz} usta={usta} kartica={r.kartica.tip} lf={lf} />
      </AbsoluteFill>
    </Kontekst.Provider>
  );
};

const Pozadina: React.FC = () => {
  const t = useCurrentFrame() / 30;
  const blob = (x: number, y: number, s: number, c: string, o: number, k: number) => (
    <div style={{ position: 'absolute', left: x + Math.sin(t * k) * 80, top: y + Math.cos(t * k * 0.8) * 60, width: s, height: s, borderRadius: '50%', background: c, opacity: o, filter: 'blur(120px)' }} />
  );
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, ${C.bg} 0%, #0b1224 55%, #1a0f2e 100%)` }}>
      {blob(-100, 200, 600, C.violet, 0.28, 0.3)}
      {blob(600, 900, 560, C.red, 0.12, 0.25)}
      {blob(300, 1400, 600, C.amber, 0.12, 0.2)}
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at 50% 35%, black 25%, transparent 70%)',
        }}
      />
    </AbsoluteFill>
  );
};

const Zaglavlje: React.FC = () => {
  const f = useCurrentFrame();
  const { epizoda, ukupno } = React.useContext(Kontekst);
  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 0, height: 10, width: `${Math.min(1, f / ukupno) * 100}%`, background: `linear-gradient(90deg, ${C.red}, ${C.amber})` }} />
      <div style={{ position: 'absolute', top: 110, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
        <div style={{ fontWeight: 800, fontSize: 46, letterSpacing: 8, color: C.text, display: 'flex', gap: 14 }}>
          <span style={{ color: C.red }}>AI</span>WARS
        </div>
        <div style={{ fontWeight: 800, fontSize: 30, color: C.bg, background: C.amber, borderRadius: 12, padding: '6px 16px', letterSpacing: 2 }}>EP. {epizoda}</div>
      </div>
    </>
  );
};

/** Captions: groups of up to 4 words, the spoken word lights up. */
const Titl: React.FC<{ rep: Replika }> = ({ rep }) => {
  const f = useCurrentFrame();
  const reci = rep.tekst.split(/\s+/).filter(Boolean);
  const govor = (rep.sekundi - 0.12) * EP_FPS;
  const tezine = reci.map((w) => w.length + 2);
  const ukupno = tezine.reduce((a, b) => a + b, 0);
  const pocetak: number[] = [];
  tezine.reduce((acc, w) => (pocetak.push(acc), acc + (w / ukupno) * govor), 0);
  let k = 0;
  while (k < reci.length - 1 && f >= pocetak[k + 1]) k++;
  const grupa = Math.floor(k / 4);
  const deo = reci.slice(grupa * 4, grupa * 4 + 4);
  return (
    <div style={{ position: 'absolute', top: 1095, left: 70, right: 70, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 34px' }}>
      {deo.map((w, j) => {
        const idx = grupa * 4 + j;
        const s = spring({ frame: f - pocetak[idx], fps: EP_FPS, config: { damping: 12, stiffness: 200, mass: 0.5 } });
        const sad = idx === k;
        return (
          <span
            key={idx}
            style={{
              fontWeight: 800,
              fontSize: 76,
              lineHeight: 1.15,
              color: f < pocetak[idx] ? '#475569' : sad ? C.amber : C.text,
              transform: `scale(${sad ? 1 + 0.06 * s : 1})`,
              textShadow: '0 6px 24px rgba(0,0,0,0.6)',
              display: 'inline-block',
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

const Maskota: React.FC<{ izraz: Izraz; usta: number; kartica: string; lf: number }> = ({ izraz, usta, kartica, lf }) => {
  const f = useCurrentFrame();
  const ciklus = f % 96;
  const trep = ciklus < 4 ? Math.sin((ciklus / 4) * Math.PI) : 0;
  const skok = izraz === 'shock' ? spring({ frame: lf, fps: EP_FPS, config: { damping: 8, stiffness: 220 } }) : 0;
  const tresenje = izraz === 'laugh' ? Math.sin(f * 1.6) * 4 : 0;
  const mahanje = kartica === 'intro' || kartica === 'prati' ? (Math.sin(lf / 3) + 1) / 2 : 0;
  const ulaz = 1; // vidljiva od prvog kadra (naslovna slika i pregled u feedu)
  const bob = Math.sin(f / 9) * 8;
  return (
    <div
      style={{
        position: 'absolute',
        left: 290,
        top: 1250,
        width: 500,
        height: 588,
        transform: `translateY(${bob - skok * 30 + (1 - ulaz) * 600}px) rotate(${tresenje}deg) scale(${1 + skok * 0.04})`,
        filter: 'drop-shadow(0 30px 60px rgba(0,0,0,0.6))',
      }}
    >
      <Byte izraz={izraz} usta={usta} trep={trep} mahanje={mahanje} svetlo={0.5 + usta * 0.5} />
    </div>
  );
};

/* ---------- building blocks ---------- */

const useUlaz = (delay = 0, config = { damping: 14, stiffness: 140, mass: 0.7 }) => spring({ frame: useCurrentFrame() - delay, fps: EP_FPS, config });

const Centar: React.FC<{ children: React.ReactNode; gap?: number }> = ({ children, gap = 40 }) => (
  <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap, padding: '0 60px' }}>{children}</AbsoluteFill>
);

/** Text where *words* are highlighted in amber. */
const Istakni: React.FC<{ text: string }> = ({ text }) => (
  <>{text.split(/(\*[^*]+\*)/).map((d, i) => (d.startsWith('*') ? <span key={i} style={{ color: C.amber }}>{d.slice(1, -1)}</span> : <React.Fragment key={i}>{d}</React.Fragment>))}</>
);

const Pecat: React.FC<{ text: string; delay?: number; color?: string; size?: number; rotate?: number }> = ({ text, delay = 0, color = C.red, size = 96, rotate = -8 }) => {
  const s = useUlaz(delay, { damping: 9, stiffness: 260, mass: 0.6 });
  const velicina = text.length > 14 ? size * 0.72 : size;
  return (
    <div
      style={{
        fontWeight: 800,
        fontSize: velicina,
        color,
        border: `8px solid ${color}`,
        borderRadius: 18,
        padding: '6px 28px',
        transform: `rotate(${rotate}deg) scale(${2.2 - 1.2 * s})`,
        opacity: Math.min(1, s * 2),
        letterSpacing: 2,
        background: 'rgba(2,6,23,0.6)',
        textAlign: 'center',
        maxWidth: 940,
      }}
    >
      {text.toUpperCase()}
    </div>
  );
};

const Uskoci: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => {
  const s = useUlaz(delay, { damping: 10, stiffness: 180, mass: 0.6 });
  return <div style={{ transform: `translateY(${(1 - s) * 200}px) scale(${0.5 + 0.5 * s})`, opacity: Math.min(1, s * 2) }}>{children}</div>;
};

const Osoba: React.FC<{ l: LikUKadru; size: number; pogled?: number }> = ({ l, size, pogled = 0 }) => <Lik {...lik(l.id, l.ime)} raspolozenje={l.raspolozenje ?? 'calm'} size={size} pogled={pogled} />;

const Kartica: React.FC<{ k: Kartica; trajanje: number }> = ({ k, trajanje }) => {
  switch (k.tip) {
    case 'intro':
      return <Intro k={k} />;
    case 'trake':
      return <Trake k={k} trajanje={trajanje} />;
    case 'grafik':
      return <Grafik k={k} trajanje={trajanje} />;
    case 'broj':
      return <Broj k={k} trajanje={trajanje} />;
    case 'tekst':
      return <Tekst k={k} />;
    case 'reflektor':
      return <Reflektor k={k} />;
    case 'mera':
      return <Mera k={k} trajanje={trajanje} />;
    case 'sucelje':
      return <Sucelje k={k} />;
    case 'prati':
      return <Prati />;
    default:
      return <Likovi k={k} />;
  }
};

/* ---------- cards ---------- */

const Likovi: React.FC<{ k: Kartica }> = ({ k }) => {
  const f = useCurrentFrame();
  const likovi = (k.likovi ?? []).slice(0, 3);
  const drhti = k.pecat && f > 18 ? Math.sin(f * 2.3) * 3 : 0;
  const size = likovi.length > 2 ? 210 : likovi.length === 2 ? 260 : 320;
  return (
    <Centar gap={60}>
      <div style={{ display: 'flex', gap: 70, transform: `translateX(${drhti}px)` }}>
        {likovi.map((l, j) => (
          <Uskoci key={j} delay={j * 5}>
            <Osoba l={l} size={size} pogled={likovi.length > 1 ? (j === 0 ? 1 : -1) : 0} />
          </Uskoci>
        ))}
      </div>
      {k.pecat && <Pecat text={k.pecat} delay={16} />}
      {k.tekst && !k.pecat && <Natpis text={k.tekst} delay={12} />}
    </Centar>
  );
};

const Natpis: React.FC<{ text: string; delay: number; border?: string }> = ({ text, delay, border = C.line }) => (
  <Uskoci delay={delay}>
    <div style={{ fontWeight: 800, fontSize: 56, color: C.text, background: C.card, border: `2px solid ${border}`, borderRadius: 28, padding: '22px 40px', textAlign: 'center', lineHeight: 1.2, maxWidth: 940 }}>
      <Istakni text={text} />
    </div>
  </Uskoci>
);

const Intro: React.FC<{ k: Kartica }> = ({ k }) => {
  const { epizoda, podnaslov } = React.useContext(Kontekst);
  const s = useUlaz(0);
  const likovi = (k.likovi?.length ? k.likovi : [{ id: 'openai' }, { id: 'google' }, { id: 'anthropic' }]).slice(0, 3);
  return (
    <Centar gap={50}>
      <div style={{ transform: `scale(${0.6 + 0.4 * s})`, opacity: s, textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 170, letterSpacing: -4, lineHeight: 1, color: C.text }}>
          <span style={{ color: C.red }}>AI</span> WARS
        </div>
        <div style={{ fontWeight: 600, fontSize: 38, color: C.soft, marginTop: 18, letterSpacing: 4 }}>
          EPISODE {epizoda} · {podnaslov.toUpperCase()}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 50 }}>
        {likovi.map((l, j) => (
          <Uskoci key={j} delay={4 + j * 4}>
            <Osoba l={l} size={190} />
          </Uskoci>
        ))}
      </div>
    </Centar>
  );
};

const Traka: React.FC<{ label: string; vrednost: string; udeo: number; boja: string; delay: number }> = ({ label, vrednost, udeo, boja, delay }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [delay, delay + 22], [0, Math.max(0.02, Math.min(1, udeo))], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ width: 860 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 40, color: C.soft, marginBottom: 12 }}>
        <span style={{ letterSpacing: 3 }}>{label.toUpperCase()}</span>
        <span style={{ color: boja }}>{vrednost}</span>
      </div>
      <div style={{ height: 70, borderRadius: 20, background: '#1e293b', overflow: 'hidden', border: `1px solid ${C.line}` }}>
        <div style={{ height: '100%', width: `${p * 100}%`, background: boja, borderRadius: 20 }} />
      </div>
    </div>
  );
};

const Trake: React.FC<{ k: Kartica; trajanje: number }> = ({ k, trajanje }) => {
  const f = useCurrentFrame();
  const trake = (k.trake ?? []).slice(0, 3);
  const glavni = k.likovi?.[0];
  const kasno = f > trajanje * 0.45;
  return (
    <Centar gap={44}>
      {glavni && (
        <Uskoci delay={0}>
          <Osoba l={{ ...glavni, raspolozenje: kasno ? glavni.raspolozenje : 'calm' }} size={220} />
        </Uskoci>
      )}
      {trake.map((t, j) => (
        <Traka key={j} {...t} boja={j === trake.length - 1 ? C.amber : '#64748b'} delay={j === 0 ? 4 : Math.round((trajanje * 0.4 * j) / Math.max(1, trake.length - 1))} />
      ))}
      {k.pecat && kasno && <Pecat text={k.pecat} delay={Math.round(trajanje * 0.62)} size={80} rotate={6} />}
    </Centar>
  );
};

const Grafik: React.FC<{ k: Kartica; trajanje: number }> = ({ k, trajanje }) => {
  const f = useCurrentFrame();
  const dole = k.smer !== 'gore';
  const vrh = trajanje * 0.55;
  const tacke = dole ? [40, 46, 42, 52, 50, 58, 55, 62, 60, 66, 64, 70, 68, 30, 26] : [30, 28, 34, 32, 38, 36, 42, 40, 46, 44, 52, 50, 58, 74, 80];
  const p = interpolate(f, [vrh - 30, vrh], [0.8, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * interpolate(f, [0, 30], [0.4, 1], { extrapolateRight: 'clamp' });
  const n = Math.max(2, Math.round(p * tacke.length));
  const put = tacke
    .slice(0, n)
    .map((v, j) => `${j === 0 ? 'M' : 'L'} ${40 + j * 56} ${360 - v * 4}`)
    .join(' ');
  const gotovo = n >= tacke.length - 1;
  const glavni = k.likovi?.[0];
  return (
    <Centar gap={30}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
        {glavni && (
          <Uskoci delay={0}>
            <Osoba l={{ ...glavni, raspolozenje: gotovo ? glavni.raspolozenje : 'calm' }} size={200} />
          </Uskoci>
        )}
        {k.tekst && (
          <div style={{ fontWeight: 800, fontSize: 42, color: C.soft, maxWidth: glavni ? 500 : 900, lineHeight: 1.2 }}>
            <Istakni text={k.tekst} />
          </div>
        )}
      </div>
      <div style={{ position: 'relative', width: 900, height: 420, background: C.card, border: `1px solid ${C.line}`, borderRadius: 28 }}>
        <svg viewBox="0 0 900 420" width={900} height={420}>
          <path d={put} stroke={gotovo ? (dole ? C.red : C.green) : '#64748b'} strokeWidth="10" fill="none" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        {gotovo && k.pecat && (
          <div style={{ position: 'absolute', right: 40, top: dole ? 40 : 250 }}>
            <Pecat text={k.pecat} delay={Math.round(vrh)} size={100} rotate={-6} color={dole ? C.red : C.green} />
          </div>
        )}
      </div>
    </Centar>
  );
};

/** Big number that counts up, e.g. "-$500B", "$1.25T", "40%". */
const Broj: React.FC<{ k: Kartica; trajanje: number }> = ({ k, trajanje }) => {
  const f = useCurrentFrame();
  const m = (k.broj ?? '').match(/^(.*?)(\d[\d,]*(?:\.\d+)?)(.*)$/);
  const cilj = m ? Number(m[2].replace(/,/g, '')) : 0;
  const decimale = m?.[2].includes('.') ? m[2].split('.')[1].length : 0;
  const v = interpolate(f, [4, trajanje * 0.7], [0, cilj], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const negativan = /^[-−]/.test(k.broj ?? '');
  const boja = negativan ? C.red : C.amber;
  const tekst = m ? `${m[1]}${v.toFixed(decimale)}${m[3]}` : k.broj;
  const novcanice = negativan ? Array.from({ length: 14 }, (_, j) => j) : [];
  return (
    <Centar gap={30}>
      {novcanice.map((j) => {
        const t = (f - j * 3) / 40;
        if (t < 0) return null;
        return (
          <div
            key={j}
            style={{
              position: 'absolute',
              left: 540 + (((j * 137) % 900) - 450),
              top: 600 - t * 700,
              width: 120,
              height: 60,
              borderRadius: 8,
              background: '#16a34a',
              border: '3px solid #86efac',
              opacity: Math.max(0, 0.55 * (1 - t)),
              transform: `rotate(${t * 200 + j * 20}deg)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 32,
              color: '#dcfce7',
            }}
          >
            $
          </div>
        );
      })}
      {k.likovi?.[0] && (
        <Uskoci delay={0}>
          <Osoba l={k.likovi[0]} size={180} />
        </Uskoci>
      )}
      {k.naslov && <div style={{ fontWeight: 800, fontSize: 44, letterSpacing: 6, color: C.soft, textAlign: 'center' }}>{k.naslov.toUpperCase()}</div>}
      <div style={{ fontWeight: 800, fontSize: (tekst ?? '').length > 7 ? 150 : 190, color: boja, letterSpacing: -6, fontVariantNumeric: 'tabular-nums' }}>{tekst}</div>
      {k.pecat && <Pecat text={k.pecat} delay={Math.round(trajanje * 0.7)} size={90} color={C.amber} rotate={-4} />}
    </Centar>
  );
};

const Tekst: React.FC<{ k: Kartica }> = ({ k }) => (
  <Centar gap={44}>
    {k.likovi?.[0] && (
      <Uskoci delay={0}>
        <Osoba l={k.likovi[0]} size={260} />
      </Uskoci>
    )}
    {k.tekst && <Natpis text={k.tekst} delay={10} />}
    {k.podtekst && <div style={{ fontWeight: 600, fontSize: 38, color: C.muted, textAlign: 'center' }}>{k.podtekst}</div>}
    {k.pecat && <Pecat text={k.pecat} delay={26} size={80} rotate={-5} />}
  </Centar>
);

const Reflektor: React.FC<{ k: Kartica }> = ({ k }) => {
  const f = useCurrentFrame();
  const s = useUlaz(0, { damping: 30, stiffness: 60, mass: 1 });
  const svetlo = interpolate(f, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const glavni = k.likovi?.[0] ?? { id: 'anthropic' };
  return (
    <Centar gap={40}>
      <div
        style={{
          position: 'absolute',
          top: -100,
          left: 240,
          width: 600,
          height: 900,
          background: 'linear-gradient(180deg, rgba(251,191,36,0.0), rgba(251,191,36,0.18))',
          clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
          opacity: svetlo,
        }}
      />
      <div style={{ transform: `translateX(${(1 - s) * 500}px)` }}>
        <Osoba l={{ raspolozenje: 'sly', ...glavni }} size={290} pogled={-1} />
      </div>
      {k.tekst && <Natpis text={k.tekst} delay={30} border={C.amber} />}
      {k.podtekst && (
        <div style={{ fontWeight: 600, fontSize: 38, color: C.muted, opacity: interpolate(f, [55, 70], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>{k.podtekst}</div>
      )}
    </Centar>
  );
};

const Mera: React.FC<{ k: Kartica; trajanje: number }> = ({ k, trajanje }) => {
  const f = useCurrentFrame();
  const cilj = -70 + 140 * Math.max(0, Math.min(1, k.vrednost ?? 0.85));
  const ugao = interpolate(f, [0, trajanje * 0.5], [-70, cilj], { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) }) + (f > trajanje * 0.5 ? Math.sin(f * 1.4) * 4 : 0);
  return (
    <Centar gap={40}>
      <div style={{ fontWeight: 800, fontSize: 44, letterSpacing: 6, color: C.soft, textAlign: 'center' }}>{(k.naslov ?? '').toUpperCase()}</div>
      <svg viewBox="0 0 600 340" width={760}>
        <path d="M 60 300 A 240 240 0 0 1 300 60" stroke={C.green} strokeWidth="40" fill="none" />
        <path d="M 300 60 A 240 240 0 0 1 470 130" stroke={C.amber} strokeWidth="40" fill="none" />
        <path d="M 470 130 A 240 240 0 0 1 540 300" stroke={C.red} strokeWidth="40" fill="none" />
        <text x="60" y="335" fill={C.muted} fontSize="28" fontWeight={800} fontFamily="Inter">{(k.levo ?? 'LOW').toUpperCase()}</text>
        <text x="540" y="335" textAnchor="end" fill={C.red} fontSize="28" fontWeight={800} fontFamily="Inter">{(k.desno ?? 'HIGH').toUpperCase()}</text>
        <g transform={`rotate(${ugao} 300 300)`}>
          <line x1="300" y1="300" x2="300" y2="90" stroke={C.text} strokeWidth="14" strokeLinecap="round" />
        </g>
        <circle cx="300" cy="300" r="26" fill={C.text} />
      </svg>
      {k.tekst && <Natpis text={k.tekst} delay={Math.round(trajanje * 0.35)} />}
    </Centar>
  );
};

const Sucelje: React.FC<{ k: Kartica }> = ({ k }) => {
  const f = useCurrentFrame();
  const puls = 1 + Math.sin(f / 4) * 0.08;
  const likovi = (k.likovi?.length ? k.likovi : [{ id: 'openai' }, { id: 'google' }, { id: 'anthropic' }]).slice(0, 3);
  return (
    <Centar gap={40}>
      <div style={{ display: 'flex', gap: 30, alignItems: 'flex-end' }}>
        <Uskoci delay={0}>
          <Osoba l={likovi[0]} size={200} pogled={1} />
        </Uskoci>
        <div style={{ fontWeight: 800, fontSize: 200, color: C.amber, transform: `scale(${puls})`, lineHeight: 1, marginBottom: 80 }}>?</div>
        {likovi[1] && (
          <Uskoci delay={4}>
            <Osoba l={likovi[1]} size={200} pogled={-1} />
          </Uskoci>
        )}
      </div>
      {likovi[2] && (
        <Uskoci delay={8}>
          <Osoba l={likovi[2]} size={200} />
        </Uskoci>
      )}
      {k.pecat && <Pecat text={k.pecat} delay={20} size={70} color={C.amber} rotate={-3} />}
    </Centar>
  );
};

const Prati: React.FC = () => {
  const f = useCurrentFrame();
  const klik = f > 22 && f < 30;
  const s = useUlaz(0, { damping: 10, stiffness: 160, mass: 0.6 });
  const strelica = interpolate(f, [0, 20], [260, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const prati = f >= 26;
  return (
    <Centar gap={40}>
      <div style={{ position: 'relative', transform: `scale(${(0.6 + 0.4 * s) * (klik ? 0.92 : 1)})` }}>
        <div
          style={{
            fontWeight: 800,
            fontSize: 96,
            color: prati ? C.text : C.bg,
            background: prati ? '#1e293b' : C.amber,
            border: `3px solid ${C.amber}`,
            borderRadius: 999,
            padding: '30px 90px',
            boxShadow: `0 0 80px rgba(251,191,36,${prati ? 0.2 : 0.5})`,
          }}
        >
          {prati ? 'Following ✓' : 'Follow'}
        </div>
        <svg viewBox="0 0 40 50" width={90} style={{ position: 'absolute', right: -30, bottom: -60, transform: `translate(${strelica}px, ${strelica}px)` }}>
          <path d="M 4 2 L 4 40 L 14 31 L 21 46 L 28 43 L 21 28 L 34 28 Z" fill="#fff" stroke="#020617" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ fontWeight: 800, fontSize: 48, color: C.soft, marginTop: 30 }}>
        New episode <span style={{ color: C.amber }}>every day</span>
      </div>
    </Centar>
  );
};
