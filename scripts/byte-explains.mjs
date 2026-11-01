// Byte Explains: jedan AI pojam za 30 sekundi, sa maskotom Byte (YouTube Short i Instagram Reel).
// Claude bira pojam iz današnjih vesti (koji još nije objašnjen), piše scenario sa primerom iz vesti,
// Kokoro daje glas, Remotion (video/) renderuje. Objašnjenja ne zastarevaju, pa donose pregleda iz pretrage.
//
// Izlaz: public/insta/DATUM-short-explains.mp4 i stavka u DATUM-shorts.json. Kad uspe, briše Short sa vešću
// tog dana (dnevno ostaju AI Wars, alat i objašnjenje). Pojmovi koji su već objašnjeni: scripts/state/byte-explains.json.
//
// Pokretanje: node scripts/byte-explains.mjs [--datum=YYYY-MM-DD]

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VIDEO_DIR, naslovnaMs, ozvuci, renderuj, trajanje } from './byte-video.mjs';
import { pitajClaude } from './claude.mjs';
import { INSTA_DIR } from './insta-slike.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const STANJE = join(SCRIPTS_DIR, 'state', 'byte-explains.json');
const IZRAZI = ['happy', 'shock', 'worried', 'skeptic', 'laugh', 'sly'];
const RASPOLOZENJA = ['calm', 'sad', 'sly', 'shock'];
const DRUSTVENE = 'Instagram & Threads: @ai.morning.brief · Telegram: AI Morning Brief';

const datum = datumIzArgumenata();
const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
if (!existsSync(join(VIDEO_DIR, 'node_modules'))) throw new Error('Nema paketa za video (npm ci --prefix video).');

const stanje = await readJson(STANJE, { pojmovi: [] });
const ranije = stanje.pojmovi.filter((p) => p.datum !== datum);
const broj = stanje.pojmovi.find((p) => p.datum === datum)?.broj ?? Math.max(0, ...stanje.pojmovi.map((p) => p.broj)) + 1;

const vesti = [...izdanje.vesti, ...(izdanje.novo ?? []), ...(izdanje.istrazivanje ?? [])].map((v) => ({
  naslov: v.naslov ?? v.naziv,
  tekst: v.staSeDesilo ?? v.opis ?? v.sazetak,
}));

const prompt = `You write today's "Byte Explains #${broj}": one AI term explained in about 30 seconds, for YouTube Shorts and Instagram Reels by AI Morning Brief.
The narrator is Byte, a small robot mascot: witty, warm, a little sarcastic, plain spoken English, short punchy sentences.
Audience: curious people who hear AI words in the news but don't know what they mean. Many find these videos through search ("what is ...").

Today's news (pick the term from here, and use one story as the real example):
${JSON.stringify(vesti, null, 1)}

Already explained (do NOT pick these or near-duplicates): ${ranije.map((p) => p.pojam).join(', ') || 'nothing yet'}.

Pick ONE term that: appears in or is central to today's news; people actually search for (e.g. "MCP server", "AI agent", "RAG", "context window", "open weights", "fine-tuning", "headless browser", "token", "inference", "benchmark", "watermarking"); is explainable in 30 seconds. Prefer general, evergreen terms over product names.

Write spoken lines. Each line has:
- "tekst": what Byte says (max 140 characters). Read by a text-to-speech voice: no symbols, URLs or code; write numbers as words; spell acronyms the way people say them (e.g. "M C P", "RAG" is said as a word).
- "izraz": Byte's face: ${IZRAZI.join(', ')}.
- "kartica": what is on screen. Types:
  - pojam: dictionary-style definition; "tekst" (max 90 chars, *highlight* 1-3 key words); optional "podtekst" (max 40 chars).
  - tok: how it works as 2-4 boxes with arrows; "koraci" (each max 32 chars, *highlight* allowed); optional "naslov" (max 24 chars, e.g. "How it works").
  - tekst: a short statement card, e.g. an analogy or the takeaway; "tekst" (max 50 chars, *highlight*); optional "podtekst" (max 40 chars), "pecat" (stamp, max 14 chars).
  - likovi: 1-2 companies from the example story as cartoon characters {id, raspolozenje}; ids: openai, google, anthropic, meta, microsoft, xai, nvidia, apple, amazon, mistral, deepseek, alibaba, perplexity, huggingface, github, cursor (other companies: lowercase id plus "ime"); raspolozenje: ${RASPOLOZENJA.join(', ')}; plus "tekst" (max 50 chars).
  - broj: one big number from the facts; "broj" (e.g. "200K", "9x"), "naslov" (max 28 chars).

Structure (5 to 6 lines, 55 to 85 spoken words, about 30 to 40 seconds):
1. Hook: why the viewer should care, max 12 words (e.g. "Every AI company is suddenly shipping MCP servers. Here's why."). No greeting (the intro "I'm Byte, and this is <term>, explained in thirty seconds" is added automatically after it).
2. Definition in plain words (pojam card).
3. How it works or an everyday analogy (tok or tekst card).
4. The real example from today's news (likovi, broj or tekst card). Facts only from the news above.
5. Takeaway: why it matters to the viewer (tekst card).
(The "Follow" call to action is added automatically.)

Also return:
- "pojam": the term as shown on screen, max 18 characters (e.g. "MCP Server", "Context Window").
- "izgovor": how the voice should say the term (e.g. "an M C P server", "a context window").
- "podnaslov": max 40 characters, the one-line idea (e.g. "How AI apps plug into your tools").
- "naslov": YouTube title, max 70 characters, starting with "What is" or "What are", searchable (e.g. "What is an MCP server? AI explained in 30 seconds").
- "opis": 2-3 sentences for the description: the definition and the example, plain text.
- "pitanje": a question for the comments, max 80 characters, ending with " 👇".`;

const schema = JSON.stringify({
  type: 'object',
  properties: {
    pojam: { type: 'string' },
    izgovor: { type: 'string' },
    podnaslov: { type: 'string' },
    naslov: { type: 'string' },
    opis: { type: 'string' },
    pitanje: { type: 'string' },
    replike: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          tekst: { type: 'string' },
          izraz: { type: 'string', enum: IZRAZI },
          kartica: {
            type: 'object',
            properties: {
              tip: { type: 'string', enum: ['pojam', 'tok', 'tekst', 'likovi', 'broj'] },
              tekst: { type: 'string' },
              podtekst: { type: 'string' },
              pecat: { type: 'string' },
              koraci: { type: 'array', items: { type: 'string' } },
              naslov: { type: 'string' },
              broj: { type: 'string' },
              likovi: {
                type: 'array',
                items: { type: 'object', properties: { id: { type: 'string' }, ime: { type: 'string' }, raspolozenje: { type: 'string', enum: RASPOLOZENJA } }, required: ['id'] },
              },
            },
            required: ['tip'],
          },
        },
        required: ['tekst', 'izraz', 'kartica'],
      },
    },
  },
  required: ['pojam', 'izgovor', 'podnaslov', 'naslov', 'opis', 'pitanje', 'replike'],
});

const model = process.env.AI_WARS_MODEL || 'opus';
console.log(`Byte Explains #${broj} (${datum}): Claude bira pojam i piše scenario (model: ${model})…`);
const odgovor = await pitajClaude(prompt, { schema, model });
const sc = odgovor.structured_output;
if (odgovor.is_error || !sc) throw new Error(`Claude nije vratio scenario: ${odgovor.subtype ?? ''} ${odgovor.result ?? ''}`.trim());
const greske = proveri(sc);
if (greske.length) throw new Error(`Scenario nije ispravan:\n- ${greske.join('\n- ')}`);

const replike = [
  sc.replike[0],
  { tekst: `I'm Byte, and this is ${sc.izgovor}, explained in thirty seconds.`, izraz: 'happy', kartica: { tip: 'intro' } },
  ...sc.replike.slice(1),
  { tekst: 'Follow, and understand AI in thirty seconds a day.', izraz: 'happy', kartica: { tip: 'prati' } },
];
console.log(`Pojam: ${sc.pojam}\n${replike.map((r, i) => `  ${i + 1}. [${r.izraz} · ${r.kartica.tip}] ${r.tekst}`).join('\n')}`);

const radni = join(VIDEO_DIR, 'public', 'ep', `${datum}-explains`);
await rm(radni, { recursive: true, force: true });
await mkdir(radni, { recursive: true });
await ozvuci(replike, `ep/${datum}-explains`);
const fajl = `${datum}-short-explains.mp4`;
const propsFajl = join(radni, 'props.json');
await writeFile(propsFajl, JSON.stringify({ serija: 'explains', epizoda: broj, pojam: sc.pojam.slice(0, 22), podnaslov: sc.podnaslov.slice(0, 48), replike }));
console.log('Renderujem…');
await renderuj(propsFajl, join(INSTA_DIR, fajl));

const oznaka = `AI Morning Brief · ${datum} · explains`;
const stavka = {
  fajl,
  naslov: sc.naslov.slice(0, 95),
  opis: [
    sc.opis,
    `Byte Explains: one AI term in 30 seconds, every day. ${DRUSTVENE}`,
    'Subscribe and understand AI in 30 seconds a day.',
    '#AI #AIExplained #LearnAI #Shorts',
    oznaka,
  ].join('\n\n'),
  oznaka,
  plejlista: 'Byte Explains: AI in 30 Seconds',
  pitanje: sc.pitanje,
  tagovi: ['AI explained', 'what is', sc.pojam, 'AI', 'learn AI', 'AI for beginners'],
  naslovnaMs: naslovnaMs(replike),
  sekundi: trajanje(replike),
};

// Short sa vešću tog dana ide napolje: dnevno ostaju AI Wars, alat i objašnjenje (manje, a bolji videi).
const shortsFajl = join(INSTA_DIR, `${datum}-shorts.json`);
const lista = [];
for (const s of (await readJson(shortsFajl, null)) ?? []) {
  if (s.fajl === fajl) continue;
  if (/-short-\d+\.mp4$/.test(s.fajl)) {
    await rm(join(INSTA_DIR, s.fajl), { force: true });
    console.log(`Uklonjen Short ${s.fajl} (umesto vesti ide objašnjenje).`);
    continue;
  }
  lista.push(s);
}
lista.push(stavka);
await writeJson(shortsFajl, lista);

stanje.pojmovi = [...ranije, { datum, broj, pojam: sc.pojam }].sort((a, b) => a.broj - b.broj);
await writeJson(STANJE, stanje);
await rm(radni, { recursive: true, force: true });
console.log(`Napravljen Byte Explains #${broj}: ${fajl} (${stavka.sekundi} s) „${stavka.naslov}“`);

function proveri(s) {
  const g = [];
  if (s.replike.length < 3 || s.replike.length > 7) g.push(`${s.replike.length} replika (treba 5–6)`);
  const reci = s.replike.reduce((z, r) => z + r.tekst.split(/\s+/).length, 0);
  if (reci < 30 || reci > 115) g.push(`${reci} izgovorenih reči (treba 55–85)`);
  if (ranije.some((p) => p.pojam.toLowerCase() === s.pojam.toLowerCase())) g.push(`pojam „${s.pojam}“ je već objašnjen`);
  for (const [i, r] of s.replike.entries()) {
    if (r.tekst.length > 180) g.push(`replika ${i + 1} je preduga`);
    if (/[$%]|https?:|`/.test(r.tekst)) g.push(`replika ${i + 1} ima nešto što glas ne izgovara: ${r.tekst}`);
    if (r.kartica.tip === 'tok' && !(r.kartica.koraci?.length >= 2)) g.push(`replika ${i + 1}: tok bez bar dva koraka`);
    if (r.kartica.pecat) r.kartica.pecat = r.kartica.pecat.slice(0, 18);
  }
  return g;
}
