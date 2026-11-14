// Naslovne slike za sajt: 1200×630 za svaku vest i svaku stavku „Novo izašlo“ iz engleskog izdanja,
// u stilu brenda (tamna pozadina, boja kategorije, Byte sa izrazom). Bez tuđih fotografija, pa bez problema sa autorskim pravima.
// Služe kao slike kartica na sajtu i kao og:image kad se vest deli.
//
// Dve verzije po stavci (N = redni broj u izdanju, od 0):
//   DATUM-vest-N.jpg     800×420 za kartice na sajtu: bez naslova (on je ispod slike), sa temama vesti (Nvidia, OpenAI…)
//   DATUM-vest-N-og.jpg  1200×630 sa naslovom, za og:image kad se vest deli
// Isto za DATUM-novo-N(-og).jpg; na slici alata je znak sa inicijalima, kao u Tool of the Day videu.
// Folder public/insta čisti ocisti-medije.mjs, pa starija izdanja na sajtu prikažu kartice bez slike.
//
// Pokretanje: node scripts/slike-vesti.mjs [--datum=YYYY-MM-DD]

import { mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import satori from 'satori';
import sharp from 'sharp';
import { byteSvg } from './byte-svg.mjs';
import { temeHashtagovi } from './hashtagovi.mjs';
import { INSTA_DIR, KATEGORIJE, el, fontovi, skrati } from './insta-slike.mjs';
import { DATA_DIR, datumIzArgumenata, readJson } from './lib.mjs';

const W = 1200;
const H = 630;

/** Boja i izraz Byte-a po kategoriji vesti. */
const STIL = {
  modeli: { boja: '#a78bfa', izraz: 'happy' },
  alati: { boja: '#34d399', izraz: 'happy' },
  kompanije: { boja: '#38bdf8', izraz: 'sly' },
  istrazivanje: { boja: '#fbbf24', izraz: 'skeptic' },
  bezbednost: { boja: '#fb7185', izraz: 'worried' },
  regulativa: { boja: '#fb923c', izraz: 'worried' },
  ostalo: { boja: '#94a3b8', izraz: 'happy' },
};
const TIPOVI = { model: 'NEW MODEL', alat: 'NEW TOOL', projekat: 'OPEN SOURCE', funkcija: 'NEW FEATURE' };

const bytePodaci = (izraz) => `data:image/svg+xml;base64,${Buffer.from(byteSvg(izraz)).toString('base64')}`;

function kartica({ oznaka, boja, naslov, podnaslov, izraz, datum }) {
  const velicina = naslov.length > 90 ? 50 : naslov.length > 60 ? 58 : 66;
  return el(
    'div',
    {
      width: W,
      height: H,
      position: 'relative',
      backgroundColor: '#020617',
      backgroundImage: `radial-gradient(circle at 85% 30%, ${boja}40 0%, ${boja}10 35%, transparent 65%), linear-gradient(135deg, #0b1023 0%, #020617 70%)`,
      color: '#f8fafc',
      fontFamily: 'Inter',
      padding: '56px 64px',
      boxSizing: 'border-box',
    },
    el(
      'div',
      { flexDirection: 'column', width: 790, height: '100%', justifyContent: 'space-between' },
      el(
        'div',
        { alignItems: 'center', fontSize: 22, fontWeight: 800, letterSpacing: 4 },
        el('div', { color: '#fbbf24', marginRight: 24 }, 'AI MORNING BRIEF'),
        el('div', { color: '#020617', backgroundColor: boja, borderRadius: 999, padding: '6px 18px', letterSpacing: 2, fontSize: 20 }, oznaka),
      ),
      el(
        'div',
        { flexDirection: 'column' },
        el('div', { fontSize: velicina, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }, skrati(naslov, 120)),
        podnaslov ? el('div', { fontSize: 26, lineHeight: 1.4, color: '#cbd5e1', marginTop: 22 }, skrati(podnaslov, 110)) : el('div', {}, ''),
      ),
      el('div', { fontSize: 22, color: '#94a3b8' }, datum),
    ),
    el('img', { position: 'absolute', right: 40, bottom: 20, width: 330, height: 388 }, ''),
  );
}

/** Ime teme za prikaz: "#ClaudeCode" → "Claude Code", "#OpenAI" ostaje "OpenAI". */
const ZADRZI = new Set(['OpenAI', 'ChatGPT', 'DeepSeek', 'DeepMind', 'GitHub', 'xAI', 'ElevenLabs', 'SoftBank', 'IPO', 'MCP', 'AMD', 'IBM', 'TSMC', 'MistralAI', 'HuggingFace']);
const IMENA = { MistralAI: 'Mistral', HuggingFace: 'Hugging Face', AIAct: 'AI Act', AIChips: 'AI Chips', AIAgents: 'AI Agents', AIRegulation: 'AI Regulation' };
const imeTeme = (tag) => {
  const t = tag.replace(/^#/, '');
  return IMENA[t] ?? (ZADRZI.has(t) ? t : t.replace(/([a-z])([A-Z])/g, '$1 $2'));
};

const inicijali = (naziv) =>
  naziv
    .replace(/\(.*?\)/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((r) => r[0].toUpperCase())
    .join('') || 'AI';

/** Kartica za sajt: oznaka, velike teme (ili inicijali alata) i Byte. Bez naslova, jer je on ispod slike. */
function karticaSajta({ oznaka, boja, teme, znak, izraz }) {
  const velicina = teme.length > 2 ? 64 : 80;
  return el(
    'div',
    {
      width: W,
      height: H,
      position: 'relative',
      backgroundColor: '#020617',
      backgroundImage: `radial-gradient(circle at 80% 35%, ${boja}55 0%, ${boja}12 38%, transparent 68%), linear-gradient(135deg, #0b1023 0%, #020617 70%)`,
      color: '#f8fafc',
      fontFamily: 'Inter',
      padding: '60px 70px',
      boxSizing: 'border-box',
    },
    el(
      'div',
      { flexDirection: 'column', width: 760, height: '100%', justifyContent: 'space-between' },
      el(
        'div',
        { alignItems: 'center', fontSize: 26, fontWeight: 800, letterSpacing: 4 },
        el('div', { color: '#020617', backgroundColor: boja, borderRadius: 999, padding: '8px 22px', letterSpacing: 3 }, oznaka),
      ),
      znak
        ? el(
            'div',
            { width: 230, height: 230, borderRadius: 56, alignItems: 'center', justifyContent: 'center', fontSize: 104, fontWeight: 800, color: '#020617', backgroundImage: `linear-gradient(135deg, ${boja}, #0ea5e9)` },
            znak,
          )
        : el(
            'div',
            { flexDirection: 'column' },
            ...teme.map((t, i) => el('div', { fontSize: velicina, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5, color: i === 0 ? '#f8fafc' : '#94a3b8' }, t)),
          ),
      el('div', { fontSize: 24, fontWeight: 800, letterSpacing: 5, color: '#fbbf24' }, 'AI MORNING BRIEF'),
    ),
    el('img', { position: 'absolute', right: 60, bottom: 30, width: 360, height: 423 }, ''),
  );
}

export async function napraviSlikeVesti(datum) {
  const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
  if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
  await mkdir(INSTA_DIR, { recursive: true });
  for (const f of await readdir(INSTA_DIR)) if (f.startsWith(`${datum}-vest-`) || f.startsWith(`${datum}-novo-`)) await rm(join(INSTA_DIR, f));

  const fonts = await fontovi();
  const lep = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${datum}T12:00:00Z`));
  const stavke = [
    ...izdanje.vesti.map((v, i) => {
      const s = STIL[v.kategorija] ?? STIL.ostalo;
      const oznaka = (KATEGORIJE[v.kategorija] ?? 'AI').toUpperCase();
      const teme = temeHashtagovi(`${v.naslov} ${v.staSeDesilo}`, 3).map(imeTeme);
      return { ime: `${datum}-vest-${i}`, oznaka, boja: s.boja, izraz: v.vaznost === 3 && s.izraz === 'happy' ? 'shock' : s.izraz, naslov: v.naslov, podnaslov: '', teme: teme.length ? teme : [KATEGORIJE[v.kategorija] ?? 'AI'] };
    }),
    ...(izdanje.novo ?? []).map((n, i) => ({ ime: `${datum}-novo-${i}`, oznaka: TIPOVI[n.tip] ?? 'NEW', boja: '#34d399', izraz: 'happy', naslov: n.naziv, podnaslov: n.opis, teme: [], znak: inicijali(n.naziv) })),
  ];

  const sacuvaj = async (slajd, izraz, fajl, sirina) => {
    // satori: slika Byte-a ide kao src na img elementu (poslednje dete)
    slajd.props.children.at(-1).props.src = bytePodaci(izraz);
    const svg = await satori(slajd, { width: W, height: H, fonts, embedFont: true });
    await sharp(Buffer.from(svg)).resize(sirina).jpeg({ quality: 80, mozjpeg: true }).toFile(join(INSTA_DIR, fajl));
  };
  for (const s of stavke) {
    await sacuvaj(karticaSajta(s), s.izraz, `${s.ime}.jpg`, 800);
    await sacuvaj(kartica({ ...s, datum: lep }), s.izraz, `${s.ime}-og.jpg`, W);
  }
  return stavke.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const datum = datumIzArgumenata();
  console.log(`Slike vesti za ${datum}: ${await napraviSlikeVesti(datum)} (public/insta/${datum}-vest-*.jpg, -novo-*.jpg)`);
}
