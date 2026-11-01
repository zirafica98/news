// Tool of the Day: Short sa maskotom Byte koji predstavlja alat iz „Novo izašlo“ (snimak sajta, koraci, ocena).
// Claude piše scenario, Kokoro daje glas, Remotion (video/) renderuje; snimak ekrana pravi video/snimak.mjs.
//
// Zamenjuje stare Shortove alata iz shorts.mjs (isti fajlovi DATUM-short-alat.mp4 i -alat2.mp4 i ista oznaka),
// pa ako ova skripta ne uspe, ostaje stari video. Alat svaki dan osim subote, drugi alat pon/sre/pet.
// Redni broj alata (#N) se vodi u scripts/state/alat-dana.json.
//
// Pokretanje: node scripts/alat-dana.mjs [--datum=YYYY-MM-DD]

import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { VIDEO_DIR, naslovnaMs, ozvuci, renderuj, snimiEkran, trajanje } from './byte-video.mjs';
import { pitajClaude } from './claude.mjs';
import { INSTA_DIR } from './insta-slike.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const STANJE = join(SCRIPTS_DIR, 'state', 'alat-dana.json');
const IZRAZI = ['happy', 'shock', 'worried', 'skeptic', 'laugh', 'sly'];
const DRUSTVENE = 'Instagram & Threads: @ai.morning.brief · Telegram: AI Morning Brief';

const datum = datumIzArgumenata();
const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);
if (!existsSync(join(VIDEO_DIR, 'node_modules'))) throw new Error('Nema paketa za video (npm ci --prefix video).');

// Isti izbor kao u shorts.mjs: alati i projekti prvi, pa ostalo što ima korake.
const dan = new Date(`${datum}T12:00:00Z`).getUTCDay();
const kandidati = (izdanje.novo ?? [])
  .filter((n) => n.kakoProbati?.length)
  .sort((a, b) => Number(!['alat', 'projekat'].includes(a.tip)) - Number(!['alat', 'projekat'].includes(b.tip)));
const zadaci = [];
if (dan !== 6 && kandidati[0]) zadaci.push({ id: 'alat', alat: kandidati[0] });
if ([1, 3, 5].includes(dan) && kandidati[1]) zadaci.push({ id: 'alat2', alat: kandidati[1] });
if (!zadaci.length) {
  console.log(`Za ${datum} nema alata (subota ili prazno „Novo izašlo“).`);
  process.exit(0);
}

const stanje = await readJson(STANJE, { alati: [] });
const shortsFajl = join(INSTA_DIR, `${datum}-shorts.json`);
let greske = 0;
for (const z of zadaci) {
  try {
    await napravi(z);
  } catch (err) {
    greske++;
    console.error(`Tool of the Day (${z.id}) nije napravljen, ostaje stari video: ${err.message}`);
  }
}
if (greske === zadaci.length) process.exit(1);

async function napravi({ id, alat }) {
  const broj = stanje.alati.find((a) => a.datum === datum && a.id === id)?.broj ?? Math.max(0, ...stanje.alati.map((a) => a.broj)) + 1;
  const radni = join(VIDEO_DIR, 'public', 'ep', `${datum}-${id}`);
  await rm(radni, { recursive: true, force: true });
  await mkdir(radni, { recursive: true });

  // 1. Snimak sajta (nije obavezan: bez njega kartica prikaže znak i tekst)
  const domen = alat.link ? new URL(alat.link).hostname.replace(/^www\./, '') : '';
  const snimak = alat.link && (await snimiEkran(alat.link, join(radni, 'ekran.png'))) ? `ep/${datum}-${id}/ekran.png` : undefined;

  // 2. Scenario
  const prompt = `You write a YouTube Short / Instagram Reel for "Tool of the Day #${broj}" by AI Morning Brief.
The narrator is Byte, a small robot mascot: witty, warm, a little sarcastic, plain spoken English, short punchy sentences.
Audience: developers and tech-curious people who want useful AI tools.

The tool (use ONLY these facts, never invent features, numbers or prices):
${JSON.stringify(alat, null, 1)}
${snimak ? `A screenshot of its page (${domen}) is available for an "ekran" card.` : 'There is no screenshot; do not use the "ekran" card.'}

Write spoken lines. Each line has:
- "tekst": what Byte says (max 140 characters). Read by a text-to-speech voice: no commands, URLs, code or symbols in speech. Say "the command is on screen" instead of reading it. Write numbers as words.
- "izraz": Byte's face: ${IZRAZI.join(', ')}.
- "kartica": what is on screen. Types:
  - ekran: the screenshot of the tool's page in a browser frame${snimak ? '' : ' (not available today)'}; optional "tekst" (max 45 chars, wrap 1-2 key words in *asterisks*).
  - korak: one step to try it; "korak" (1, 2...), "tekst" (max 40 chars, plain explanation), "kod" (the exact command from the facts, copied verbatim, max 90 chars; omit if the step has no command).
  - tekst: a short statement card; "tekst" (max 50 chars, *highlight*), optional "podtekst" (max 40 chars), optional "pecat" (stamp, max 14 chars, e.g. "16X LESS RAM").
  - broj: one big number from the facts that counts up; "broj" (e.g. "9x", "16x", "2GB"), "naslov" (max 28 chars).
  - mera: Byte's verdict gauge; "naslov": "Byte's verdict", "levo": "Skip", "desno": "Must try", "vrednost" 0..1, "tekst" (max 40 chars, e.g. the price).

Structure (4 to 6 lines, 50 to 85 spoken words, about 30 to 40 seconds):
1. Hook: what the tool lets you do or why it is surprising, concrete, max 12 words. No greeting (the intro "I'm Byte, tool of the day number ${broj}" with the tool name is added automatically after it).
2. What it is${snimak ? ' (ekran card)' : ''} and the most impressive fact.
3. One or two "korak" lines: how to try it, using the real steps.
4. A verdict line with the price and who it is for (mera card).
(The "Follow for a new AI tool every day" call to action is added automatically.)

Also return:
- "naslov": YouTube title, max 70 characters, searchable: tool name plus what it does (e.g. "Lightpanda: the headless browser 9x faster than Chrome for AI agents").
- "podnaslov": what the tool is in max 40 characters (e.g. "A tiny browser built for AI agents").
- "cena": price label for a badge, max 14 characters (e.g. "FREE", "FREE · OPEN SOURCE", "$20/MONTH").
- "pitanje": a question for the comments, max 80 characters, ending with " 👇".`;

  const schema = JSON.stringify({
    type: 'object',
    properties: {
      naslov: { type: 'string' },
      podnaslov: { type: 'string' },
      cena: { type: 'string' },
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
                tip: { type: 'string', enum: snimak ? ['ekran', 'korak', 'tekst', 'broj', 'mera'] : ['korak', 'tekst', 'broj', 'mera'] },
                tekst: { type: 'string' },
                podtekst: { type: 'string' },
                pecat: { type: 'string' },
                korak: { type: 'integer' },
                kod: { type: 'string' },
                broj: { type: 'string' },
                naslov: { type: 'string' },
                levo: { type: 'string' },
                desno: { type: 'string' },
                vrednost: { type: 'number' },
              },
              required: ['tip'],
            },
          },
          required: ['tekst', 'izraz', 'kartica'],
        },
      },
    },
    required: ['naslov', 'podnaslov', 'cena', 'pitanje', 'replike'],
  });

  const model = process.env.AI_WARS_MODEL || 'opus';
  console.log(`Tool of the Day #${broj} (${datum}, ${id}): ${alat.naziv} — Claude piše scenario (model: ${model})…`);
  const odgovor = await pitajClaude(prompt, { schema, model });
  const sc = odgovor.structured_output;
  if (odgovor.is_error || !sc) throw new Error(`Claude nije vratio scenario: ${odgovor.subtype ?? ''} ${odgovor.result ?? ''}`.trim());
  const greske = proveri(sc);
  if (greske.length) throw new Error(`Scenario nije ispravan:\n- ${greske.join('\n- ')}`);

  const naziv = alat.naziv.replace(/\s*\(.*\)\s*$/, '');
  const replike = [
    sc.replike[0],
    { tekst: `I'm Byte. Tool of the day, number ${broj}: ${naziv}.`, izraz: 'happy', kartica: { tip: 'intro' } },
    ...sc.replike.slice(1),
    { tekst: 'Follow for a new AI tool every day.', izraz: 'happy', kartica: { tip: 'prati' } },
  ];
  console.log(replike.map((r, i) => `  ${i + 1}. [${r.izraz} · ${r.kartica.tip}] ${r.tekst}`).join('\n'));

  // 3. Glas i render
  await ozvuci(replike, `ep/${datum}-${id}`);
  const fajl = `${datum}-short-${id}.mp4`;
  const propsFajl = join(radni, 'props.json');
  await writeFile(
    propsFajl,
    JSON.stringify({ serija: 'alat', epizoda: broj, podnaslov: sc.podnaslov.slice(0, 48), alat: { naziv: alat.naziv, domen, snimak, cena: sc.cena.slice(0, 18) }, replike }),
  );
  console.log('Renderujem…');
  await renderuj(propsFajl, join(INSTA_DIR, fajl));

  // 4. Stavka za objavu: menja stari Short alata na istom mestu u listi.
  const oznaka = `AI Morning Brief · ${datum} · ${id}`;
  const stavka = {
    fajl,
    naslov: `${sc.naslov} | AI Tool #${broj}`.slice(0, 95),
    opis: [
      cist(alat.opis),
      `How to try it:\n${alat.kakoProbati.map((k, i) => `${i + 1}. ${cist(k)}`).join('\n')}`,
      alat.cena ? `Price: ${cist(alat.cena)}` : '',
      alat.link ? `Official link: ${alat.link}` : '',
      `Tool of the Day: a new AI tool every day, explained by Byte. ${DRUSTVENE}`,
      '#AI #AITools #Developer #Shorts',
      oznaka,
    ]
      .filter(Boolean)
      .join('\n\n'),
    oznaka,
    plejlista: 'Try This AI Tool',
    pitanje: sc.pitanje,
    tagovi: ['AI tools', 'AI', naziv, 'developer tools', 'tool of the day'],
    naslovnaMs: naslovnaMs(replike),
    sekundi: trajanje(replike),
  };
  const lista = (await readJson(shortsFajl, null)) ?? [];
  const i = lista.findIndex((s) => s.fajl === fajl);
  if (i >= 0) lista[i] = stavka;
  else lista.push(stavka);
  await writeJson(shortsFajl, lista);

  stanje.alati = [...stanje.alati.filter((a) => !(a.datum === datum && a.id === id)), { datum, id, broj, naziv: alat.naziv }].sort((a, b) => a.broj - b.broj);
  await writeJson(STANJE, stanje);
  await rm(radni, { recursive: true, force: true });
  console.log(`Napravljen Tool of the Day #${broj}: ${fajl} (${stavka.sekundi} s) „${stavka.naslov}“`);
}

function proveri(s) {
  const g = [];
  if (s.replike.length < 3 || s.replike.length > 7) g.push(`${s.replike.length} replika (treba 4–6)`);
  const reci = s.replike.reduce((z, r) => z + r.tekst.split(/\s+/).length, 0);
  if (reci < 30 || reci > 115) g.push(`${reci} izgovorenih reči (treba 50–85)`);
  for (const [i, r] of s.replike.entries()) {
    if (r.tekst.length > 180) g.push(`replika ${i + 1} je preduga`);
    if (/[$%]|https?:|\/\/|`/.test(r.tekst)) g.push(`replika ${i + 1} ima nešto što glas ne izgovara: ${r.tekst}`);
    const k = r.kartica;
    if (k.vrednost != null) k.vrednost = Math.max(0, Math.min(1, k.vrednost));
    if (k.kod) k.kod = k.kod.slice(0, 120);
    if (k.pecat) k.pecat = k.pecat.slice(0, 18);
  }
  return g;
}

function cist(t) {
  return String(t ?? '').replace(/\s+/g, ' ').trim();
}
