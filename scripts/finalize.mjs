// Proverava nacrt izdanja i, ako je sve u redu, objavljuje ga:
//   1. kopira ga u public/data/YYYY-MM-DD.json
//   2. dopisuje ga u public/data/index.json
//   3. pamti linkove u scripts/state/objavljeno.json, da se sutra ne ponove
// Ako nacrt nije ispravan, ništa ne menja i završava sa greškom.
//
// Pokretanje: npm run finalize
//             npm run finalize -- --provera      (samo provera, bez objavljivanja)

import { azurirajIndex, proveriIzdanje } from './izdanje.mjs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PUBLIC_DIR, STATE_FILE, datumIzArgumenata, normalizeUrl, paths, readJson, writeJson } from './lib.mjs';

const KEEP_STATE_DAYS = 45;
const SAJT = 'https://www.aimorningbrief.dev';

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

// Prompt traži 5–10 glavnih vesti, a provera toleriše do 12 da izdanje ne bi palo zbog jedne viška.
// Višak se ovde odseca (vesti su poređane po važnosti); domaća vest (izSrbije) ostaje i kad je ispod granice.
const MAX_VESTI = 10;
if (izdanje.vesti.length > MAX_VESTI) {
  const prve = izdanje.vesti.slice(0, MAX_VESTI);
  const domaca = izdanje.vesti.slice(MAX_VESTI).find((v) => v.izSrbije);
  if (domaca && !prve.some((v) => v.izSrbije)) prve[MAX_VESTI - 1] = domaca;
  console.log(`Izdanje ima ${izdanje.vesti.length} vesti, objavljuje se prvih ${MAX_VESTI}.`);
  izdanje.vesti = prve;
}

await writeJson(paths.izdanje(datum), izdanje);

const brojIzdanja = await azurirajIndex(paths.index, izdanje);
await napraviPretragu();
await napraviFeedISitemap();

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

/** RSS feed i sitemap, da izdanja mogu da se prate čitačem i da sajt bude spreman ako postane javan. */
async function napraviFeedISitemap() {
  const sviDani = await readJson(paths.index, []);
  const index = sviDani.slice(0, 30);
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const stavke = index
    .map((e) => {
      const link = `${SAJT}/izdanje/${e.datum}`;
      const opis = [e.ukratko, ...e.naslovi.map((n) => `• ${n}`)].join('\n');
      return `    <item>
      <title>AI News · ${esc(e.datum)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${e.datum}T05:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(opis)}</description>
    </item>`;
    })
    .join('\n');

  await writeFile(
    join(PUBLIC_DIR, 'feed.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI News</title>
    <link>${SAJT}</link>
    <description>Jutarnji pregled AI vesti na srpskom</description>
    <language>sr-Latn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${stavke}
  </channel>
</rss>
`,
  );

  // /danas, /istrazivanje, /ideje i /mreze imaju canonical na dnevne strane (scripts/seo-strane.mjs), pa su ovde samo dnevne.
  const strane = ['', '/cene', '/arhiva'];
  const url = (putanja, datum) => `  <url><loc>${SAJT}${putanja}</loc><lastmod>${datum}</lastmod></url>`;
  const danas = index[0]?.datum ?? datum;
  // Sekcije dana i posebne strane vesti i alata (/izdanje/DATUM/vest/N, /novo/N) za sva izdanja.
  const pojedinacne = [];
  for (const e of sviDani) {
    for (const s of ['istrazivanje', 'ideje', 'mreze']) pojedinacne.push(url(`/izdanje/${e.datum}/${s}`, e.datum));
    const iz = await readJson(paths.izdanje(e.datum), null);
    if (!iz) continue;
    iz.vesti.forEach((_, i) => pojedinacne.push(url(`/izdanje/${e.datum}/vest/${i}`, e.datum)));
    (iz.novo ?? []).forEach((_, i) => pojedinacne.push(url(`/izdanje/${e.datum}/novo/${i}`, e.datum)));
  }
  await writeFile(
    join(PUBLIC_DIR, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...strane.map((s) => url(s, danas)), ...sviDani.map((e) => url(`/izdanje/${e.datum}`, e.datum)), ...pojedinacne].join('\n')}
</urlset>
`,
  );
}

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
