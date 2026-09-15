// Skuplja sveže vesti iz scripts/sources.json i snima ih u scripts/out/vesti-YYYY-MM-DD.json.
// Bez AI-ja: samo preuzimanje, čišćenje teksta i izbacivanje duplikata.
// Preskače vesti koje su već bile u nekom ranijem izdanju (scripts/state/objavljeno.json).
//
// Pokretanje: npm run fetch                      (sve uključene izvore)
//             npm run fetch -- verge-ai            (samo navedene izvore, za testiranje)
//             npm run fetch -- --hours=168         (gleda nedelju dana unazad, za testiranje)
//             npm run fetch -- --sve               (ne preskače već objavljene vesti)
//             npm run fetch -- --ponovo            (ne preskače vesti objavljene danas, za ponovno pravljenje današnjeg izdanja)

import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { SCRIPTS_DIR, STATE_FILE, datumIzArgumenata, normalizeUrl, paths, preuzmi, readJson, writeJson } from './lib.mjs';

const TIMEOUT_MS = 20_000;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AI-News/1.0';

// Za izvore sa "samoAI": true (opšti tech portali): zadržava samo članke koji pominju AI u naslovu ili početku teksta.
// „AI“ se traži samo velikim slovima, da se ne poklopi sa delovima reči.
const AI_SKRACENICA = /\bA\.?I\b/;
const AI_POJMOVI =
  /(veštačk|vestačk|vještačk|umjetn[a-z]* inteligenc|umetn[a-z]* inteligenc|chatgpt|openai|claude|anthropic|gemini|\bllm|copilot|deepseek|mašinsk[a-z]* učenj|machine learning|neuronsk|neural|četbot|chatbot|\bagent|\bgpt|mistral|llama|hugging ?face|jezičk[a-z]* model|language model)/i;

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const { sources } = await readJson(join(SCRIPTS_DIR, 'sources.json'));
const args = process.argv.slice(2);
const hoursOverride = Number(args.find((a) => a.startsWith('--hours='))?.split('=')[1]) || null;
const onlyIds = args.filter((a) => !a.startsWith('--'));
const selected = sources.filter((s) => (onlyIds.length ? onlyIds.includes(s.id) : s.enabled));

const now = new Date();
const today = datumIzArgumenata(args);
const ponovo = args.includes('--ponovo');
const alreadyPublished = args.includes('--sve')
  ? {}
  : Object.fromEntries(Object.entries(await readJson(STATE_FILE, {})).filter(([, d]) => !(ponovo && d === today)));

const results = await Promise.all(selected.map(fetchSource));

const seen = new Set();
const vesti = [];
let skipped = 0;
for (const { items } of results) {
  for (const item of items) {
    const key = normalizeUrl(item.url) || item.naslov.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (alreadyPublished[key]) {
      skipped++;
      continue;
    }
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

const outFile = paths.vesti(today);
await writeJson(outFile, output);

printSummary(output, outFile);

// ---------------------------------------------------------------------------

async function fetchSource(source) {
  if (source.type === 'page') return { source, items: [] };
  try {
    const res = await preuzmi(source.url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: TIMEOUT_MS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = res.tekst;
    const all = source.type === 'hf-papers' ? parseHfPapers(body, source) : parseFeed(body, source);
    const since = now.getTime() - (hoursOverride ?? source.hours ?? 30) * 3_600_000;
    let items = all.filter((i) => i.objavljeno && new Date(i.objavljeno).getTime() >= since);
    if (source.samoAI) items = items.filter((i) => AI_SKRACENICA.test(i.naslov) || AI_POJMOVI.test(`${i.naslov} ${i.tekst.slice(0, 400)}`) || AI_SKRACENICA.test(i.tekst.slice(0, 400)));
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
    const res = await preuzmi(item.url, { headers: { 'User-Agent': USER_AGENT }, timeoutMs: TIMEOUT_MS });
    if (!res.ok) return item;
    const pageText = htmlToText(res.tekst.replace(/<(head|nav|footer|header)[\s\S]*?<\/\1>/gi, ' '));
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
  // Neki feedovi (npr. GitHub Trending) nemaju datum po stavci, samo za ceo feed.
  const channelDate = source.datumKanala ? (doc.rss?.channel?.pubDate ?? doc.rss?.channel?.lastBuildDate ?? doc.feed?.updated) : undefined;

  return entries.map((e) => {
    const date = e.pubDate ?? e.published ?? e['atom:published'] ?? e['dc:date'] ?? e.updated ?? channelDate;
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

function printSummary({ izvori, stranice, vesti }, file) {
  console.log(`\nAI News — skupljanje vesti za ${today}\n`);
  for (const i of izvori) {
    const status = i.greska ? `✗ ${i.greska}` : i.tip === 'page' ? '→ čita Claude' : `${i.broj}`;
    console.log(`  ${i.naziv.padEnd(34)} ${status}`);
  }
  const failed = izvori.filter((i) => i.greska).length;
  console.log(`\nUkupno: ${vesti.length} vesti, ${stranice.length} stranice za Claude-a${skipped ? `, ${skipped} već objavljeno ranije` : ''}${failed ? `, ${failed} izvora sa greškom` : ''}`);
  console.log(`Snimljeno: ${file}\n`);
}
