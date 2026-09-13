// Snima današnje cene tokena sa OpenRouter-a i računa kako se menjaju.
//   - istorija (samo promene) ide u scripts/state/cene-istorija.json
//   - ono što sajt prikazuje ide u public/data/cene.json
// Bez AI-ja. Cene su u dolarima za 1 milion tokena.
//
// Pokretanje: npm run prices
//             npm run prices -- --datum=2026-09-13

import { join } from 'node:path';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const API_URL = 'https://openrouter.ai/api/v1/models';
const HISTORY_FILE = join(SCRIPTS_DIR, 'state', 'cene-istorija.json');
const OUTPUT_FILE = join(DATA_DIR, 'cene.json');
const NEW_MODEL_DAYS = 14;
const CHANGES_DAYS = 30;

const datum = datumIzArgumenata();
const config = await readJson(join(SCRIPTS_DIR, 'cene-modeli.json'));

const res = await fetch(API_URL, { signal: AbortSignal.timeout(30_000) });
if (!res.ok) throw new Error(`OpenRouter je vratio HTTP ${res.status}`);
const { data } = await res.json();

// Pratimo sve obične (ne :batch, :free…) modele poznatih provajdera, da istorija postoji i za modele koje kasnije dodamo.
const models = new Map(
  data
    .filter((m) => !m.id.includes(':') && config.provajderi.includes(m.id.split('/')[0]))
    .map((m) => [m.id, { ...m, ulaz: perMillion(m.pricing?.prompt), izlaz: perMillion(m.pricing?.completion) }])
    .filter(([, m]) => m.ulaz > 0 || m.izlaz > 0),
);

// 1. Istorija: novi red samo kad se cena promeni (ili se model prvi put pojavi).
const history = await readJson(HISTORY_FILE, {});
for (const [id, m] of models) {
  const entries = (history[id] ??= []);
  const last = entries.at(-1);
  if (last && last[1] === m.ulaz && last[2] === m.izlaz) continue;
  if (last?.[0] === datum) entries[entries.length - 1] = [datum, m.ulaz, m.izlaz];
  else entries.push([datum, m.ulaz, m.izlaz]);
}
await writeJson(HISTORY_FILE, Object.fromEntries(Object.entries(history).sort()));

const pratimoOd = Object.values(history).flat().map((e) => e[0]).sort()[0] ?? datum;

// 2. Stranica sa cenama.
const missing = [];
const grupe = config.grupe.map((g) => ({
  id: g.id,
  naziv: g.naziv,
  opis: g.opis,
  modeli: g.modeli
    .map(({ id, prethodnik }) => {
      const m = models.get(id);
      if (!m) {
        missing.push(id);
        return null;
      }
      const p = prethodnik ? models.get(prethodnik) : null;
      if (prethodnik && !p) missing.push(prethodnik);
      return {
        ...modelInfo(m),
        kontekst: m.context_length ?? null,
        kesUlaz: perMillion(m.pricing?.input_cache_read) || null,
        promena7: changeSince(id, 7),
        promena30: changeSince(id, 30),
        prethodnik: p ? { naziv: shortName(p), ulaz: p.ulaz, izlaz: p.izlaz, razlikaUlaz: percent(p.ulaz, m.ulaz), razlikaIzlaz: percent(p.izlaz, m.izlaz) } : null,
      };
    })
    .filter(Boolean),
}));

const changesFrom = shiftDays(datum, -CHANGES_DAYS);
const promene = Object.entries(history)
  .flatMap(([id, entries]) =>
    entries.slice(1).map((e, i) => ({ id, datum: e[0], ulazPre: entries[i][1], izlazPre: entries[i][2], ulaz: e[1], izlaz: e[2] })),
  )
  .filter((c) => c.datum >= changesFrom && models.has(c.id))
  .sort((a, b) => b.datum.localeCompare(a.datum))
  .slice(0, 20)
  .map((c) => ({ ...c, naziv: shortName(models.get(c.id)), provajder: models.get(c.id).id.split('/')[0] }));

const newFrom = Date.parse(shiftDays(datum, -NEW_MODEL_DAYS)) / 1000;
const noviModeli = [...models.values()]
  .filter((m) => m.created >= newFrom)
  .sort((a, b) => b.created - a.created)
  .slice(0, 12)
  .map((m) => ({ ...modelInfo(m), kontekst: m.context_length ?? null }));

await writeJson(OUTPUT_FILE, {
  datum,
  azurirano: new Date().toISOString(),
  izvor: { naziv: 'OpenRouter', url: 'https://openrouter.ai/models' },
  pratimoOd,
  grupe,
  promene,
  noviModeli,
});

console.log(`Cene za ${datum}: ${models.size} modela praćeno, ${promene.length} promena u ${CHANGES_DAYS} dana, ${noviModeli.length} novih modela.`);
if (missing.length) console.warn(`Nema na OpenRouter-u (proveri scripts/cene-modeli.json): ${[...new Set(missing)].join(', ')}`);

// ---------------------------------------------------------------------------

function perMillion(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1e6 * 10_000) / 10_000 : 0;
}

function shortName(m) {
  return m.name.replace(/^[^:]+:\s*/, '');
}

function modelInfo(m) {
  return {
    id: m.id,
    naziv: shortName(m),
    provajder: m.id.split('/')[0],
    ulaz: m.ulaz,
    izlaz: m.izlaz,
    objavljen: new Date(m.created * 1000).toISOString().slice(0, 10),
  };
}

function percent(before, after) {
  return before > 0 ? Math.round(((after - before) / before) * 1000) / 10 : null;
}

function shiftDays(d, days) {
  return new Date(Date.parse(d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** Promena u procentima u odnosu na cenu od pre N dana, ili null ako tada još nismo pratili cene. */
function changeSince(id, days) {
  const target = shiftDays(datum, -days);
  const entries = history[id] ?? [];
  if (!entries.length || entries[0][0] > target) return null;
  const then = entries.filter((e) => e[0] <= target).at(-1);
  const now = entries.at(-1);
  return { ulaz: percent(then[1], now[1]), izlaz: percent(then[2], now[2]) };
}
