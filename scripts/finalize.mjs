// Proverava nacrt izdanja i, ako je sve u redu, objavljuje ga:
//   1. kopira ga u public/data/YYYY-MM-DD.json
//   2. dopisuje ga u public/data/index.json
//   3. pamti linkove u scripts/state/objavljeno.json, da se sutra ne ponove
// Ako nacrt nije ispravan, ništa ne menja i završava sa greškom.
//
// Pokretanje: npm run finalize
//             npm run finalize -- --provera      (samo provera, bez objavljivanja)

import { azurirajIndex, proveriIzdanje } from './izdanje.mjs';
import { STATE_FILE, datumIzArgumenata, normalizeUrl, paths, readJson, writeJson } from './lib.mjs';

const KEEP_STATE_DAYS = 45;

const datum = datumIzArgumenata();
const samoProvera = process.argv.includes('--provera');

const izdanje = await readJson(paths.nacrt(datum), null);
if (!izdanje) {
  console.error(`Nema nacrta za ${datum}. Prvo pokreni: npm run digest`);
  process.exit(1);
}

const greske = proveriIzdanje(izdanje, datum);
if (greske.length) {
  console.error(`Izdanje za ${datum} NIJE ispravno:\n${greske.map((g) => `  • ${g}`).join('\n')}`);
  process.exit(1);
}
console.log(`Izdanje za ${datum} je ispravno.`);
if (samoProvera) process.exit(0);

await writeJson(paths.izdanje(datum), izdanje);

const brojIzdanja = await azurirajIndex(paths.index, izdanje);
await napraviPretragu();

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

console.log(`Objavljeno: ${paths.izdanje(datum)} (u arhivi ukupno ${brojIzdanja} izdanja)`);

/**
 * Sitan spisak svega objavljenog, za pretragu na sajtu bez servera.
 * Pravi se iznova od svih izdanja, da bi obuhvatio i ranije dane.
 */
async function napraviPretragu() {
  const index = await readJson(paths.index, []);
  const kratko = (t) => (t.length > 160 ? `${t.slice(0, 160).trimEnd()}…` : t);
  const dani = [];
  for (const { datum: d } of index) {
    const iz = await readJson(paths.izdanje(d), null);
    if (!iz) continue;
    dani.push({
      datum: d,
      stavke: [
        ...iz.vesti.map((v) => ({ tip: 'vest', naslov: v.naslov, tekst: kratko(v.staSeDesilo) })),
        ...(iz.kratkeVesti ?? []).map((v) => ({ tip: 'kratka', naslov: v.naslov, url: v.url })),
        ...iz.novo.map((n) => ({ tip: 'novo', naslov: n.naziv, tekst: kratko(n.opis) })),
        ...iz.istrazivanje.map((r) => ({ tip: 'istrazivanje', naslov: r.naslov, tekst: kratko(r.objasnjenje) })),
        ...iz.ideje.map((i) => ({ tip: 'ideja', naslov: i.naziv, tekst: kratko(i.problem) })),
        ...(iz.mreze?.teme ?? []).map((t) => ({ tip: 'tema', naslov: t.naslov, tekst: kratko(t.oCemuSePrica) })),
      ],
    });
  }
  await writeJson(paths.pretraga, dani);
}
