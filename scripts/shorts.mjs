// Short v2: za svaku od tri glavne vesti poseban vertikalni video (1080×1920, ~25–35 s) sa glasom i titlovima.
//   udica (naslov vesti, krupno) → šta se desilo (2 rečenice) → zašto je bitno → kraj
// Glas je Kokoro TTS (scripts/tts.py, besplatan, radi lokalno). Titlovi prate glas: svaka rečenica se izgovara
// posebno, a vreme rečenice se deli na delove titla srazmerno broju slova.
//
// Izlaz u public/insta: YYYY-MM-DD-short-N.mp4 i YYYY-MM-DD-shorts.json (naslov, opis i oznaka za YouTube).
// Opisi nemaju link ka sajtu ni izvore.
//
// Pokretanje: node scripts/shorts.mjs [--datum=2026-10-25] [--broj=3]
// Python sa kokoro-onnx: TTS_PYTHON (podrazumevano python3); model: KOKORO_DIR (vidi tts.py).

import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import satori from 'satori';
import sharp from 'sharp';
import { BOJE, INSTA_DIR, KATEGORIJE, el, fontovi, izaberiVesti, skrati } from './insta-slike.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const SIRINA = 1080;
const VISINA = 1920;
// YouTube i Instagram prekrivaju dno (opis, dugmad) i desnu ivicu (lajk, komentar), pa tekst ostaje levo i u sredini.
const PAD = { gore: 220, dole: 380, levo: 80, desno: 170 };
const GLAS = 'af_heart';
const HASHTAGOVI = '#AI #AINews #ArtificialIntelligence #TechNews #Shorts';

/** Pitanje u komentaru ispod Shorta, po temi vesti: komentari dižu doseg. */
const PITANJA = {
  modeli: 'Would you switch to this model? 👇',
  alati: 'Would you try this tool? 👇',
  kompanije: 'Smart move or mistake? 👇',
  istrazivanje: 'Does this change how you build with AI? 👇',
  bezbednost: 'Does this worry you? 👇',
  regulativa: 'Is this the right call? 👇',
  ostalo: 'What do you think? 👇',
};

const kratakDatum = (datum) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${datum}T00:00:00Z`));

/** Markdown znaci iz izdanja (`kod`, **bold**) ne idu ni u titl ni u glas. */
const cist = (t) => t.replace(/[`*]/g, '');

const recenice = (tekst) => cist(tekst).split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/).filter(Boolean);

/** Deli rečenicu na delove titla od najviše ~7 reči, po mogućstvu posle zareza. */
function deloviTitla(recenica, maxReci = 7) {
  const reci = recenica.split(/\s+/);
  const delovi = [];
  let tekuci = [];
  for (const rec of reci) {
    tekuci.push(rec);
    const kraj = /[,;:]$/.test(rec) && tekuci.length >= 3;
    if (tekuci.length >= maxReci || kraj) {
      delovi.push(tekuci.join(' '));
      tekuci = [];
    }
  }
  if (tekuci.length) {
    // Kratak ostatak (1–2 reči) ide uz prethodni deo.
    if (tekuci.length <= 2 && delovi.length) delovi[delovi.length - 1] += ` ${tekuci.join(' ')}`;
    else delovi.push(tekuci.join(' '));
  }
  return delovi;
}

/** Tekst koji se izgovara: brojevi i skraćenice koje TTS čita čudno. */
const zaGlas = (t) => t.replace(/\$(\d+(?:\.\d+)?)/g, '$1 dollars').replace(/\s*\/\s*/g, ' per ').replace(/[“”]/g, '"');

/** Sloj sa tekstom na providnoj pozadini. Pokretna pozadina i traka napretka dodaju se u ffmpeg-u. */
function okvir(...sadrzaj) {
  return el(
    'div',
    {
      width: SIRINA,
      height: VISINA,
      boxSizing: 'border-box',
      flexDirection: 'column',
      color: BOJE.tekst,
      padding: `${PAD.gore}px ${PAD.desno}px ${PAD.dole}px ${PAD.levo}px`,
      fontFamily: 'Inter',
    },
    ...sadrzaj,
  );
}

const zaglavlje = (datum, vest) =>
  el(
    'div',
    { alignItems: 'center', fontSize: 30, fontWeight: 600, marginBottom: 48 },
    el('div', { color: BOJE.akcenat, letterSpacing: 3, marginRight: 24 }, `AI NEWS · ${kratakDatum(datum).toUpperCase()}`),
    el('div', { color: BOJE.pozadina, backgroundColor: BOJE.akcenat, borderRadius: 999, padding: '6px 20px', fontSize: 24 }, (KATEGORIJE[vest.kategorija] ?? 'AI').toUpperCase()),
  );

/** Reči u boji po tome da li su izgovorene (bele), upravo se izgovaraju (žute) ili tek dolaze. */
const reci = (lista, trenutna, velicina, buduce) =>
  el(
    'div',
    { flexWrap: 'wrap', fontSize: velicina, fontWeight: 800, lineHeight: 1.12 },
    ...lista.map((r, i) =>
      el('div', { marginRight: Math.round(velicina * 0.26), color: i < trenutna ? BOJE.tekst : i === trenutna ? BOJE.akcenat : buduce }, r),
    ),
  );

/** „Pop“ pri pojavi novog titla: dva kratka kadra, umanjen i bled pa skoro pun. */
const POP = [
  { sekundi: 0.07, scale: 0.86, opacity: 0.35 },
  { sekundi: 0.07, scale: 0.96, opacity: 0.85 },
];
const efekat = (stablo, e) => (e ? el('div', { transform: `scale(${e.scale})`, opacity: e.opacity }, stablo) : stablo);

/** Najava kao kod voditelja: koja je ovo vest dana. */
const NAJAVE = [
  { glas: "Here's today's biggest AI story.", ekran: "TODAY'S TOP AI STORY" },
  { glas: 'AI story number two for today.', ekran: 'AI STORY OF THE DAY' },
  { glas: 'And one more AI story you should know today.', ekran: 'AI STORY OF THE DAY' },
];

const kadarNajava = (datum, vest, broj, e) =>
  okvir(
    zaglavlje(datum, vest),
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      efekat(
        el(
          'div',
          { flexDirection: 'column' },
          el('div', { fontSize: 260, fontWeight: 800, color: BOJE.akcenat, lineHeight: 1, letterSpacing: -8 }, `#${broj}`),
          el('div', { fontSize: 56, fontWeight: 800, color: BOJE.tekst, letterSpacing: 4, marginTop: 24 }, NAJAVE[broj - 1]?.ekran ?? 'AI STORY OF THE DAY'),
        ),
        e,
      ),
    ),
  );

/** Udica: naslov se pojavljuje reč po reč, kako se izgovara. */
const kadarUdica = (datum, vest, rec, k) =>
  okvir(zaglavlje(datum, vest), el('div', { flexGrow: 1, alignItems: 'center' }, reci(rec, k, 88, 'transparent')));

/** Titl: naslov sitno gore, deo teksta krupno u sredini, sa trenutnom reči istaknutom. */
const kadarTitl = (datum, vest, rec, k, oznaka, e) =>
  okvir(
    zaglavlje(datum, vest),
    el('div', { fontSize: 38, fontWeight: 600, lineHeight: 1.25, color: BOJE.sporedno }, skrati(cist(vest.naslov), 90)),
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      oznaka ? el('div', { fontSize: 30, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 3, marginBottom: 24 }, oznaka) : el('div', {}, ''),
      efekat(reci(rec, k, 76, '#64748b'), e),
    ),
  );

const kadarKraj = (e) =>
  okvir(
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      efekat(
        el(
          'div',
          { flexDirection: 'column' },
          el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.1, marginBottom: 40 }, "Tomorrow's AI news,"),
          el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.1, color: BOJE.akcenat, marginBottom: 56 }, 'in 30 seconds.'),
          el('div', { fontSize: 44, color: '#cbd5e1' }, 'Follow @ai-morning-brief'),
        ),
        e,
      ),
    ),
  );

/** Pozadina veća od ekrana (ffmpeg je polako pomera): tamni gradijent sa mutnim žutim i ljubičastim svetlom. */
async function pozadina(putanja) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2400">
    <defs><filter id="m"><feGaussianBlur stdDeviation="120"/></filter>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="0.6" stop-color="#0b1224"/><stop offset="1" stop-color="#140f2e"/></linearGradient></defs>
    <rect width="1400" height="2400" fill="url(#g)"/>
    <g filter="url(#m)">
      <circle cx="330" cy="650" r="330" fill="#fbbf24" opacity="0.16"/>
      <circle cx="1120" cy="1500" r="420" fill="#7c3aed" opacity="0.22"/>
      <circle cx="420" cy="2050" r="300" fill="#0ea5e9" opacity="0.12"/>
    </g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(putanja);
}

/** Intro „sting“ (~0,9 s): AI znak uleće sa odskokom, ispod se pojavi naziv, pa se sve uveća i nestane. */
const INTRO = { kadrova: 27, fps: 30 };
const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const izmedju = (p, od, do_) => Math.min(1, Math.max(0, (p - od) / (do_ - od)));

function kadarIntro(datum, p) {
  const znak = easeOutBack(izmedju(p, 0, 0.38));
  const tekst = izmedju(p, 0.25, 0.55);
  const izlaz = izmedju(p, 0.8, 1);
  return el(
    'div',
    {
      width: SIRINA,
      height: VISINA,
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter',
      opacity: 1 - izlaz,
      transform: `scale(${1 + 0.18 * izlaz})`,
    },
    el(
      'div',
      {
        width: 300,
        height: 300,
        borderRadius: 72,
        backgroundColor: BOJE.akcenat,
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: `0 0 ${Math.round(160 * znak)}px rgba(251,191,36,0.55)`,
        transform: `scale(${0.35 + 0.65 * znak})`,
        opacity: Math.min(1, znak * 1.5),
      },
      el('div', { fontSize: 170, fontWeight: 800, color: BOJE.pozadina, letterSpacing: -6 }, 'AI'),
    ),
    el(
      'div',
      { flexDirection: 'column', alignItems: 'center', marginTop: 56, opacity: tekst, transform: `translateY(${Math.round(40 * (1 - tekst))}px)` },
      el('div', { fontSize: 64, fontWeight: 800, color: BOJE.tekst, letterSpacing: 12 }, 'MORNING BRIEF'),
      el('div', { fontSize: 32, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 6, marginTop: 20 }, `TODAY · ${kratakDatum(datum).toUpperCase()}`),
    ),
  );
}

/** Deli trajanje na reči srazmerno broju slova. */
const poRecima = (rec, sekundi) => {
  const slova = rec.reduce((z, r) => z + r.length + 1, 0);
  return rec.map((r) => (sekundi * (r.length + 1)) / slova);
};

async function govor(delovi, izlaz) {
  const python = process.env.TTS_PYTHON || 'python3';
  return new Promise((resolve, reject) => {
    const proces = spawn(python, ['-I', join(SCRIPTS_DIR, 'tts.py')], { stdio: ['pipe', 'pipe', 'inherit'] });
    let izlazTekst = '';
    proces.stdout.on('data', (d) => (izlazTekst += d));
    proces.on('error', reject);
    proces.on('close', (kod) => (kod === 0 ? resolve(JSON.parse(izlazTekst)) : reject(new Error(`tts.py je završio sa kodom ${kod}`))));
    proces.stdin.end(JSON.stringify({ izlaz, glas: GLAS, brzina: 1.05, delovi: delovi.map(zaGlas) }));
  });
}

async function napraviShort({ datum, vest, broj, fonts, radni }) {
  // Scenario: svaki red je rečenica koja se izgovara posebno.
  const telo = recenice(skrati(vest.staSeDesilo, 230));
  const zasto = recenice(skrati(vest.zastoJeBitno, 170))[0];
  const scenario = [
    { tip: 'najava', tekst: (NAJAVE[broj - 1] ?? NAJAVE[1]).glas },
    { tip: 'udica', tekst: cist(vest.naslov) },
    ...telo.map((tekst) => ({ tip: 'telo', tekst })),
    { tip: 'zasto', tekst: zasto, izgovor: `Why it matters: ${zasto}` },
    { tip: 'kraj', tekst: "Follow for tomorrow's AI news." },
  ];

  const zvuk = join(radni, `glas-${broj}.wav`);
  const { trajanja, ukupno } = await govor(
    scenario.map((s) => s.izgovor ?? s.tekst),
    zvuk,
  );

  // Kadrovi sa trajanjem: po jedan za svaku reč (karaoke), uz „pop“ kad se pojavi novi titl.
  const kadrovi = [];
  scenario.forEach((s, i) => {
    if (s.tip === 'najava') {
      for (const e of POP) kadrovi.push({ stablo: kadarNajava(datum, vest, broj, e), sekundi: e.sekundi });
      kadrovi.push({ stablo: kadarNajava(datum, vest, broj), sekundi: trajanja[i] - POP.reduce((z, e) => z + e.sekundi, 0) });
      return;
    }
    if (s.tip === 'kraj') {
      for (const e of POP) kadrovi.push({ stablo: kadarKraj(e), sekundi: e.sekundi });
      kadrovi.push({ stablo: kadarKraj(), sekundi: trajanja[i] - POP.reduce((z, e) => z + e.sekundi, 0) });
      return;
    }
    if (s.tip === 'udica') {
      const rec = s.tekst.split(/\s+/);
      poRecima(rec, trajanja[i]).forEach((sekundi, k) => kadrovi.push({ stablo: kadarUdica(datum, vest, rec, k), sekundi }));
      return;
    }
    const delovi = deloviTitla(s.tekst);
    const slova = delovi.reduce((z, d) => z + d.length, 0);
    const oznaka = s.tip === 'zasto' ? 'WHY IT MATTERS' : '';
    for (const deo of delovi) {
      const rec = deo.split(/\s+/);
      poRecima(rec, (trajanja[i] * deo.length) / slova).forEach((sekundi, k) => {
        if (k === 0) {
          // Prva reč novog titla počinje „pop“ kadrovima.
          for (const e of POP) kadrovi.push({ stablo: kadarTitl(datum, vest, rec, 0, oznaka, e), sekundi: e.sekundi });
          sekundi -= POP.reduce((z, e) => z + e.sekundi, 0);
        }
        if (sekundi > 0.01) kadrovi.push({ stablo: kadarTitl(datum, vest, rec, k, oznaka), sekundi });
      });
    }
  });

  // Intro ide pre glasa; glas i traka napretka kreću posle njega.
  const introSekundi = INTRO.kadrova / INTRO.fps;
  kadrovi.unshift(...Array.from({ length: INTRO.kadrova }, (_, i) => ({ stablo: kadarIntro(datum, i / (INTRO.kadrova - 1)), sekundi: 1 / INTRO.fps })));

  const lista = [];
  for (const [i, k] of kadrovi.entries()) {
    const slika = join(radni, `k-${broj}-${String(i).padStart(4, '0')}.png`);
    await sharp(Buffer.from(await satori(k.stablo, { width: SIRINA, height: VISINA, fonts }))).png().toFile(slika);
    lista.push(`file '${slika}'`, `duration ${k.sekundi.toFixed(3)}`);
  }
  // concat demuxer ne poštuje trajanje poslednje stavke ako se ne ponovi.
  lista.push(lista.at(-2));
  const spisak = join(radni, `spisak-${broj}.txt`);
  await writeFile(spisak, `${lista.join('\n')}\n`);

  const pozadinaSlika = join(radni, 'pozadina.png');
  await pozadina(pozadinaSlika);

  // Pozadina pluta (crop koji se pomera po sinusu), tekst ide preko nje, a traka napretka raste glatko.
  const bar = { x: PAD.levo, y: VISINA - PAD.dole + 50, w: SIRINA - PAD.levo - PAD.desno };
  const trajanje = (ukupno + introSekundi + 0.3).toFixed(2);
  const filter = [
    `[0:v]crop=${SIRINA}:${VISINA}:x='(iw-${SIRINA})/2+80*sin(t*0.33)':y='(ih-${VISINA})/2+120*sin(t*0.25)',setsar=1[bg]`,
    `[1:v]fps=30,format=rgba[tekst]`,
    // Žuta traka klizi preko sive i odseca se na njenim ivicama.
    `color=c=0x1e293b:s=${bar.w}x10:r=30:d=${trajanje}[staza]`,
    `color=c=0xfbbf24:s=${bar.w}x10:r=30:d=${trajanje}[puna]`,
    `[staza][puna]overlay=x='-overlay_w+overlay_w*min(max(t-${introSekundi},0)/${ukupno},1)':y=0[traka]`,
    `[bg][tekst]overlay=0:0:shortest=1[slika]`,
    `[slika][traka]overlay=${bar.x}:${bar.y}:shortest=1,format=yuv420p[v]`,
    // Glas kreće posle intra; ispod intra tih „whoosh“ od filtriranog šuma.
    `[2:a]adelay=${Math.round(introSekundi * 1000)}:all=1,aformat=sample_rates=24000:channel_layouts=mono[glas]`,
    `anoisesrc=d=0.8:c=pink:r=24000:a=0.6,highpass=f=300,lowpass=f=2500,afade=t=in:d=0.3,afade=t=out:st=0.35:d=0.45,volume=0.35[whoosh]`,
    `[glas][whoosh]amix=inputs=2:duration=first:normalize=0[a]`,
  ].join(';');

  const video = join(INSTA_DIR, `${datum}-short-${broj}.mp4`);
  await promisify(execFile)(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-loop', '1', '-framerate', '30', '-t', trajanje, '-i', pozadinaSlika,
    '-f', 'concat', '-safe', '0', '-i', spisak,
    '-i', zvuk,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
    '-shortest', '-movflags', '+faststart',
    video,
  ]);

  const oznaka = `AI Morning Brief · ${datum} · ${broj}`;
  const opis = [
    skrati(vest.staSeDesilo, 300),
    `Why it matters: ${zasto}`,
    'Daily AI news in 30 seconds. Subscribe for tomorrow’s brief.\nInstagram & Threads: @ai.morning.brief · Telegram: AI Morning Brief',
    HASHTAGOVI,
    oznaka,
  ].join('\n\n');
  return {
    fajl: `${datum}-short-${broj}.mp4`,
    naslov: skrati(cist(vest.naslov), 95),
    opis,
    oznaka,
    plejlista: 'AI News in 30 Seconds',
    pitanje: PITANJA[vest.kategorija] ?? PITANJA.ostalo,
    sekundi: Math.round(ukupno + introSekundi),
  };
}

export async function napraviShortove(datum, broj = 3) {
  const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
  if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
  for (const f of await readdir(INSTA_DIR).catch(() => [])) {
    if (f.startsWith(`${datum}-short-`) || f === `${datum}-shorts.json`) await rm(join(INSTA_DIR, f));
  }

  const fonts = await fontovi();
  const radni = await mkdtemp(join(tmpdir(), 'ai-shorts-'));
  try {
    const shortovi = [];
    for (const [i, vest] of izaberiVesti(izdanje).slice(0, broj).entries()) {
      shortovi.push(await napraviShort({ datum, vest, broj: i + 1, fonts, radni }));
    }
    await writeJson(join(INSTA_DIR, `${datum}-shorts.json`), shortovi);
    return shortovi;
  } finally {
    await rm(radni, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datum = datumIzArgumenata();
  const broj = Number(process.argv.find((a) => a.startsWith('--broj='))?.split('=')[1] ?? 3);
  const shortovi = await napraviShortove(datum, broj);
  console.log(`Shorts za ${datum}: ${shortovi.map((s) => `${s.fajl} (${s.sekundi} s)`).join(', ')}`);
}
