// Zajedničke stvari za jutarnje skripte.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_DIR = join(SCRIPTS_DIR, '..');
export const OUT_DIR = join(SCRIPTS_DIR, 'out');
export const STATE_FILE = join(SCRIPTS_DIR, 'state', 'objavljeno.json');
export const DATA_DIR = join(REPO_DIR, 'public', 'data');

export const paths = {
  vesti: (datum) => join(OUT_DIR, `vesti-${datum}.json`),
  nacrt: (datum) => join(OUT_DIR, `izdanje-${datum}.json`),
  izdanje: (datum) => join(DATA_DIR, `${datum}.json`),
  index: join(DATA_DIR, 'index.json'),
  pretraga: join(DATA_DIR, 'pretraga.json'),
};

/** Današnji datum po beogradskom vremenu (YYYY-MM-DD), ili onaj prosleđen kao --datum=YYYY-MM-DD. */
export function datumIzArgumenata(args = process.argv.slice(2)) {
  const zadat = args.find((a) => a.startsWith('--datum='))?.split('=')[1];
  if (zadat && !/^\d{4}-\d{2}-\d{2}$/.test(zadat)) throw new Error(`Neispravan datum: ${zadat}`);
  return zadat ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date());
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (err) {
    if (fallback !== undefined && err.code === 'ENOENT') return fallback;
    throw err;
  }
}

export async function writeJson(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

/**
 * fetch sa ograničenim vremenom, zajedno sa čitanjem odgovora.
 * Ne koristi AbortSignal.timeout: njegov tajmer ne drži Node živim, pa kad veza zastane
 * (npr. posle spavanja računara) Node izađe sa kodom 13 umesto da prijavi isteklo vreme.
 */
export async function preuzmi(url, { timeoutMs = 20_000, headers, metoda, telo } = {}) {
  const kontroler = new AbortController();
  const tajmer = setTimeout(() => kontroler.abort(new DOMException('isteklo vreme', 'TimeoutError')), timeoutMs);
  try {
    const res = await fetch(url, { method: metoda, body: telo, headers, signal: kontroler.signal });
    return { ok: res.ok, status: res.status, tekst: await res.text() };
  } finally {
    clearTimeout(tajmer);
  }
}

/** Isti članak sa različitim utm_ parametrima, www ili kosom crtom na kraju daje isti ključ. */
export function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) if (p.startsWith('utm_')) u.searchParams.delete(p);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return '';
  }
}
