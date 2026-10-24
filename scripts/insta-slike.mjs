// Pravi slike za Instagram iz engleskog izdanja, u public/insta:
//   YYYY-MM-DD-N.jpg        karusel 1080×1350 (naslovna, pet glavnih vesti, završna)
//   YYYY-MM-DD-story-N.jpg  isti slajdovi u 1080×1920 za story
//   YYYY-MM-DD-reel.mp4     subotom (kad izdanje ima nedeljni pregled): video bez zvuka za Reel, rekapitulacija nedelje
// Sve ide na sajt zajedno sa izdanjem, jer Instagram slike i video preuzima sa javnog URL-a (vidi objavi-instagram.mjs).
//
// Pokretanje: node scripts/insta-slike.mjs
//             node scripts/insta-slike.mjs --datum=2026-10-24

import { execFile } from 'node:child_process';
import { readFile, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import satori from 'satori';
import sharp from 'sharp';
import { DATA_DIR, PUBLIC_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson } from './lib.mjs';

export const INSTA_DIR = join(PUBLIC_DIR, 'insta');
const SIRINA = 1080;
const BROJ_VESTI = 5;

/** Post je 4:5. Story i Reel su 9:16, sa većim praznim prostorom gore i dole jer ga Instagram prekriva dugmićima. */
const FORMATI = {
  post: { visina: 1350, padY: 80, dalje: 'Swipe »' },
  story: { visina: 1920, padY: 230, dalje: 'Tap »' },
  reel: { visina: 1920, padY: 230, dalje: '' },
};

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

function okvir(format, redniBroj, ukupno, ...sadrzaj) {
  return el(
    'div',
    {
      width: SIRINA,
      height: format.visina,
      boxSizing: 'border-box',
      flexDirection: 'column',
      backgroundColor: BOJE.pozadina,
      color: BOJE.tekst,
      padding: `${format.padY}px 80px`,
      fontFamily: 'Inter',
    },
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
      el('div', {}, redniBroj < ukupno ? format.dalje : ''),
    ),
  );
}

function naslovna(format, izdanje, vesti, ukupno) {
  return okvir(
    format,
    1,
    ukupno,
    el('div', { fontSize: 34, color: BOJE.sporedno, marginBottom: 40 }, lepDatum(izdanje.datum)),
    el('div', { fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginBottom: 56 }, skrati(vesti[0].naslov, 110)),
    el('div', { fontSize: 34, lineHeight: 1.45, color: '#cbd5e1' }, skrati(izdanje.ukratko, 260)),
    el('div', { fontSize: 32, fontWeight: 600, color: BOJE.akcenat, marginTop: 56 }, `Today's top ${vesti.length} in AI »`),
  );
}

function slajdVesti(format, vest, broj, redniBroj, ukupno) {
  return okvir(
    format,
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

function zavrsna(format, redniBroj, ukupno) {
  return okvir(
    format,
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

/** Prvi i poslednji dan nedelje čiji je pregled u subotnjem izdanju: „October 18–24, 2026“. */
export function opsegNedelje(datum) {
  const kraj = new Date(`${datum}T00:00:00Z`);
  const pocetak = new Date(kraj.getTime() - 6 * 86_400_000);
  const mesec = (d) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(d);
  const dan = (d) => d.getUTCDate();
  return mesec(pocetak) === mesec(kraj)
    ? `${mesec(pocetak)} ${dan(pocetak)}–${dan(kraj)}, ${kraj.getUTCFullYear()}`
    : `${mesec(pocetak)} ${dan(pocetak)} – ${mesec(kraj)} ${dan(kraj)}, ${kraj.getUTCFullYear()}`;
}

/** Slajdovi za nedeljni Reel, sa trajanjem u sekundama. */
function slajdoviNedelje(izdanje) {
  const f = FORMATI.reel;
  const { ukratko, tacke } = izdanje.nedeljni;
  const ukupno = tacke.length + 3;
  return [
    {
      sekundi: 3,
      slajd: okvir(
        f,
        1,
        ukupno,
        el('div', { fontSize: 36, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 4, marginBottom: 40 }, 'WEEKLY RECAP'),
        el('div', { fontSize: 96, fontWeight: 800, lineHeight: 1.05, marginBottom: 48 }, 'This week in AI'),
        el('div', { fontSize: 40, color: BOJE.sporedno }, opsegNedelje(izdanje.datum)),
      ),
    },
    {
      sekundi: 7,
      slajd: okvir(
        f,
        2,
        ukupno,
        el('div', { fontSize: 30, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 3, marginBottom: 40 }, 'IN SHORT'),
        el('div', { fontSize: 48, lineHeight: 1.35 }, skrati(ukratko, 420)),
      ),
    },
    ...tacke.map((tacka, i) => {
      // Tačke su oblika „Naslov: objašnjenje“, pa naslov ide krupno.
      const dvotacka = tacka.indexOf(': ');
      const naslov = dvotacka > 0 && dvotacka < 120 ? tacka.slice(0, dvotacka) : '';
      const telo = naslov ? tacka.slice(dvotacka + 2) : tacka;
      return {
        sekundi: 7,
        slajd: okvir(
          f,
          i + 3,
          ukupno,
          el(
            'div',
            { alignItems: 'center', marginBottom: 48, fontSize: 32, fontWeight: 600 },
            el('div', { color: BOJE.pozadina, backgroundColor: BOJE.akcenat, borderRadius: 999, padding: '10px 28px' }, `${i + 1}/${tacke.length}`),
          ),
          naslov ? el('div', { fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginBottom: 48 }, naslov) : el('div', {}, ''),
          el('div', { fontSize: 44, lineHeight: 1.4, color: '#cbd5e1' }, skrati(telo.charAt(0).toUpperCase() + telo.slice(1), 300)),
        ),
      };
    }),
    {
      sekundi: 3,
      slajd: okvir(
        f,
        ukupno,
        ukupno,
        el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.1, marginBottom: 48 }, 'See you next week'),
        el('div', { fontSize: 44, lineHeight: 1.4, color: '#cbd5e1', marginBottom: 56 }, 'A new AI brief every morning.'),
        el('div', { fontSize: 44, fontWeight: 600, color: BOJE.akcenat }, 'Follow @ai.morning.brief'),
      ),
    },
  ];
}

async function sacuvajJpeg(slajd, visina, fonts, putanja) {
  const svg = await satori(slajd, { width: SIRINA, height: visina, fonts, embedFont: true });
  await sharp(Buffer.from(svg)).jpeg({ quality: 86, mozjpeg: true }).toFile(putanja);
  return putanja;
}

/** Spaja slike u MP4 (H.264, 30 fps, tihi AAC zvuk) sa kratkim pretapanjem između slajdova. */
async function napraviVideo(kadrovi, putanja) {
  const PRETAPANJE = 0.5;
  const ulazi = kadrovi.flatMap(({ slika, sekundi }) => ['-loop', '1', '-t', String(sekundi), '-framerate', '30', '-i', slika]);
  const filteri = [];
  let prethodni = '[0:v]';
  let pomak = 0;
  for (let i = 1; i < kadrovi.length; i++) {
    pomak += kadrovi[i - 1].sekundi - PRETAPANJE;
    const izlaz = i === kadrovi.length - 1 ? '[v]' : `[x${i}]`;
    filteri.push(`${prethodni}[${i}:v]xfade=transition=fade:duration=${PRETAPANJE}:offset=${pomak.toFixed(2)}${izlaz}`);
    prethodni = izlaz;
  }
  const trajanje = pomak + kadrovi.at(-1).sekundi;
  await promisify(execFile)(ffmpeg, [
    '-y',
    '-loglevel', 'error',
    ...ulazi,
    '-f', 'lavfi', '-t', trajanje.toFixed(2), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', `${filteri.join(';')};[v]format=yuv420p[vf]`,
    '-map', '[vf]', '-map', `${kadrovi.length}:a`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k',
    '-movflags', '+faststart',
    '-t', trajanje.toFixed(2),
    putanja,
  ]);
  return putanja;
}

/** Napravi karusel, story slike i (subotom) Reel. Vraća putanje. */
export async function napraviSlike(datum) {
  const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
  if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum} (public/data/en/${datum}.json).`);

  const vesti = izaberiVesti(izdanje);
  const ukupno = vesti.length + 2;
  const slajdovi = (f) => [naslovna(f, izdanje, vesti, ukupno), ...vesti.map((v, i) => slajdVesti(f, v, i + 1, i + 2, ukupno)), zavrsna(f, ukupno, ukupno)];

  await mkdir(INSTA_DIR, { recursive: true });
  for (const f of await readdir(INSTA_DIR)) if (f.startsWith(`${datum}-`)) await rm(join(INSTA_DIR, f));

  const fonts = await fontovi();
  const karusel = [];
  for (const [i, slajd] of slajdovi(FORMATI.post).entries()) {
    karusel.push(await sacuvajJpeg(slajd, FORMATI.post.visina, fonts, join(INSTA_DIR, `${datum}-${i + 1}.jpg`)));
  }
  const story = [];
  for (const [i, slajd] of slajdovi(FORMATI.story).entries()) {
    story.push(await sacuvajJpeg(slajd, FORMATI.story.visina, fonts, join(INSTA_DIR, `${datum}-story-${i + 1}.jpg`)));
  }

  let reel = null;
  if (izdanje.nedeljni?.tacke?.length) {
    // Kadrovi za video ne idu na sajt, samo gotov MP4.
    const privremeno = await mkdtemp(join(tmpdir(), 'ai-reel-'));
    try {
      const kadrovi = [];
      for (const [i, { slajd, sekundi }] of slajdoviNedelje(izdanje).entries()) {
        kadrovi.push({ sekundi, slika: await sacuvajJpeg(slajd, FORMATI.reel.visina, fonts, join(privremeno, `${i + 1}.jpg`)) });
      }
      reel = await napraviVideo(kadrovi, join(INSTA_DIR, `${datum}-reel.mp4`));
    } finally {
      await rm(privremeno, { recursive: true, force: true });
    }
  }
  return { karusel, story, reel };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datum = datumIzArgumenata();
  const { karusel, story, reel } = await napraviSlike(datum);
  console.log(`Instagram za ${datum}: karusel ${karusel.length}, story ${story.length}${reel ? ', nedeljni Reel' : ''} (public/insta/${datum}-…)`);
}
