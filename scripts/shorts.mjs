// YouTube video serije sa glasom (Kokoro TTS) i animiranim titlovima, iz istog motora:
//   vesti      3 Shorta dnevno, po jedna glavna vest
//   alat       „Try this AI tool“: alat iz „Novo izašlo“ sa koracima (svaki dan osim subote)
//   ideja      „App idea of the day“ (ponedeljak, sreda, petak)
//   cene       „Cheapest AI models this week“ (nedelja)
//   nedelja    „This week in AI“ Short i dugi video 16:9 sa poglavljima (subota, iz nedeljnog pregleda)
// Najviše 5 videa dnevno, jer YouTube API kvota (10.000 jedinica) staje oko 5 uploada sa plejlistom i komentarom.
//
// Svaki video: intro sting → najava → udica (kuca se reč po reč) → delovi sa karaoke titlovima → kraj.
// Glas je Kokoro TTS (scripts/tts.py, besplatan, radi lokalno); svaka rečenica se izgovara posebno, a njeno
// vreme se deli na reči srazmerno broju slova, da titlovi prate glas.
//
// Izlaz u public/insta: YYYY-MM-DD-short-<id>.mp4, YYYY-MM-DD-dugi-nedelja.mp4 i YYYY-MM-DD-shorts.json
// (naslov, opis, oznaka, plejlista i pitanje za YouTube). Opisi nemaju link ka sajtu ni izvore.
//
// Pokretanje: node scripts/shorts.mjs [--datum=2026-10-25] [--samo=vesti,alat]
// Python sa kokoro-onnx: TTS_PYTHON (podrazumevano python3); model: KOKORO_DIR (vidi tts.py).

import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import satori from 'satori';
import sharp from 'sharp';
import { BOJE, INSTA_DIR, KATEGORIJE, el, fontovi, izaberiVesti, opsegNedelje, skrati } from './insta-slike.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

/**
 * Formati: Short je uspravan; YouTube i Instagram prekrivaju dno (opis, dugmad) i desnu ivicu (lajk, komentar),
 * pa tekst ostaje levo i u sredini. Dugi video je 16:9 sa ravnomernim marginama.
 */
const FORMATI = {
  short: { w: 1080, h: 1920, pad: { gore: 220, dole: 380, levo: 80, desno: 170 }, reci: 7, udica: 88, titl: 76, mali: 38 },
  dugi: { w: 1920, h: 1080, pad: { gore: 90, dole: 150, levo: 160, desno: 160 }, reci: 10, udica: 80, titl: 68, mali: 34 },
};
const GLAS = 'af_heart';
const HASHTAGOVI = '#AI #AINews #ArtificialIntelligence #TechNews #Shorts';
const DRUSTVENE = 'Instagram & Threads: @ai.morning.brief · Telegram: AI Morning Brief';

/** Pitanje u komentaru ispod vesti, po temi: komentari dižu doseg. */
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
const danUNedelji = (datum) => new Date(`${datum}T00:00:00Z`).getUTCDay(); // 0 = nedelja
const imeDana = (datum) => new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${datum}T00:00:00Z`));

/** Markdown znaci iz izdanja (`kod`, **bold**) ne idu ni u titl ni u glas. */
const cist = (t) => t.replace(/[`*]/g, '');
const recenice = (tekst) => cist(tekst).split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/).filter(Boolean);
const prvaRecenica = (tekst, max = 170) => recenice(skrati(cist(tekst), max))[0] ?? skrati(cist(tekst), max);
/** „Naslov: objašnjenje“ → naslov (za tačke nedeljnog pregleda). */
const naslovTacke = (t) => {
  const i = t.indexOf(': ');
  return i > 0 && i < 120 ? t.slice(0, i) : skrati(t, 100);
};
const telTacke = (t) => {
  const i = t.indexOf(': ');
  const telo = i > 0 && i < 120 ? t.slice(i + 2) : t;
  return telo.charAt(0).toUpperCase() + telo.slice(1);
};

/** Deli rečenicu na delove titla od najviše maxReci reči, po mogućstvu posle zareza. */
function deloviTitla(recenica, maxReci) {
  const delovi = [];
  let tekuci = [];
  for (const rec of recenica.split(/\s+/)) {
    tekuci.push(rec);
    if (tekuci.length >= maxReci || (/[,;:]$/.test(rec) && tekuci.length >= 3)) {
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

/** Tekst koji se izgovara: znaci i skraćenice koje TTS čita čudno. */
const zaGlas = (t) =>
  cist(t)
    .replace(/\$(\d+(?:\.\d+)?)/g, '$1 dollars')
    .replace(/(\d)\s*\/\s*(\d)/g, '$1 to $2')
    .replace(/\s*\/\s*/g, ' or ')
    .replace(/[“”]/g, '"')
    .replace(/~\//g, 'home folder ');

// ───────────────────────────── kadrovi ─────────────────────────────

const okvir = (f, ...sadrzaj) =>
  el(
    'div',
    {
      width: f.w,
      height: f.h,
      boxSizing: 'border-box',
      flexDirection: 'column',
      color: BOJE.tekst,
      padding: `${f.pad.gore}px ${f.pad.desno}px ${f.pad.dole}px ${f.pad.levo}px`,
      fontFamily: 'Inter',
    },
    ...sadrzaj,
  );

const zaglavlje = (z) =>
  el(
    'div',
    { alignItems: 'center', fontSize: 30, fontWeight: 600, marginBottom: 40 },
    el('div', { color: BOJE.akcenat, letterSpacing: 3, marginRight: 24 }, z.levo),
    z.pill ? el('div', { color: BOJE.pozadina, backgroundColor: BOJE.akcenat, borderRadius: 999, padding: '6px 20px', fontSize: 24 }, z.pill) : el('div', {}, ''),
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
const POP_SEKUNDI = POP.reduce((z, e) => z + e.sekundi, 0);
const efekat = (stablo, e) => (e ? el('div', { transform: `scale(${e.scale})`, opacity: e.opacity }, stablo) : stablo);

const kadarNajava = (f, v, e) =>
  okvir(
    f,
    zaglavlje(v.zaglavlje),
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      efekat(
        el(
          'div',
          { flexDirection: 'column' },
          el('div', { fontSize: v.najava.veliko.length <= 3 ? 260 : 150, fontWeight: 800, color: BOJE.akcenat, lineHeight: 1, letterSpacing: -6 }, v.najava.veliko),
          el('div', { fontSize: 56, fontWeight: 800, color: BOJE.tekst, letterSpacing: 4, marginTop: 24 }, v.najava.ekran),
        ),
        e,
      ),
    ),
  );

const kadarUdica = (f, v, rec, k) =>
  okvir(f, zaglavlje(v.zaglavlje), el('div', { flexGrow: 1, alignItems: 'center' }, reci(rec, k, f.udica, 'transparent')));

const kadarTitl = (f, v, rec, k, oznaka, e, mali) =>
  okvir(
    f,
    zaglavlje(v.zaglavlje),
    el('div', { fontSize: f.mali, fontWeight: 600, lineHeight: 1.25, color: BOJE.sporedno }, skrati(cist(mali ?? v.maliNaslov), 90)),
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      oznaka ? el('div', { fontSize: 30, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 3, marginBottom: 24 }, oznaka) : el('div', {}, ''),
      efekat(reci(rec, k, f.titl, '#64748b'), e),
    ),
  );

const kadarKraj = (f, v, e) =>
  okvir(
    f,
    el(
      'div',
      { flexGrow: 1, flexDirection: 'column', justifyContent: 'center' },
      efekat(
        el(
          'div',
          { flexDirection: 'column' },
          el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.1, marginBottom: 40 }, v.kraj.red1),
          el('div', { fontSize: 84, fontWeight: 800, lineHeight: 1.1, color: BOJE.akcenat, marginBottom: 56 }, v.kraj.red2),
          el('div', { fontSize: 44, color: '#cbd5e1' }, 'Follow @ai-morning-brief'),
        ),
        e,
      ),
    ),
  );

/** Intro „sting“ (~0,9 s): AI znak uleće sa odskokom, ispod se pojavi naziv, pa se sve uveća i nestane. */
const INTRO = { kadrova: 27, fps: 30 };
const INTRO_SEKUNDI = INTRO.kadrova / INTRO.fps;
const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;
const izmedju = (p, od, do_) => Math.min(1, Math.max(0, (p - od) / (do_ - od)));

function kadarIntro(f, natpis, p) {
  const znak = easeOutBack(izmedju(p, 0, 0.38));
  const tekst = izmedju(p, 0.25, 0.55);
  const izlaz = izmedju(p, 0.8, 1);
  return el(
    'div',
    { width: f.w, height: f.h, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter', opacity: 1 - izlaz, transform: `scale(${1 + 0.18 * izlaz})` },
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
      el('div', { fontSize: 32, fontWeight: 600, color: BOJE.akcenat, letterSpacing: 6, marginTop: 20 }, natpis),
    ),
  );
}

/** Pozadina veća od ekrana (ffmpeg je polako pomera): tamni gradijent sa mutnim žutim, ljubičastim i plavim svetlom. */
async function pozadina(f, putanja) {
  const w = Math.round(f.w * 1.3);
  const h = Math.round(f.h * 1.25);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><filter id="m"><feGaussianBlur stdDeviation="120"/></filter>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#020617"/><stop offset="0.6" stop-color="#0b1224"/><stop offset="1" stop-color="#140f2e"/></linearGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#g)"/>
    <g filter="url(#m)">
      <circle cx="${w * 0.24}" cy="${h * 0.27}" r="${Math.min(w, h) * 0.24}" fill="#fbbf24" opacity="0.16"/>
      <circle cx="${w * 0.8}" cy="${h * 0.62}" r="${Math.min(w, h) * 0.3}" fill="#7c3aed" opacity="0.22"/>
      <circle cx="${w * 0.3}" cy="${h * 0.85}" r="${Math.min(w, h) * 0.21}" fill="#0ea5e9" opacity="0.12"/>
    </g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(putanja);
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

const vreme = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * Pravi jedan video po scenariju v:
 *   { id, format, natpis, zaglavlje: {levo, pill}, maliNaslov, najava: {glas, veliko, ekran}, udica,
 *     delovi: [{ tekst, izgovor?, oznaka?, poglavlje? }], kraj: {glas, red1, red2}, meta: {...} }
 * Vraća meta za YouTube; za dugi video u opis dodaje poglavlja sa vremenima.
 */
async function napraviVideo(datum, v, fonts, radni) {
  const f = FORMATI[v.format ?? 'short'];
  const scenario = [
    { tip: 'najava', izgovor: v.najava.glas },
    // Udica mora da stane na ekran i da se izgovori za 2–4 sekunde.
    { tip: 'udica', tekst: skrati(cist(v.udica), 100) },
    ...v.delovi.flatMap((d) => {
      // Dugačak deo se izgovara rečenicu po rečenicu, da titl ne zaostaje.
      const r = recenice(d.tekst);
      // Kod dugog videa sitni naslov gore prati poglavlje.
      return r.map((tekst, i) => ({ tip: 'deo', tekst, oznaka: d.oznaka, mali: d.poglavlje, poglavlje: i === 0 ? d.poglavlje : undefined, izgovor: i === 0 && d.izgovor ? d.izgovor : undefined }));
    }),
    { tip: 'kraj', izgovor: v.kraj.glas },
  ];

  const zvuk = join(radni, `glas-${v.id}.wav`);
  const { trajanja, ukupno } = await govor(
    scenario.map((s) => s.izgovor ?? s.tekst),
    zvuk,
  );

  // Kadrovi sa trajanjem: po jedan za svaku reč (karaoke), uz „pop“ kad se pojavi novi titl.
  const kadrovi = Array.from({ length: INTRO.kadrova }, (_, i) => ({ stablo: kadarIntro(f, v.natpis, i / (INTRO.kadrova - 1)), sekundi: 1 / INTRO.fps }));
  const poglavlja = [];
  let proteklo = INTRO_SEKUNDI;
  scenario.forEach((s, i) => {
    if (s.poglavlje) poglavlja.push({ od: proteklo, naziv: s.poglavlje });
    proteklo += trajanja[i];
    if (s.tip === 'najava' || s.tip === 'kraj') {
      const kadar = s.tip === 'najava' ? (e) => kadarNajava(f, v, e) : (e) => kadarKraj(f, v, e);
      for (const e of POP) kadrovi.push({ stablo: kadar(e), sekundi: e.sekundi });
      kadrovi.push({ stablo: kadar(), sekundi: trajanja[i] - POP_SEKUNDI });
      return;
    }
    if (s.tip === 'udica') {
      const rec = s.tekst.split(/\s+/);
      poRecima(rec, trajanja[i]).forEach((sekundi, k) => kadrovi.push({ stablo: kadarUdica(f, v, rec, k), sekundi }));
      return;
    }
    // Ako se izgovara drugačije od teksta (npr. „Step 1:“ ispred), vreme ide samo na tekst koji se vidi.
    const delovi = deloviTitla(s.tekst, f.reci);
    const slova = delovi.reduce((z, d) => z + d.length, 0);
    for (const deo of delovi) {
      const rec = deo.split(/\s+/);
      poRecima(rec, (trajanja[i] * deo.length) / slova).forEach((sekundi, k) => {
        if (k === 0) {
          for (const e of POP) kadrovi.push({ stablo: kadarTitl(f, v, rec, 0, s.oznaka, e, s.mali), sekundi: e.sekundi });
          sekundi -= POP_SEKUNDI;
        }
        if (sekundi > 0.01) kadrovi.push({ stablo: kadarTitl(f, v, rec, k, s.oznaka, undefined, s.mali), sekundi });
      });
    }
  });

  const lista = [];
  for (const [i, k] of kadrovi.entries()) {
    const slika = join(radni, `k-${v.id}-${String(i).padStart(5, '0')}.png`);
    await sharp(Buffer.from(await satori(k.stablo, { width: f.w, height: f.h, fonts }))).png().toFile(slika);
    lista.push(`file '${slika}'`, `duration ${k.sekundi.toFixed(3)}`);
  }
  // concat demuxer ne poštuje trajanje poslednje stavke ako se ne ponovi.
  lista.push(lista.at(-2));
  const spisak = join(radni, `spisak-${v.id}.txt`);
  await writeFile(spisak, `${lista.join('\n')}\n`);

  const pozadinaSlika = join(radni, `pozadina-${v.format ?? 'short'}.png`);
  await pozadina(f, pozadinaSlika);

  // Pozadina pluta (crop koji se pomera po sinusu), tekst ide preko nje, a traka napretka klizi preko sive staze.
  const bar = { x: f.pad.levo, y: f.h - f.pad.dole + 50, w: f.w - f.pad.levo - f.pad.desno };
  const trajanje = (ukupno + INTRO_SEKUNDI + 0.3).toFixed(2);
  const pomakX = Math.round(f.w * 0.07);
  const pomakY = Math.round(f.h * 0.06);
  const filter = [
    `[0:v]crop=${f.w}:${f.h}:x='(iw-${f.w})/2+${pomakX}*sin(t*0.33)':y='(ih-${f.h})/2+${pomakY}*sin(t*0.25)',setsar=1[bg]`,
    `[1:v]fps=30,format=rgba[tekst]`,
    `color=c=0x1e293b:s=${bar.w}x10:r=30:d=${trajanje}[staza]`,
    `color=c=0xfbbf24:s=${bar.w}x10:r=30:d=${trajanje}[puna]`,
    `[staza][puna]overlay=x='-overlay_w+overlay_w*min(max(t-${INTRO_SEKUNDI},0)/${ukupno},1)':y=0[traka]`,
    `[bg][tekst]overlay=0:0:shortest=1[slika]`,
    `[slika][traka]overlay=${bar.x}:${bar.y}:shortest=1,format=yuv420p[v]`,
    // Glas kreće posle intra; ispod intra tih „whoosh“ od filtriranog šuma.
    `[2:a]adelay=${Math.round(INTRO_SEKUNDI * 1000)}:all=1,aformat=sample_rates=24000:channel_layouts=mono[glas]`,
    `anoisesrc=d=0.8:c=pink:r=24000:a=0.6,highpass=f=300,lowpass=f=2500,afade=t=in:d=0.3,afade=t=out:st=0.35:d=0.45,volume=0.35[whoosh]`,
    `[glas][whoosh]amix=inputs=2:duration=first:normalize=0[a]`,
  ].join(';');

  await promisify(execFile)(
    ffmpeg,
    [
      '-y', '-loglevel', 'error',
      '-loop', '1', '-framerate', '30', '-t', trajanje, '-i', pozadinaSlika,
      '-f', 'concat', '-safe', '0', '-i', spisak,
      '-i', zvuk,
      '-filter_complex', filter,
      '-map', '[v]', '-map', '[a]',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
      '-shortest', '-movflags', '+faststart',
      join(INSTA_DIR, v.fajl),
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );

  let opis = v.meta.opis;
  if (poglavlja.length >= 3) {
    // YouTube poglavlja: prvo mora biti 0:00, svako najmanje 10 sekundi.
    const spisakPoglavlja = [{ od: 0, naziv: 'Intro' }, ...poglavlja].filter((p, i, sva) => i === 0 || p.od - sva[i - 1].od >= 10);
    opis = opis.replace('{POGLAVLJA}', `Chapters:\n${spisakPoglavlja.map((p) => `${vreme(p.od)} ${p.naziv}`).join('\n')}`);
  }
  return { fajl: v.fajl, ...v.meta, opis: opis.replace('{POGLAVLJA}\n\n', ''), sekundi: Math.round(ukupno + INTRO_SEKUNDI) };
}

// ───────────────────────────── scenariji ─────────────────────────────

const kraj = { glas: "Follow for tomorrow's AI news.", red1: "Tomorrow's AI news,", red2: 'in 30 seconds.' };
const najaveVesti = [
  { glas: "Here's today's biggest AI story.", veliko: '#1', ekran: "TODAY'S TOP AI STORY" },
  { glas: 'AI story number two for today.', veliko: '#2', ekran: 'AI STORY OF THE DAY' },
  { glas: 'And one more AI story you should know today.', veliko: '#3', ekran: 'AI STORY OF THE DAY' },
];

function scenarioVest(datum, vest, broj) {
  const zasto = prvaRecenica(vest.zastoJeBitno);
  const oznaka = `AI Morning Brief · ${datum} · ${broj}`;
  return {
    id: String(broj),
    fajl: `${datum}-short-${broj}.mp4`,
    natpis: `TODAY · ${kratakDatum(datum).toUpperCase()}`,
    zaglavlje: { levo: `AI NEWS · ${kratakDatum(datum).toUpperCase()}`, pill: (KATEGORIJE[vest.kategorija] ?? 'AI').toUpperCase() },
    maliNaslov: vest.naslov,
    najava: najaveVesti[broj - 1] ?? najaveVesti[1],
    udica: vest.naslov,
    delovi: [{ tekst: skrati(cist(vest.staSeDesilo), 230) }, { tekst: zasto, izgovor: `Why it matters: ${zasto}`, oznaka: 'WHY IT MATTERS' }],
    kraj,
    meta: {
      naslov: skrati(cist(vest.naslov), 95),
      opis: [skrati(cist(vest.staSeDesilo), 300), `Why it matters: ${zasto}`, `Daily AI news in 30 seconds. Subscribe for tomorrow’s brief.\n${DRUSTVENE}`, HASHTAGOVI, oznaka].join('\n\n'),
      oznaka,
      plejlista: 'AI News in 30 Seconds',
      pitanje: PITANJA[vest.kategorija] ?? PITANJA.ostalo,
    },
  };
}

/** „Try this AI tool“: alat iz „Novo izašlo“ sa najviše tri koraka i cenom. */
function scenarioAlat(datum, izdanje) {
  const alat = izdanje.novo?.find((n) => n.tip === 'alat' || n.tip === 'projekat') ?? izdanje.novo?.[0];
  if (!alat?.kakoProbati?.length) return null;
  const opis = prvaRecenica(alat.opis, 160);
  const koraci = alat.kakoProbati.slice(0, 3).map((k) => prvaRecenica(k, 150));
  const oznaka = `AI Morning Brief · ${datum} · alat`;
  return {
    id: 'alat',
    fajl: `${datum}-short-alat.mp4`,
    natpis: `TRY THIS · ${kratakDatum(datum).toUpperCase()}`,
    zaglavlje: { levo: 'TRY THIS AI TOOL', pill: (alat.tip ?? 'tool').toUpperCase() === 'ALAT' ? 'TOOL' : 'PROJECT' },
    maliNaslov: cist(alat.naziv),
    najava: { glas: "Here's an AI tool you can try today.", veliko: 'Try this', ekran: 'AI TOOL OF THE DAY' },
    udica: `${cist(alat.naziv)}: ${skrati(opis, 80)}`,
    delovi: [
      ...koraci.map((k, i) => ({ tekst: k, izgovor: `Step ${i + 1}: ${k}`, oznaka: `STEP ${i + 1}` })),
      ...(alat.cena ? [{ tekst: `Price: ${cist(alat.cena)}.`, oznaka: 'PRICE' }] : []),
    ],
    kraj: { glas: 'Follow for a new AI tool every day.', red1: 'A new AI tool,', red2: 'every day.' },
    meta: {
      naslov: skrati(`Try ${cist(alat.naziv)}: ${opis.replace(/\.$/, '')}`, 95),
      opis: [
        opis,
        `How to try it:\n${alat.kakoProbati.map((k, i) => `${i + 1}. ${cist(k)}`).join('\n')}`,
        alat.cena ? `Price: ${cist(alat.cena)}` : '',
        alat.link ? `Official link: ${alat.link}` : '',
        `A new AI tool every day. ${DRUSTVENE}`,
        '#AI #AITools #Developer #Shorts',
        oznaka,
      ]
        .filter(Boolean)
        .join('\n\n'),
      oznaka,
      plejlista: 'Try This AI Tool',
      pitanje: 'Would you try it? 👇',
    },
  };
}

/** „App idea of the day“: prva ideja dana. */
function scenarioIdeja(datum, izdanje) {
  const ideja = izdanje.ideje?.[0];
  if (!ideja) return null;
  const problem = prvaRecenica(ideja.problem);
  const oznaka = `AI Morning Brief · ${datum} · ideja`;
  return {
    id: 'ideja',
    fajl: `${datum}-short-ideja.mp4`,
    natpis: `BUILD THIS · ${kratakDatum(datum).toUpperCase()}`,
    zaglavlje: { levo: 'APP IDEA OF THE DAY', pill: ideja.vikendProjekat ? 'WEEKEND PROJECT' : `DIFFICULTY ${ideja.tezina}/5` },
    maliNaslov: cist(ideja.naziv),
    najava: {
      glas: ideja.vikendProjekat ? "Here's an AI app you could build this weekend." : "Here's today's AI app idea.",
      veliko: 'Build this',
      ekran: 'APP IDEA OF THE DAY',
    },
    udica: cist(ideja.naziv),
    delovi: [
      { tekst: problem, oznaka: 'THE PROBLEM' },
      { tekst: prvaRecenica(ideja.zaKoga), oznaka: 'WHO IT IS FOR', izgovor: `It's for ${prvaRecenica(ideja.zaKoga).replace(/^\w/, (c) => c.toLowerCase())}` },
      { tekst: prvaRecenica(ideja.ulogaAi, 190), oznaka: 'HOW AI HELPS' },
      { tekst: `Difficulty: ${ideja.tezina} out of 5${ideja.vikendProjekat ? '. You can build it in a weekend.' : '.'}`, oznaka: 'DIFFICULTY' },
    ],
    kraj: { glas: 'Follow for more AI app ideas.', red1: 'More AI app ideas,', red2: 'every week.' },
    meta: {
      naslov: skrati(`AI app idea: ${cist(ideja.naziv)} – ${problem.replace(/\.$/, '')}`, 95),
      opis: [
        `${cist(ideja.naziv)}: ${problem}`,
        `Who it is for: ${cist(ideja.zaKoga)}`,
        `How AI helps: ${cist(ideja.ulogaAi)}`,
        ideja.prviKoraci?.length ? `First steps:\n${ideja.prviKoraci.map((k, i) => `${i + 1}. ${cist(k)}`).join('\n')}` : '',
        `Difficulty: ${ideja.tezina}/5${ideja.vikendProjekat ? ' · weekend project' : ''}`,
        `AI app ideas every week. ${DRUSTVENE}`,
        '#AI #AppIdea #IndieHacker #BuildInPublic #Shorts',
        oznaka,
      ]
        .filter(Boolean)
        .join('\n\n'),
      oznaka,
      plejlista: 'AI App Ideas',
      pitanje: 'Would you use this? 👇',
    },
  };
}

/** „Cheapest AI models this week“: najjeftiniji model po klasi (mešana cena 3:1 ulaz:izlaz) i najveći pad cene. */
async function scenarioCene(datum) {
  const cene = await readJson(join(DATA_DIR, 'cene.json'), null);
  if (!cene?.grupe?.length) return null;
  const KLASE = { vrhunski: 'TOP TIER', srednji: 'MID-RANGE', jeftini: 'BUDGET' };
  const GLAS_KLASE = { vrhunski: 'In the top tier', srednji: 'In the mid-range', jeftini: 'On a budget' };
  const usd = (n) => (n >= 1 ? `$${n.toFixed(n % 1 ? 2 : 0)}` : `$${Number(n.toPrecision(2))}`);
  const mesana = (m) => (3 * m.ulaz + m.izlaz) / 4;
  const delovi = cene.grupe.map((g) => {
    const m = [...g.modeli].sort((a, b) => mesana(a) - mesana(b))[0];
    return {
      tekst: `${m.naziv}: ${usd(m.ulaz)} in, ${usd(m.izlaz)} out per million tokens.`,
      izgovor: `${GLAS_KLASE[g.id] ?? g.naziv}, the cheapest is ${m.naziv}: ${usd(m.ulaz)} in and ${usd(m.izlaz)} out per million tokens.`,
      oznaka: KLASE[g.id] ?? g.naziv.toUpperCase(),
    };
  });
  // Najveći procentualni pad ulazne cene u poslednjih 7 dana.
  const padovi = cene.grupe
    .flatMap((g) => g.modeli)
    .filter((m) => m.promena7?.ulaz < 0)
    .map((m) => ({ m, pad: Math.round((-m.promena7.ulaz / (m.ulaz - m.promena7.ulaz)) * 100) }))
    .sort((a, b) => b.pad - a.pad);
  if (padovi[0]?.pad >= 5) delovi.push({ tekst: `Biggest drop this week: ${padovi[0].m.naziv}, input down ${padovi[0].pad}%.`, oznaka: 'PRICE DROP' });
  const oznaka = `AI Morning Brief · ${datum} · cene`;
  return {
    id: 'cene',
    fajl: `${datum}-short-cene.mp4`,
    natpis: `AI PRICES · ${kratakDatum(datum).toUpperCase()}`,
    zaglavlje: { levo: 'AI PRICES THIS WEEK', pill: 'PER 1M TOKENS' },
    maliNaslov: 'Cheapest AI models this week',
    najava: { glas: 'Here are the cheapest AI models this week.', veliko: '$', ekran: 'AI PRICES THIS WEEK' },
    udica: 'The cheapest AI model in every tier, right now.',
    delovi,
    kraj: { glas: 'Follow for AI prices every Sunday.', red1: 'AI model prices,', red2: 'every Sunday.' },
    meta: {
      naslov: `Cheapest AI models this week (${kratakDatum(datum)})`,
      opis: [delovi.map((d) => `${d.oznaka}: ${d.tekst}`).join('\n'), 'Prices per million tokens (input / output), from OpenRouter.', `AI prices every Sunday. ${DRUSTVENE}`, '#AI #LLM #AIPricing #Developer #Shorts', oznaka].join('\n\n'),
      oznaka,
      plejlista: 'AI Prices',
      pitanje: 'Which model are you using right now? 👇',
    },
  };
}

/** Subotom: „This week in AI“ kao Short (pet tačaka). */
function scenarioNedeljaShort(datum, izdanje) {
  const { ukratko, tacke } = izdanje.nedeljni;
  const opseg = opsegNedelje(datum);
  const oznaka = `AI Morning Brief · ${datum} · nedelja`;
  return {
    id: 'nedelja',
    fajl: `${datum}-short-nedelja.mp4`,
    natpis: `THIS WEEK · ${opseg.toUpperCase()}`,
    zaglavlje: { levo: 'THIS WEEK IN AI', pill: opseg.replace(/, \d{4}$/, '').toUpperCase() },
    maliNaslov: `This week in AI · ${opseg}`,
    najava: { glas: "Here's your AI week in under a minute.", veliko: 'Week', ekran: 'THIS WEEK IN AI' },
    udica: prvaRecenica(ukratko, 150),
    delovi: tacke.slice(0, 5).map((t, i) => ({ tekst: `${naslovTacke(cist(t))}.`, oznaka: `${i + 1}/${Math.min(5, tacke.length)}` })),
    kraj: { glas: 'Follow for the full recap every Saturday.', red1: 'The AI week,', red2: 'every Saturday.' },
    meta: {
      naslov: `This week in AI: ${skrati(naslovTacke(cist(tacke[0])), 60)} (${opseg.replace(/, \d{4}$/, '')})`,
      opis: [cist(ukratko), tacke.map((t, i) => `${i + 1}. ${naslovTacke(cist(t))}`).join('\n'), `Full weekly recap on our channel every Saturday. ${DRUSTVENE}`, HASHTAGOVI, oznaka].join('\n\n'),
      oznaka,
      plejlista: 'This Week in AI',
      pitanje: 'What was the biggest AI story of the week for you? 👇',
    },
  };
}

/** Subotom: dugi video 16:9 (~5–7 min) — nedelja ukratko, pet tačaka i glavna vest svakog dana, sa poglavljima. */
async function scenarioNedeljaDugi(datum, izdanje) {
  const { ukratko, tacke } = izdanje.nedeljni;
  const opseg = opsegNedelje(datum);
  const kraj7 = new Date(`${datum}T00:00:00Z`);
  const dani = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(kraj7.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    const iz = await readJson(join(DATA_DIR, 'en', `${d}.json`), null);
    const vest = iz && izaberiVesti(iz)[0];
    if (vest) dani.push({ d, vest });
  }
  const oznaka = `AI Morning Brief · ${datum} · nedelja-dugi`;
  return {
    id: 'nedelja-dugi',
    format: 'dugi',
    fajl: `${datum}-dugi-nedelja.mp4`,
    natpis: `THIS WEEK IN AI · ${opseg.toUpperCase()}`,
    zaglavlje: { levo: 'THIS WEEK IN AI', pill: opseg.toUpperCase() },
    maliNaslov: `This week in AI · ${opseg}`,
    najava: { glas: 'Welcome to This Week in AI, from AI Morning Brief.', veliko: 'This week', ekran: opseg.toUpperCase() },
    udica: prvaRecenica(ukratko, 150),
    delovi: [
      { tekst: recenice(cist(ukratko)).slice(1).join(' ') || cist(ukratko), oznaka: 'THE WEEK IN SHORT', poglavlje: 'The week in short' },
      ...tacke.map((t, i) => ({ tekst: `${naslovTacke(cist(t))}. ${telTacke(cist(t))}`, oznaka: `${i + 1}/${tacke.length}`, poglavlje: naslovTacke(cist(t)) })),
      ...dani.map(({ d, vest }) => ({
        tekst: `${cist(vest.naslov)}. ${skrati(cist(vest.staSeDesilo), 260)} ${prvaRecenica(vest.zastoJeBitno)}`,
        izgovor: `On ${imeDana(d)}: ${cist(vest.naslov)}.`,
        oznaka: imeDana(d).toUpperCase(),
        poglavlje: `${imeDana(d)}: ${skrati(cist(vest.naslov), 60)}`,
      })),
    ],
    kraj: { glas: "That's the week in AI. Subscribe for daily AI news, and see you next Saturday.", red1: 'See you next Saturday.', red2: 'Daily AI news on Shorts.' },
    meta: {
      naslov: skrati(`This Week in AI: ${naslovTacke(cist(tacke[0]))} | ${opseg}`, 100),
      opis: [cist(ukratko), '{POGLAVLJA}', `New AI news every day on our Shorts. ${DRUSTVENE}`, '#AI #AINews #ArtificialIntelligence #WeeklyRecap', oznaka].join('\n\n'),
      oznaka,
      plejlista: 'This Week in AI',
      pitanje: 'What was the biggest AI story of the week for you? 👇',
      dugi: true,
    },
  };
}

/** Koje serije idu tog dana (najviše 5 videa zbog YouTube kvote). */
async function scenarijiDana(datum, izdanje, samo) {
  const dan = danUNedelji(datum);
  const subota = dan === 6 && izdanje.nedeljni?.tacke?.length;
  const lista = [];
  const hoce = (s) => !samo || samo.includes(s);
  if (hoce('vesti')) izaberiVesti(izdanje).slice(0, 3).forEach((v, i) => lista.push(scenarioVest(datum, v, i + 1)));
  if (hoce('alat') && !subota) lista.push(scenarioAlat(datum, izdanje));
  if (hoce('ideja') && [1, 3, 5].includes(dan)) lista.push(scenarioIdeja(datum, izdanje));
  if (hoce('cene') && dan === 0) lista.push(await scenarioCene(datum));
  if (hoce('nedelja') && subota) lista.push(scenarioNedeljaShort(datum, izdanje), await scenarioNedeljaDugi(datum, izdanje));
  return lista.filter(Boolean).slice(0, 5);
}

export async function napraviShortove(datum, samo) {
  const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
  if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
  const scenariji = await scenarijiDana(datum, izdanje, samo);

  // Pri delimičnom pravljenju (--samo) ostali videi tog dana ostaju.
  const stari = samo ? ((await readJson(join(INSTA_DIR, `${datum}-shorts.json`), null)) ?? []) : [];
  for (const f of await readdir(INSTA_DIR).catch(() => [])) {
    if (scenariji.some((s) => s.fajl === f) || (!samo && (f.startsWith(`${datum}-short-`) || f.startsWith(`${datum}-dugi-`)))) await rm(join(INSTA_DIR, f));
  }

  const fonts = await fontovi();
  const radni = await mkdtemp(join(tmpdir(), 'ai-shorts-'));
  try {
    const novi = [];
    for (const s of scenariji) novi.push(await napraviVideo(datum, s, fonts, radni));
    // Redosled je bitan: objavi-youtube šalje od kraja, pa prvi na listi završi na vrhu kanala.
    const svi = [...novi, ...stari.filter((s) => !novi.some((n) => n.fajl === s.fajl))];
    await writeJson(join(INSTA_DIR, `${datum}-shorts.json`), svi);
    return novi;
  } finally {
    await rm(radni, { recursive: true, force: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datum = datumIzArgumenata();
  const samo = process.argv.find((a) => a.startsWith('--samo='))?.split('=')[1]?.split(',');
  const videi = await napraviShortove(datum, samo);
  console.log(`Video za ${datum}: ${videi.map((s) => `${s.fajl} (${s.sekundi} s)`).join(', ')}`);
}
