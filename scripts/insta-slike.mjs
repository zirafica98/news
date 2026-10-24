// Pravi slike za Instagram karusel iz engleskog izdanja: public/insta/YYYY-MM-DD-N.jpg (1080×1350).
// Naslovna, pet glavnih vesti i završna. Slike idu na sajt zajedno sa izdanjem,
// jer Instagram sliku preuzima sa javnog URL-a (vidi objavi-instagram.mjs).
//
// Pokretanje: node scripts/insta-slike.mjs
//             node scripts/insta-slike.mjs --datum=2026-10-24

import { readFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { DATA_DIR, PUBLIC_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson } from './lib.mjs';

export const INSTA_DIR = join(PUBLIC_DIR, 'insta');
const SIRINA = 1080;
const VISINA = 1350;
const BROJ_VESTI = 5;

const BOJE = {
  pozadina: '#020617',
  kartica: '#0f172a',
  ivica: '#1e293b',
  tekst: '#f8fafc',
  sporedno: '#94a3b8',
  akcenat: '#fbbf24',
};

const KATEGORIJE = {
  modeli: 'Models',
  alati: 'Tools',
  kompanije: 'Companies',
  istrazivanje: 'Research',
  bezbednost: 'Safety',
  regulativa: 'Regulation',
  ostalo: 'Other',
};

/** Vesti za karusel: najvažnije prve, bez domaćih (profil je na engleskom). */
export function izaberiVesti(izdanje) {
  return izdanje.vesti
    .filter((v) => !v.izSrbije)
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v.vaznost - a.v.vaznost || a.i - b.i)
    .slice(0, BROJ_VESTI)
    .map(({ v }) => v);
}

export function lepDatum(datum) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${datum}T00:00:00Z`),
  );
}

/** Skraćuje na cele rečenice; ako je i prva preduga, seče na reči. */
export function skrati(tekst, max) {
  if (tekst.length <= max) return tekst;
  let rez = '';
  // Kraj rečenice je tačka pa razmak i veliko slovo, da se „Opus 5.5“ ne bi seklo na „5.“.
  for (const recenica of tekst.split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/)) {
    if (`${rez} ${recenica}`.trim().length > max) break;
    rez = `${rez} ${recenica}`;
  }
  if (rez.trim()) return rez.trim();
  return `${tekst.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

const el = (type, style, ...children) => ({
  type,
  props: { style: { display: 'flex', ...style }, children: children.length === 1 ? children[0] : children },
});

function okvir(redniBroj, ukupno, ...sadrzaj) {
  return el(
    'div',
    { width: SIRINA, height: VISINA, boxSizing: 'border-box', flexDirection: 'column', backgroundColor: BOJE.pozadina, color: BOJE.tekst, padding: 80, fontFamily: 'Inter' },
    el(
      'div',
      { justifyContent: 'space-between', alignItems: 'center', fontSize: 28, fontWeight: 600, color: BOJE.sporedno },
      el('div', { color: BOJE.akcenat, letterSpacing: 4 }, 'AI MORNING BRIEF'),
      el('div', {}, `${redniBroj}/${ukupno}`),
    ),
    el('div', { flexDirection: 'column', flexGrow: 1, justifyContent: 'center' }, ...sadrzaj),
    el(
      'div',
      { justifyContent: 'space-between', fontSize: 26, color: BOJE.sporedno, borderTop: `2px solid ${BOJE.ivica}`, paddingTop: 32 },
      el('div', {}, '@ai.morning.brief'),
      el('div', {}, redniBroj < ukupno ? 'Swipe »' : ''),
    ),
  );
}

function naslovna(izdanje, vesti, ukupno) {
  return okvir(
    1,
    ukupno,
    el('div', { fontSize: 34, color: BOJE.sporedno, marginBottom: 40 }, lepDatum(izdanje.datum)),
    el('div', { fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginBottom: 56 }, skrati(vesti[0].naslov, 110)),
    el('div', { fontSize: 34, lineHeight: 1.45, color: '#cbd5e1' }, skrati(izdanje.ukratko, 260)),
    el('div', { fontSize: 32, fontWeight: 600, color: BOJE.akcenat, marginTop: 56 }, `Today's top ${vesti.length} in AI »`),
  );
}

function slajdVesti(vest, broj, redniBroj, ukupno) {
  return okvir(
    redniBroj,
    ukupno,
    el(
      'div',
      { alignItems: 'center', marginBottom: 40, fontSize: 28, fontWeight: 600 },
      el('div', { color: BOJE.pozadina, backgroundColor: BOJE.akcenat, borderRadius: 999, padding: '8px 24px', marginRight: 24 }, `#${broj}`),
      el('div', { color: BOJE.sporedno, letterSpacing: 2 }, (KATEGORIJE[vest.kategorija] ?? 'AI').toUpperCase()),
    ),
    el('div', { fontSize: 62, fontWeight: 800, lineHeight: 1.12, marginBottom: 44 }, skrati(vest.naslov, 120)),
    el('div', { fontSize: 34, lineHeight: 1.45, color: '#cbd5e1', marginBottom: 40 }, skrati(vest.staSeDesilo, 330)),
    el(
      'div',
      { flexDirection: 'column', backgroundColor: BOJE.kartica, border: `2px solid ${BOJE.ivica}`, borderRadius: 24, padding: 32 },
      el('div', { fontSize: 24, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 2, marginBottom: 12 }, 'WHY IT MATTERS'),
      el('div', { fontSize: 30, lineHeight: 1.4 }, skrati(vest.zastoJeBitno, 200)),
    ),
  );
}

function zavrsna(redniBroj, ukupno) {
  return okvir(
    redniBroj,
    ukupno,
    el('div', { fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 48 }, 'Want the full brief?'),
    el(
      'div',
      { fontSize: 36, lineHeight: 1.5, color: '#cbd5e1', marginBottom: 56 },
      'New launches with how-to steps, papers of the day, app ideas and token prices. Every morning.',
    ),
    el('div', { fontSize: 36, fontWeight: 600, color: BOJE.akcenat }, 'Link in bio · Follow for tomorrow'),
  );
}

async function fontovi() {
  const dir = join(SCRIPTS_DIR, 'node_modules', '@fontsource', 'inter', 'files');
  const lista = [];
  for (const tezina of [400, 600, 800]) {
    for (const podskup of ['latin', 'latin-ext']) {
      lista.push({ name: 'Inter', weight: tezina, style: 'normal', data: await readFile(join(dir, `inter-${podskup}-${tezina}-normal.woff`)) });
    }
  }
  return lista;
}

/** Napravi slike i vrati njihove putanje redom. */
export async function napraviSlike(datum) {
  const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
  if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum} (public/data/en/${datum}.json).`);

  const vesti = izaberiVesti(izdanje);
  const ukupno = vesti.length + 2;
  const slajdovi = [naslovna(izdanje, vesti, ukupno), ...vesti.map((v, i) => slajdVesti(v, i + 1, i + 2, ukupno)), zavrsna(ukupno, ukupno)];

  await mkdir(INSTA_DIR, { recursive: true });
  for (const f of await readdir(INSTA_DIR)) if (f.startsWith(`${datum}-`)) await rm(join(INSTA_DIR, f));

  const fonts = await fontovi();
  const putanje = [];
  for (const [i, slajd] of slajdovi.entries()) {
    const svg = await satori(slajd, { width: SIRINA, height: VISINA, fonts, embedFont: true });
    const putanja = join(INSTA_DIR, `${datum}-${i + 1}.jpg`);
    await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(putanja);
    putanje.push(putanja);
  }
  return putanje;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datum = datumIzArgumenata();
  const putanje = await napraviSlike(datum);
  console.log(`Instagram slike za ${datum}: ${putanje.length} (public/insta/${datum}-1…${putanje.length}.jpg)`);
}
