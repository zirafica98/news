// Daje Claude Code-u (na ovom Mac-u, preko pretplate) skupljene vesti i dobija izdanje kao JSON.
// Rezultat ide u scripts/out/izdanje-YYYY-MM-DD.json. Na sajt ga prebacuje tek finalize.mjs, posle provere.
//
// Pokretanje: npm run digest
//             npm run digest -- --datum=2026-09-13
//             npm run digest -- --nedeljni     (i van subote traži nedeljni pregled, za testiranje)
// Model se menja preko AI_JUTRO_MODEL (podrazumevano: opus).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pitajClaude } from './claude.mjs';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, paths, readJson, writeJson } from './lib.mjs';

const RECENT_DAYS = 7;

const datum = datumIzArgumenata();
const model = process.env.AI_JUTRO_MODEL || 'opus';

const skupljeno = await readJson(paths.vesti(datum), null).catch(() => null);
if (!skupljeno) {
  console.error(`Nema skupljenih vesti za ${datum}. Prvo pokreni: npm run fetch`);
  process.exit(1);
}

// Nedeljni pregled ide uz subotnje izdanje.
const subota = new Date(`${datum}T12:00:00Z`).getUTCDay() === 6 || process.argv.includes('--nedeljni');

const material = {
  datum,
  stranice: skupljeno.stranice,
  nedavno: await recentHeadlines(),
  ocene: await ocene(),
  ...(subota && { nedelja: await nedeljniMaterijal() }),
  cene: await priceSummary(),
  vesti: skupljeno.vesti,
};
const prompt = `${await readFile(join(SCRIPTS_DIR, 'prompt.md'), 'utf8')}\n\n## Materijal za ${datum}\n\n\`\`\`json\n${JSON.stringify(material)}\n\`\`\`\n`;
const schema = await readFile(join(SCRIPTS_DIR, 'digest-schema.json'), 'utf8');

console.log(`AI News — Claude piše izdanje za ${datum} (${skupljeno.vesti.length} vesti, model: ${model})…`);
const started = Date.now();

const result = await pitajClaude(prompt, { schema, model, webFetch: true });

if (result.is_error || !result.structured_output) {
  console.error(`Claude nije vratio izdanje: ${result.subtype ?? ''} ${result.result ?? ''}`.trim());
  process.exit(1);
}

const izdanje = {
  datum,
  generisano: new Date().toISOString(),
  model: Object.keys(result.modelUsage ?? {})[0] ?? model,
  ...result.structured_output,
};
await writeJson(paths.nacrt(datum), izdanje);

const minutes = ((Date.now() - started) / 60_000).toFixed(1);
console.log(
  `Gotovo za ${minutes} min: ${izdanje.vesti.length} vesti, ${izdanje.novo.length} novih stvari, ` +
    `${izdanje.istrazivanje.length} radova, ${izdanje.ideje.length} ideja (${result.num_turns} koraka).`,
);
console.log(`Nacrt: ${paths.nacrt(datum)}`);

// ---------------------------------------------------------------------------

/** Sažetak public/data/cene.json, samo ako je osvežen danas. */
async function priceSummary() {
  const cene = await readJson(join(DATA_DIR, 'cene.json'), null);
  if (!cene || cene.datum !== datum) return null;
  // Najjeftinije računamo ovde, da Claude ne bi pogrešio poredeći brojeve.
  const najjeftiniji = (modeli, polje) => {
    const min = Math.min(...modeli.map((m) => m[polje]));
    return { cena: min, modeli: modeli.filter((m) => m[polje] === min).map((m) => m.naziv) };
  };
  return {
    pratimoOd: cene.pratimoOd,
    najjeftinijiPoKlasi: cene.grupe.map((g) => ({
      klasa: g.naziv,
      ulaz: najjeftiniji(g.modeli, 'ulaz'),
      izlaz: najjeftiniji(g.modeli, 'izlaz'),
    })),
    promene: cene.promene.map(({ naziv, datum: d, ulazPre, izlazPre, ulaz, izlaz }) => ({ naziv, datum: d, ulazPre, izlazPre, ulaz, izlaz })),
    modeli: cene.grupe.flatMap((g) =>
      g.modeli.map((m) => ({
        klasa: g.naziv,
        naziv: m.naziv,
        ulaz: m.ulaz,
        izlaz: m.izlaz,
        promena7: m.promena7,
        promena30: m.promena30,
        prethodnik: m.prethodnik && { naziv: m.prethodnik.naziv, ulaz: m.prethodnik.ulaz, izlaz: m.prethodnik.izlaz },
      })),
    ),
    noviModeli: cene.noviModeli.map(({ naziv, provajder, ulaz, izlaz, objavljen }) => ({ naziv, provajder, ulaz, izlaz, objavljen })),
  };
}

/** Palac gore/dole koje je čitalac dao na sajtu (poslednjih 60). */
async function ocene() {
  const sve = await readJson(join(SCRIPTS_DIR, 'state', 'ocene.json'), []);
  if (!sve.length) return null;
  const poslednje = sve.slice(-60);
  return {
    korisno: poslednje.filter((o) => o.ocena === 1).map((o) => `${o.tip}: ${o.naslov}`),
    neZanima: poslednje.filter((o) => o.ocena === -1).map((o) => `${o.tip}: ${o.naslov}`),
  };
}

/** Sažetak prethodnih 7 izdanja, za subotnji nedeljni pregled. */
async function nedeljniMaterijal() {
  const index = await readJson(paths.index, []);
  const dani = index.filter((e) => e.datum < datum).slice(0, 7);
  const izdanja = [];
  for (const { datum: d } of dani) {
    const iz = await readJson(paths.izdanje(d), null);
    if (!iz) continue;
    izdanja.push({
      datum: d,
      ukratko: iz.ukratko,
      vesti: iz.vesti.map((v) => ({ naslov: v.naslov, vaznost: v.vaznost })),
      novo: iz.novo.map((n) => n.naziv),
      teme: iz.mreze?.teme?.map((t) => t.naslov) ?? [],
      cene: iz.cene ?? null,
    });
  }
  return izdanja;
}

async function recentHeadlines() {
  const index = await readJson(paths.index, []);
  const recent = index.filter((e) => e.datum < datum).slice(0, RECENT_DAYS);
  const vesti = [];
  const ideje = [];
  for (const { datum: d } of recent) {
    const izdanje = await readJson(paths.izdanje(d), null);
    if (!izdanje) continue;
    vesti.push(...izdanje.vesti.map((v) => v.naslov));
    ideje.push(...izdanje.ideje.map((i) => i.naziv));
  }
  return { vesti, ideje };
}
