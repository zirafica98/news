// Skuplja sveže vesti iz scripts/sources.json i snima ih u scripts/out/vesti-YYYY-MM-DD.json.
// Bez AI-ja: samo preuzimanje, čišćenje teksta i izbacivanje duplikata.
//
// Pokretanje: npm run fetch                      (sve uključene izvore)
//             npm run fetch -- verge-ai            (samo navedene izvore, za testiranje)
//             npm run fetch -- --hours=168         (gleda nedelju dana unazad, za testiranje)

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, 'out');
const TIMEOUT_MS = 20_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AI-Jutro/1.0';

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const { sources } = JSON.parse(await readFile(join(ROOT, 'sources.json'), 'utf8'));
const args = process.argv.slice(2);
const hoursOverride = Number(args.find((a) => a.startsWith('--hours='))?.split('=')[1]) || null;
const onlyIds = args.filter((a) => !a.startsWith('--'));
const selected = sources.filter((s) => (onlyIds.length ? onlyIds.includes(s.id) : s.enabled));

const now = new Date();
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(now); // YYYY-MM-DD

const results = await Promise.all(selected.map(fetchSource));

const seen = new Set();
const vesti = [];
for (const { items } of results) {
  for (const item of items) {
    const key = normalizeUrl(item.url) || item.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    vesti.push(item);
  }
}

const output = {
  datum: today,
  skupljeno: now.toISOString(),
  izvori: results.map(({ source, items, error }) => ({
    id: source.id,
    naziv: source.name,
    grupa: source.group,
    tip: source.type,
    broj: items.length,
    ...(error && { greska: error }),
  })),
  // Izvori bez RSS-a: Claude ih otvara sam.
  stranice: selected.filter((s) => s.type === 'page').map((s) => ({ id: s.id, naziv: s.name, url: s.url })),
  vesti,
};

await mkdir(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `vesti-${today}.json`);
await writeFile(outFile, JSON.stringify(output, null, 2));

printSummary(output, outFile);

// ---------------------------------------------------------------------------

async function fetchSource(source) {
  if (source.type === 'page') return { source, items: [] };
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.text();
    const all = source.type === 'hf-papers' ? parseHfPapers(body, source) : parseFeed(body, source);
    const since = now.getTime() - (hoursOverride ?? source.hours ?? 30) * 3_600_000;
    let items = all.filter((i) => i.objavljeno && new Date(i.objavljeno).getTime() >= since);
    if (source.limit) items = items.slice(0, source.limit);
    if (source.fullText) items = await Promise.all(items.map((i) => withPageText(i, source)));
    return { source, items };
  } catch (err) {
    return { source, items: [], error: err.name === 'TimeoutError' ? 'isteklo vreme' : err.message };
  }
}

// Neki feedovi (npr. TLDR) imaju samo naslov, pa tekst uzimamo sa same stranice.
async function withPageText(item, source) {
  if (item.tekst || !item.url) return item;
  try {
    const res = await fetch(item.url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return item;
    const pageText = htmlToText((await res.text()).replace(/<(head|nav|footer|header)[\s\S]*?<\/\1>/gi, ' '));
    return { ...item, tekst: truncate(pageText, source.maxChars ?? 1500) };
  } catch {
    return item;
  }
}

function parseFeed(body, source) {
  const doc = xml.parse(body);
  const rssItems = doc.rss?.channel?.item;
  const atomEntries = doc.feed?.entry;
  const entries = toArray(rssItems ?? atomEntries);

  return entries.map((e) => {
    const date = e.pubDate ?? e.published ?? e['atom:published'] ?? e['dc:date'] ?? e.updated;
    const html = e['content:encoded'] ?? e.content ?? e.description ?? e.summary ?? '';
    return {
      izvor: source.id,
      grupa: source.group,
      naslov: cleanText(text(e.title)),
      url: feedLink(e),
      objavljeno: toIso(text(date)),
      tekst: truncate(htmlToText(text(html)), source.maxChars ?? 1500),
      ...(e.comments && { komentari: text(e.comments) }),
    };
  });
}

function parseHfPapers(body, source) {
  return JSON.parse(body)
    .map(({ paper }) => ({
      izvor: source.id,
      grupa: source.group,
      naslov: cleanText(paper.title),
      url: `https://huggingface.co/papers/${paper.id}`,
      objavljeno: paper.submittedOnDailyAt ?? paper.publishedAt,
      tekst: truncate(cleanText(paper.ai_summary || paper.summary || ''), source.maxChars ?? 1200),
      glasovi: paper.upvotes ?? 0,
      ...(paper.githubRepo && { github: paper.githubRepo, githubZvezdice: paper.githubStars ?? 0 }),
      ...(paper.projectPage && { stranicaProjekta: paper.projectPage }),
    }))
    .sort((a, b) => b.glasovi - a.glasovi);
}

function feedLink(e) {
  if (typeof e.link === 'string') return e.link.trim();
  const links = toArray(e.link);
  const alt = links.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate') ?? links[0];
  return (alt?.['@_href'] ?? text(alt) ?? text(e.guid) ?? '').trim();
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'object') return String(value['#text'] ?? '');
  return String(value);
}

function toArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value];
}

function toIso(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function htmlToText(html) {
  return cleanText(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<(br|\/p|\/div|\/li|\/h\d)[^>]*>/gi, '\n')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<[^>]+>/g, ' '),
  );
}

function cleanText(value) {
  return decodeEntities(String(value))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(s) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => named[n.toLowerCase()] ?? m);
}

function truncate(s, max) {
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) if (p.startsWith('utm_')) u.searchParams.delete(p);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${u.search}`;
  } catch {
    return '';
  }
}

function printSummary({ izvori, stranice, vesti }, file) {
  console.log(`\nAI Jutro — skupljanje vesti za ${today}\n`);
  for (const i of izvori) {
    const status = i.greska ? `✗ ${i.greska}` : i.tip === 'page' ? '→ čita Claude' : `${i.broj}`;
    console.log(`  ${i.naziv.padEnd(34)} ${status}`);
  }
  const failed = izvori.filter((i) => i.greska).length;
  console.log(`\nUkupno: ${vesti.length} vesti, ${stranice.length} stranice za Claude-a${failed ? `, ${failed} izvora sa greškom` : ''}`);
  console.log(`Snimljeno: ${file}\n`);
}
