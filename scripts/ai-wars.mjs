// AI Wars: dnevna epizoda sa maskotom Byte (YouTube Short i Instagram Reel).
// Claude piše scenario iz engleskog izdanja i prethodnih epizoda, Kokoro daje glas (scripts/tts.py),
// a Remotion projekat u video/ renderuje video sa animiranim karticama i likovima firmi.
//
// Izlaz: public/insta/DATUM-short-wars.mp4 i stavka na vrhu DATUM-shorts.json (objavljuju je objavi-youtube i objavi-instagram).
// Stanje serije (broj epizode, kratak sadržaj za kontinuitet priče): scripts/state/ai-wars.json.
// Pokreće se posle shorts.mjs: iz istog dana briše Short o vesti koju epizoda već pokriva i ostavlja najviše jedan Short sa vešću.
//
// Python sa kokoro-onnx: TTS_PYTHON (podrazumevano python3). Model: AI_WARS_MODEL (podrazumevano opus).
// Pokretanje: node scripts/ai-wars.mjs [--datum=YYYY-MM-DD]

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VIDEO_DIR, naslovnaMs, ozvuci, renderuj, trajanje } from './byte-video.mjs';
import { pitajClaude } from './claude.mjs';
import { INSTA_DIR, izaberiVesti } from './insta-slike.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const STANJE = join(SCRIPTS_DIR, 'state', 'ai-wars.json');
const IZRAZI = ['happy', 'shock', 'worried', 'skeptic', 'laugh', 'sly'];
const RASPOLOZENJA = ['calm', 'sad', 'sly', 'shock'];
const KARTICE = ['likovi', 'trake', 'grafik', 'broj', 'tekst', 'reflektor', 'mera', 'sucelje'];
const LIKOVI = 'openai, google, anthropic, meta, microsoft, xai, nvidia, apple, amazon, mistral, deepseek, alibaba, perplexity, huggingface, github, cursor, samsung, tesla';
const HASHTAGOVI = '#AI #AINews #AIWars #OpenAI #Google #Anthropic #Shorts';

const datum = datumIzArgumenata();
const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
if (!existsSync(join(VIDEO_DIR, 'node_modules'))) throw new Error('Nema paketa za video (npm ci --prefix video).');

const stanje = await readJson(STANJE, { epizode: [] });
const ranije = stanje.epizode.filter((e) => e.datum < datum).sort((a, b) => a.datum.localeCompare(b.datum));
const broj = stanje.epizode.find((e) => e.datum === datum)?.epizoda ?? (ranije.at(-1)?.epizoda ?? 0) + 1;

// 1. Scenario
const vesti = izdanje.vesti.map((v, i) => ({ i, naslov: v.naslov, staSeDesilo: v.staSeDesilo, zastoJeBitno: v.zastoJeBitno, kategorija: v.kategorija }));
const prompt = `You write today's episode of "AI Wars", a daily YouTube Shorts / Instagram Reels series by AI Morning Brief.
The series tells the race between AI companies (OpenAI, Google, Anthropic, Meta, xAI, Nvidia...) as an ongoing story, one episode a day.
The narrator is Byte, a small robot mascot: witty, a little sarcastic, warm, never mean. Plain spoken English, short punchy sentences, no jargon.
Companies appear on screen as cartoon characters (colored orbs with faces).

This is EPISODE ${broj}. Date: ${datum}.

${ranije.length ? `Previous episodes (for continuity; you may call back to them, but today's news comes first):\n${ranije
    .slice(-5)
    .map((e) => `- Ep. ${e.epizoda} (${e.datum}) "${e.naslov}": ${e.sazetak} Cliffhanger: ${e.cliffhanger}`)
    .join('\n')}` : 'This is the first episode of the series.'}

Today's stories (use ONLY facts from these; never invent numbers, names or events):
${JSON.stringify(vesti, null, 1)}

Pick 1 or 2 stories that best fit a rivalry/drama between companies (money, launches, beef, stocks, talent, lawsuits, price wars).
If nothing is about big companies, take the most dramatic company story anyway.

Write the episode as spoken lines. Each line has:
- "tekst": what Byte says (max 140 characters). It is read by a text-to-speech voice, so write numbers as words a person would say ("thirty billion dollars", "fifteen percent"), no symbols, no abbreviations like "$" or "%" or "B".
- "izraz": Byte's face: ${IZRAZI.join(', ')}.
- "kartica": what is on screen above Byte while the line plays. Types:
  - likovi: 1-3 characters with moods; optional "pecat" (short stamp text, max 16 chars, e.g. "TERRIBLE WEEK") or "tekst".
  - trake: comparison bars; "trake": 2-3 items {label (max 12 chars), vrednost (short, symbols OK, e.g. "$11B"), udeo (0..1 bar length relative to the biggest)}; optional character in "likovi" and "pecat" (e.g. "-63%").
  - grafik: a line chart; "smer": "gore" (up) or "dole" (down); "tekst" (max 50 chars, wrap 1-2 key words in *asterisks* to highlight); optional character; "pecat" (e.g. "-15%").
  - broj: one big number that counts up; "broj" (e.g. "-$500B", "$1.25T", "40%"; a leading minus shows red with money flying away); "naslov" (max 28 chars label); optional "pecat".
  - tekst: a character plus a short statement card; "tekst" (max 50 chars, *highlight*); optional "podtekst" (max 40 chars), "pecat".
  - reflektor: one character under a spotlight (for a sneaky or surprising move); "tekst" (max 30 chars, *highlight*); optional "podtekst".
  - mera: a gauge; "naslov" (e.g. "Investor mood"), "levo"/"desno" (end labels, max 10 chars), "vrednost" 0..1 (needle position), optional "tekst" (max 40 chars).
  - sucelje: face-off of 2-3 characters with a big question mark; "pecat" (the open question, max 20 chars). Use it for the final cliffhanger line.
  Characters are {id, raspolozenje} where id is one of: ${LIKOVI} (or another lowercase id with "ime" set to the display name). raspolozenje: ${RASPOLOZENJA.join(', ')}.
  Vary the card types; screen text must match what Byte says and the facts.

Structure (4 to 7 lines, 55 to 90 spoken words in total, about 30 to 40 seconds):
1. A hook line that makes people stay: surprising, concrete, max 12 words. Do NOT greet or introduce Byte (the intro "I'm Byte, this is AI Wars, episode ${broj}" is added automatically after your first line).
2. The story, 2 to 5 lines, each with its own card. Add a light joke or sarcastic aside.
3. A cliffhanger line: an open question about what happens next, ending with "Episode ${broj + 1}, tomorrow." Use a sucelje card. (The "Follow" call to action is added automatically after it.)

Also return:
- "naslov": episode title for YouTube, max 60 characters, catchy and searchable, with the company names (e.g. "OpenAI gets less than half, Google loses $500B"). Without "AI Wars Ep." (added automatically).
- "podnaslov": very short episode subtitle for the title card, max 26 characters (e.g. "The money runs dry").
- "opis": 2-3 sentences for the video description with the facts, plain text.
- "pitanje": one question for the comments, max 80 characters, ending with " 👇".
- "sazetak": one sentence summary of what happened in this episode (for continuity in future episodes).
- "cliffhanger": the open question you ended on.
- "vesti": indexes (i) of the stories you used.`;

const kartica = {
  type: 'object',
  properties: {
    tip: { type: 'string', enum: KARTICE },
    likovi: {
      type: 'array',
      items: { type: 'object', properties: { id: { type: 'string' }, ime: { type: 'string' }, raspolozenje: { type: 'string', enum: RASPOLOZENJA } }, required: ['id'] },
    },
    pecat: { type: 'string' },
    trake: {
      type: 'array',
      items: { type: 'object', properties: { label: { type: 'string' }, vrednost: { type: 'string' }, udeo: { type: 'number' } }, required: ['label', 'vrednost', 'udeo'] },
    },
    smer: { type: 'string', enum: ['gore', 'dole'] },
    tekst: { type: 'string' },
    podtekst: { type: 'string' },
    broj: { type: 'string' },
    naslov: { type: 'string' },
    levo: { type: 'string' },
    desno: { type: 'string' },
    vrednost: { type: 'number' },
  },
  required: ['tip'],
};
const schema = JSON.stringify({
  type: 'object',
  properties: {
    naslov: { type: 'string' },
    podnaslov: { type: 'string' },
    replike: {
      type: 'array',
      items: { type: 'object', properties: { tekst: { type: 'string' }, izraz: { type: 'string', enum: IZRAZI }, kartica }, required: ['tekst', 'izraz', 'kartica'] },
    },
    opis: { type: 'string' },
    pitanje: { type: 'string' },
    sazetak: { type: 'string' },
    cliffhanger: { type: 'string' },
    vesti: { type: 'array', items: { type: 'integer' } },
  },
  required: ['naslov', 'podnaslov', 'replike', 'opis', 'pitanje', 'sazetak', 'cliffhanger', 'vesti'],
});

const model = process.env.AI_WARS_MODEL || 'opus';
console.log(`AI Wars Ep. ${broj} (${datum}): Claude piše scenario (model: ${model})…`);
const odgovor = await pitajClaude(prompt, { schema, model });
const sc = odgovor.structured_output;
if (odgovor.is_error || !sc) throw new Error(`Claude nije vratio scenario: ${odgovor.subtype ?? ''} ${odgovor.result ?? ''}`.trim());
const greske = proveri(sc);
if (greske.length) throw new Error(`Scenario nije ispravan:\n- ${greske.join('\n- ')}`);

// Uvod posle udice i poziv na praćenje na kraju su uvek isti.
const replike = [
  sc.replike[0],
  { tekst: `I'm Byte. And this is AI Wars, episode ${broj}.`, izraz: 'happy', kartica: { tip: 'intro', likovi: likoviEpizode(sc) } },
  ...sc.replike.slice(1),
  { tekst: "Follow, so you don't miss it.", izraz: 'happy', kartica: { tip: 'prati' } },
];
console.log(replike.map((r, i) => `  ${i + 1}. [${r.izraz} · ${r.kartica.tip}] ${r.tekst}`).join('\n'));

// 2. Glas i jačina zvuka po kadru (za usta maskote)
const glasDir = join(VIDEO_DIR, 'public', 'ep', datum);
await rm(glasDir, { recursive: true, force: true });
await mkdir(glasDir, { recursive: true });
await ozvuci(replike, `ep/${datum}`);

// 3. Render
const fajl = `${datum}-short-wars.mp4`;
const propsFajl = join(glasDir, 'props.json');
await writeFile(propsFajl, JSON.stringify({ serija: 'wars', epizoda: broj, podnaslov: sc.podnaslov.slice(0, 30), replike }));
console.log('Renderujem epizodu…');
await renderuj(propsFajl, join(INSTA_DIR, fajl));
const sekundi = trajanje(replike);

// 4. Stavka za objavu. Naslovna slika (Instagram): kartica „AI WARS“ sa likovima, kad se potpuno pojavi.
const oznaka = `AI Morning Brief · ${datum} · wars`;
const stavka = {
  fajl,
  naslov: `AI Wars Ep. ${broj}: ${sc.naslov}`.slice(0, 95),
  opis: [
    sc.opis,
    'AI Wars: the race between OpenAI, Google, Anthropic and the rest, told as a story. One episode a day.',
    `Subscribe so you don’t miss episode ${broj + 1}.`,
    HASHTAGOVI,
    oznaka,
  ].join('\n\n'),
  oznaka,
  plejlista: 'AI Wars',
  pitanje: sc.pitanje,
  tagovi: ['AI', 'AI news', 'AI Wars', ...new Set(replike.flatMap((r) => r.kartica.likovi ?? []).map((l) => l.ime || l.id))].slice(0, 12),
  naslovnaMs: naslovnaMs(replike),
  sekundi,
};

// Short o vesti koju epizoda već pokriva se briše, a od ostalih vesti ostaje najviše jedna (manje, a bolji videi).
const shortsFajl = join(INSTA_DIR, `${datum}-shorts.json`);
const pokrivene = new Set(sc.vesti.map((i) => izdanje.vesti[i]?.naslov).filter(Boolean));
const glavne = izaberiVesti(izdanje);
let vestiOstalo = 0;
const ostali = [];
for (const s of (await readJson(shortsFajl, null)) ?? []) {
  if (s.fajl === fajl) continue;
  const n = s.fajl.match(/-short-(\d+)\.mp4$/)?.[1];
  if (n && (pokrivene.has(glavne[n - 1]?.naslov) || vestiOstalo++ >= 1)) {
    await rm(join(INSTA_DIR, s.fajl), { force: true });
    console.log(`Uklonjen Short ${s.fajl} (${pokrivene.has(glavne[n - 1]?.naslov) ? 'ista vest kao epizoda' : 'najviše jedna vest dnevno'}).`);
    continue;
  }
  ostali.push(s);
}
// objavi-youtube šalje od kraja liste, pa je epizoda prva da završi na vrhu kanala.
await writeJson(shortsFajl, [stavka, ...ostali]);

const epizoda = { datum, epizoda: broj, naslov: sc.naslov, sazetak: sc.sazetak, cliffhanger: sc.cliffhanger, vesti: [...pokrivene] };
stanje.epizode = [...stanje.epizode.filter((e) => e.datum !== datum), epizoda].sort((a, b) => a.datum.localeCompare(b.datum));
await writeJson(STANJE, stanje);
await rm(glasDir, { recursive: true, force: true });
console.log(`Napravljena AI Wars Ep. ${broj}: ${fajl} (${sekundi} s) „${stavka.naslov}“`);

/* ---------- pomoćne ---------- */

function proveri(s) {
  const g = [];
  if (s.replike.length < 3 || s.replike.length > 8) g.push(`${s.replike.length} replika (treba 4–7)`);
  const reci = s.replike.reduce((z, r) => z + r.tekst.split(/\s+/).length, 0);
  if (reci < 35 || reci > 120) g.push(`${reci} izgovorenih reči (treba 55–90)`);
  for (const [i, r] of s.replike.entries()) {
    if (r.tekst.length > 180) g.push(`replika ${i + 1} je preduga`);
    if (/[$%]/.test(r.tekst)) g.push(`replika ${i + 1} ima simbol koji glas ne izgovara: ${r.tekst}`);
    const k = r.kartica;
    if (k.tip === 'trake' && !(k.trake?.length >= 2)) g.push(`replika ${i + 1}: trake bez bar dve stavke`);
    if (k.tip === 'broj' && !k.broj) g.push(`replika ${i + 1}: kartica broj bez broja`);
    for (const t of k.trake ?? []) t.udeo = Math.max(0.02, Math.min(1, t.udeo));
    if (k.vrednost != null) k.vrednost = Math.max(0, Math.min(1, k.vrednost));
    if (k.pecat) k.pecat = k.pecat.slice(0, 22);
  }
  if (!s.vesti.length) g.push('nije navedeno koje vesti su korišćene');
  return g;
}

/** Likovi za naslovnu karticu: oni koji se pojavljuju u epizodi (do tri), inače velika trojka. */
function likoviEpizode(s) {
  const vidjeni = new Map();
  for (const r of s.replike) for (const l of r.kartica.likovi ?? []) if (!vidjeni.has(l.id)) vidjeni.set(l.id, { id: l.id, ime: l.ime });
  const lista = [...vidjeni.values()].slice(0, 3);
  return lista.length >= 2 ? lista : [{ id: 'openai' }, { id: 'google' }, { id: 'anthropic' }];
}
