// Proverava nacrt izdanja i, ako je sve u redu, objavljuje ga:
//   1. kopira ga u public/data/YYYY-MM-DD.json
//   2. dopisuje ga u public/data/index.json
//   3. pamti linkove u scripts/state/objavljeno.json, da se sutra ne ponove
// Ako nacrt nije ispravan, ništa ne menja i završava sa greškom.
//
// Pokretanje: npm run finalize
//             npm run finalize -- --provera      (samo provera, bez objavljivanja)

import { STATE_FILE, datumIzArgumenata, normalizeUrl, paths, readJson, writeJson } from './lib.mjs';

const KEEP_STATE_DAYS = 45;

const datum = datumIzArgumenata();
const samoProvera = process.argv.includes('--provera');

const izdanje = await readJson(paths.nacrt(datum), null);
if (!izdanje) {
  console.error(`Nema nacrta za ${datum}. Prvo pokreni: npm run digest`);
  process.exit(1);
}

const greske = validate(izdanje);
if (greske.length) {
  console.error(`Izdanje za ${datum} NIJE ispravno:\n${greske.map((g) => `  • ${g}`).join('\n')}`);
  process.exit(1);
}
console.log(`Izdanje za ${datum} je ispravno.`);
if (samoProvera) process.exit(0);

await writeJson(paths.izdanje(datum), izdanje);

const index = (await readJson(paths.index, [])).filter((e) => e.datum !== datum);
index.push({
  datum,
  ukratko: izdanje.ukratko,
  naslovi: izdanje.vesti.slice(0, 3).map((v) => v.naslov),
  broj: {
    vesti: izdanje.vesti.length,
    novo: izdanje.novo.length,
    istrazivanje: izdanje.istrazivanje.length,
    ideje: izdanje.ideje.length,
  },
});
index.sort((a, b) => b.datum.localeCompare(a.datum));
await writeJson(paths.index, index);

// Pamtimo sve što je Claude video, ne samo ono što je izabrao, da sutra ne dobije iste vesti.
const skupljeno = await readJson(paths.vesti(datum), { vesti: [] });
const urls = [
  ...skupljeno.vesti.map((v) => v.url),
  ...izdanje.vesti.flatMap((v) => v.izvori.map((i) => i.url)),
  ...izdanje.novo.map((n) => n.link),
  ...izdanje.istrazivanje.map((r) => r.url),
];
const cutoff = new Date(Date.parse(datum) - KEEP_STATE_DAYS * 86_400_000).toISOString().slice(0, 10);
const state = Object.fromEntries(Object.entries(await readJson(STATE_FILE, {})).filter(([, d]) => d >= cutoff));
for (const url of urls) {
  const key = normalizeUrl(url);
  if (key && !state[key]) state[key] = datum;
}
await writeJson(STATE_FILE, Object.fromEntries(Object.entries(state).sort()));

console.log(`Objavljeno: ${paths.izdanje(datum)} (u arhivi ukupno ${index.length} izdanja)`);

// ---------------------------------------------------------------------------

function validate(d) {
  const errors = [];
  const text = (v) => typeof v === 'string' && v.trim().length > 0;
  const link = (v) => typeof v === 'string' && /^https?:\/\/\S+$/.test(v);
  const check = (ok, msg) => ok || errors.push(msg);
  const list = (v) => (Array.isArray(v) ? v : []);

  check(d.datum === datum, `datum je "${d.datum}", a treba "${datum}"`);
  check(text(d.ukratko), 'nema „ukratko“');
  check(text(d.cene), 'nema komentara o cenama');

  check(list(d.vesti).length >= 1 && list(d.vesti).length <= 12, `vesti: ${list(d.vesti).length} (treba 1–12)`);
  list(d.vesti).forEach((v, i) => {
    const n = `vest ${i + 1}`;
    check(text(v.naslov) && text(v.staSeDesilo) && text(v.zastoJeBitno), `${n}: prazan tekst`);
    check([1, 2, 3].includes(v.vaznost), `${n}: važnost mora biti 1–3`);
    check(list(v.izvori).length > 0 && list(v.izvori).every((s) => text(s.naziv) && link(s.url)), `${n}: izvori nemaju ispravan link`);
  });

  check(list(d.novo).length <= 8, `novo: ${list(d.novo).length} (najviše 8)`);
  list(d.novo).forEach((x, i) => {
    const n = `novo ${i + 1}`;
    check(text(x.naziv) && text(x.opis) && text(x.cena), `${n}: prazan tekst`);
    check(list(x.kakoProbati).length > 0 && list(x.kakoProbati).every(text), `${n}: nema koraka „kako probati“`);
    check(link(x.link), `${n}: neispravan link`);
  });

  check(list(d.istrazivanje).length <= 5, `istraživanje: ${list(d.istrazivanje).length} (najviše 5)`);
  list(d.istrazivanje).forEach((r, i) => {
    const n = `rad ${i + 1}`;
    check(text(r.naslov) && text(r.objasnjenje) && text(r.zastoJeZanimljivo), `${n}: prazan tekst`);
    check(link(r.url), `${n}: neispravan link`);
    check(r.github === null || link(r.github), `${n}: neispravan GitHub link`);
  });

  check(list(d.ideje).length === 5, `ideje: ${list(d.ideje).length} (treba tačno 5)`);
  list(d.ideje).forEach((x, i) => {
    const n = `ideja ${i + 1}`;
    check(text(x.naziv) && text(x.problem) && text(x.zaKoga) && text(x.ulogaAi) && text(x.inspiracija), `${n}: prazan tekst`);
    check([1, 2, 3, 4, 5].includes(x.tezina), `${n}: težina mora biti 1–5`);
    check(typeof x.vikendProjekat === 'boolean', `${n}: vikendProjekat mora biti da/ne`);
    check(list(x.prviKoraci).length > 0 && list(x.prviKoraci).every(text), `${n}: nema prvih koraka`);
  });

  return errors;
}
