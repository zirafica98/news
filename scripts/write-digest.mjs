// Daje Claude Code-u (na ovom Mac-u, preko pretplate) skupljene vesti i dobija izdanje kao JSON.
// Rezultat ide u scripts/out/izdanje-YYYY-MM-DD.json. Na sajt ga prebacuje tek finalize.mjs, posle provere.
//
// Pokretanje: npm run digest
//             npm run digest -- --datum=2026-09-13
// Model se menja preko AI_JUTRO_MODEL (podrazumevano: opus).

import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, paths, readJson, writeJson } from './lib.mjs';

const TIMEOUT_MS = 25 * 60_000;
const RECENT_DAYS = 7;

const datum = datumIzArgumenata();
const model = process.env.AI_JUTRO_MODEL || 'opus';
const claudeBin = process.env.CLAUDE_BIN || 'claude';

const skupljeno = await readJson(paths.vesti(datum), null).catch(() => null);
if (!skupljeno) {
  console.error(`Nema skupljenih vesti za ${datum}. Prvo pokreni: npm run fetch`);
  process.exit(1);
}

const material = {
  datum,
  stranice: skupljeno.stranice,
  nedavno: await recentHeadlines(),
  cene: await priceSummary(),
  vesti: skupljeno.vesti,
};
const prompt = `${await readFile(join(SCRIPTS_DIR, 'prompt.md'), 'utf8')}\n\n## Materijal za ${datum}\n\n\`\`\`json\n${JSON.stringify(material)}\n\`\`\`\n`;
const schema = await readFile(join(SCRIPTS_DIR, 'digest-schema.json'), 'utf8');

console.log(`AI Jutro — Claude piše izdanje za ${datum} (${skupljeno.vesti.length} vesti, model: ${model})…`);
const started = Date.now();

// Prazan privremeni folder, da Claude ne pokupi CLAUDE.md i podešavanja iz repoa.
const workDir = await mkdtemp(join(tmpdir(), 'ai-jutro-'));
let result;
try {
  result = await runClaude(prompt, schema, workDir);
} finally {
  await rm(workDir, { recursive: true, force: true });
}

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

function runClaude(input, jsonSchema, cwd) {
  const args = [
    '-p',
    '--restricted',
    '--strict-mcp-config',
    '--tools', 'WebFetch',
    '--allowedTools', 'WebFetch',
    '--permission-mode', 'dontAsk',
    '--no-session-persistence',
    '--output-format', 'json',
    '--json-schema', jsonSchema,
    '--model', model,
    ...(model === 'sonnet' ? [] : ['--fallback-model', 'sonnet']),
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(claudeBin, args, { cwd, timeout: TIMEOUT_MS, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (signal) return reject(new Error(`Claude je prekinut (${signal}), verovatno je isteklo ${TIMEOUT_MS / 60_000} minuta.`));
      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error(`Claude je završio sa kodom ${code}.\n${stderr || stdout}`.trim()));
      }
    });
    child.stdin.end(input);
  });
}

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
