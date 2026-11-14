// Posle `ng build` pravi posebnu HTML stranu za svaku javnu adresu sajta, da pretraživači i mreže
// (Google, Bing, Facebook, X, Telegram, LinkedIn) odmah vide pravi naslov, opis, sliku i tekst,
// bez čekanja da se pokrene JavaScript.
//
// Za svaku adresu se kopira dist index.html i u njega upisuju:
//   • <title>, meta description, canonical, Open Graph i Twitter oznake
//   • JSON-LD (WebSite i Organization, NewsArticle, CollectionPage, BreadcrumbList)
//   • tekst strane u <app-root>; Angular ga briše čim se pokrene i prikaže svoju verziju
// Generička verzija (bez canonical i teksta) ide u app.html i služi za sve ostale adrese (vercel.json).
//
// Pokretanje: node scripts/seo-strane.mjs   (automatski posle `npm run build`)

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KOREN = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(KOREN, 'dist/ai-jutro/browser');
const PODACI = join(KOREN, 'public/data/en');
const SAJT = 'https://www.aimorningbrief.dev';
const IME = 'AI Morning Brief';
const SLOGAN = 'AI news & tools for developers';
const OPIS = 'The 5-minute morning brief for developers: what happened in AI, why it matters, and a new AI tool you can try today.';
const LOGO = `${SAJT}/icon-512.png`;
const MREZE = [
  ['YouTube', 'https://www.youtube.com/@ai-morning-brief'],
  ['Instagram', 'https://www.instagram.com/ai.morning.brief/'],
  ['Threads', 'https://www.threads.net/@ai.morning.brief'],
  ['Telegram', 'https://t.me/aimorningbrief'],
];
const KATEGORIJE = {
  modeli: 'Models',
  alati: 'Tools',
  kompanije: 'Companies',
  istrazivanje: 'Research',
  bezbednost: 'Security',
  regulativa: 'Regulation',
  ostalo: 'Other',
};

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Opis do ~155 znakova, presečen na granici reči. */
const skrati = (t, n = 155) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '')}…`;
};
const datumTekst = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const objavljeno = (d) => `${d}T05:00:00Z`;
const slika = (d, vrsta, i) => {
  const putanja = `/insta/${d}-${vrsta}-${i}-og.jpg`;
  return existsSync(join(KOREN, 'public', putanja)) ? `${SAJT}${putanja}` : `${SAJT}/og.jpg`;
};

const izdavac = { '@type': 'Organization', name: IME, url: SAJT, logo: { '@type': 'ImageObject', url: LOGO } };
const mrvice = (stavke) => ({
  '@type': 'BreadcrumbList',
  itemListElement: stavke.map(([name, put], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SAJT}${put}` })),
});

// ---------- Šablon ----------

const sablon = await readFile(join(DIST, 'index.html'), 'utf8');
if (!sablon.includes('<app-root></app-root>')) throw new Error('dist index.html nema <app-root></app-root>; da li je build uspeo?');

/** Uklanja oznake iz index.html koje svaka strana piše sama. */
const osnova = sablon
  .replace(/<title>[\s\S]*?<\/title>\s*/, '')
  .replace(/<meta name="description"[^>]*>\s*/, '')
  .replace(/<meta property="og:(title|description|image|type)"[^>]*>\s*/g, '')
  .replace(/<meta name="twitter:card"[^>]*>\s*/, '');

function strana({ put, naslov: puniNaslov, opis, slikaUrl = `${SAJT}/og.jpg`, tip = 'website', jsonld = [], telo = '', indeks = true, canonical = put }) {
  const url = `${SAJT}${canonical}`;
  // Google seče naslove oko 60 znakova; dug naslov vesti ide bez imena sajta.
  const naslov = puniNaslov.length > 65 && puniNaslov.endsWith(` · ${IME}`) ? puniNaslov.slice(0, -` · ${IME}`.length) : puniNaslov;
  const cist = naslov.replace(` · ${IME}`, '');
  const glava = [
    `<title>${esc(naslov)}</title>`,
    `<meta name="description" content="${esc(opis)}">`,
    indeks ? '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">' : '<meta name="robots" content="noindex, follow">',
    put === null ? '' : `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${tip}">`,
    `<meta property="og:title" content="${esc(cist)}">`,
    `<meta property="og:description" content="${esc(opis)}">`,
    put === null ? '' : `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${slikaUrl}">`,
    `<meta property="og:image:alt" content="${esc(cist)}">`,
    '<meta property="og:locale" content="en_US">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${esc(cist)}">`,
    `<meta name="twitter:description" content="${esc(opis)}">`,
    `<meta name="twitter:image" content="${slikaUrl}">`,
    jsonld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': jsonld }).replace(/</g, '\\u003c')}</script>` : '',
  ]
    .filter(Boolean)
    .join('\n  ');
  return osnova
    .replace(/<meta charset="utf-8">/, `<meta charset="utf-8">\n  ${glava}`)
    .replace('<app-root></app-root>', `<app-root>${telo ? `<div class="mx-auto max-w-3xl px-4 py-10 text-slate-300">${navigacija}${telo}</div>` : ''}</app-root>`);
}

const navigacija = `<nav><a href="/">${IME}</a> · <a href="/today">Today</a> · <a href="/research">Research</a> · <a href="/ideas">Ideas</a> · <a href="/social">Social</a> · <a href="/prices">Prices</a> · <a href="/archive">Archive</a></nav>`;

const napisane = [];
async function napisi(put, html) {
  const fajl = put === '/' ? join(DIST, 'index.html') : join(DIST, put.slice(1), 'index.html');
  await mkdir(dirname(fajl), { recursive: true });
  await writeFile(fajl, html);
  napisane.push(put);
}

// ---------- Podaci ----------

const readJson = async (f, z) => {
  try {
    return JSON.parse(await readFile(f, 'utf8'));
  } catch {
    return z;
  }
};
const index = await readJson(join(PODACI, 'index.json'), []);
const izdanja = [];
for (const { datum } of index) {
  const iz = await readJson(join(PODACI, `${datum}.json`), null);
  if (iz?.vesti) izdanja.push(iz);
}
const najnovije = izdanja[0];

// ---------- Delovi tela ----------

const linkVesti = (d, i, v) => `<li><a href="/brief/${d}/story/${i}">${esc(v.naslov)}</a> — ${esc(skrati(v.zastoJeBitno, 140))}</li>`;
const linkNovo = (d, i, n) => `<li><a href="/brief/${d}/tool/${i}">${esc(n.naziv)}</a> — ${esc(skrati(n.opis, 140))}</li>`;

function teloIzdanja(iz) {
  const d = iz.datum;
  return `<h1>AI news for ${esc(datumTekst(d))}</h1>
<p>${esc(iz.ukratko)}</p>
<h2>Top stories</h2><ul>${iz.vesti.map((v, i) => linkVesti(d, i, v)).join('')}</ul>
${iz.novo.length ? `<h2>New AI tools to try</h2><ul>${iz.novo.map((n, i) => linkNovo(d, i, n)).join('')}</ul>` : ''}
${iz.kratkeVesti?.length ? `<h2>In brief</h2><ul>${iz.kratkeVesti.map((k) => `<li><a href="${esc(k.url)}" rel="noopener">${esc(k.naslov)}</a> (${esc(k.izvor)})</li>`).join('')}</ul>` : ''}
<p><a href="/brief/${d}/research">Research</a> · <a href="/brief/${d}/ideas">App ideas</a> · <a href="/brief/${d}/social">What people are talking about</a></p>`;
}

function jsonldIzdanja(iz, put) {
  const d = iz.datum;
  return [
    {
      '@type': 'CollectionPage',
      '@id': `${SAJT}${put}`,
      url: `${SAJT}${put}`,
      name: `AI news for ${datumTekst(d)}`,
      description: skrati(iz.ukratko),
      datePublished: objavljeno(d),
      inLanguage: 'en',
      isPartOf: { '@id': `${SAJT}/#website` },
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: iz.vesti.map((v, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SAJT}/brief/${d}/story/${i}`, name: v.naslov })),
      },
    },
    mrvice([[IME, '/'], [datumTekst(d), `/brief/${d}`]]),
  ];
}

// ---------- Strane ----------

// Početna
{
  const vesti = najnovije ? najnovije.vesti.map((v, i) => ({ v, i })).filter(({ v }) => !v.izSrbije).sort((a, b) => b.v.vaznost - a.v.vaznost || a.i - b.i) : [];
  await napisi(
    '/',
    strana({
      put: '/',
      naslov: `${IME} · ${SLOGAN}`,
      opis: OPIS,
      jsonld: [
        { '@type': 'WebSite', '@id': `${SAJT}/#website`, url: `${SAJT}/`, name: IME, description: OPIS, inLanguage: 'en', publisher: { '@id': `${SAJT}/#organization` } },
        { ...izdavac, '@id': `${SAJT}/#organization`, description: OPIS, sameAs: MREZE.map(([, u]) => u) },
      ],
      telo: `<h1>${esc(SLOGAN)}</h1>
<p>${esc(OPIS)}</p>
${najnovije ? `<h2>Today's brief: ${esc(datumTekst(najnovije.datum))}</h2><p>${esc(najnovije.ukratko)}</p><ul>${vesti.map(({ v, i }) => linkVesti(najnovije.datum, i, v)).join('')}</ul><p><a href="/brief/${najnovije.datum}">Read the full brief</a></p>` : ''}
<h2>Follow us</h2><ul>${MREZE.map(([n, u]) => `<li><a href="${u}" rel="noopener">${n}</a></li>`).join('')}</ul>`,
    }),
  );
}

// Najnovije izdanje i sekcije bez datuma (sadržaj je isti kao dnevne strane, pa canonical ide na njih)
if (najnovije) {
  const d = najnovije.datum;
  await napisi('/today', strana({ put: '/today', canonical: `/brief/${d}`, naslov: `Today's AI news · ${IME}`, opis: skrati(najnovije.ukratko), slikaUrl: slika(d, 'vest', 0), jsonld: jsonldIzdanja(najnovije, `/brief/${d}`), telo: teloIzdanja(najnovije) }));
}

const SEKCIJE = {
  research: {
    naslov: 'AI research of the day',
    opis: (iz) => skrati(`The most interesting AI papers of ${datumTekst(iz.datum)}, explained simply: ${iz.istrazivanje.map((r) => r.naslov).join('; ')}`),
    telo: (iz) => `<h1>AI research of the day</h1><p>The most interesting AI papers, explained simply.</p>${iz.istrazivanje.map((r) => `<article><h2>${esc(r.naslov)}</h2><p>${esc(r.objasnjenje)}</p><p>${esc(r.zastoJeZanimljivo)}</p><p><a href="${esc(r.url)}" rel="noopener">Paper</a>${r.github ? ` · <a href="${esc(r.github)}" rel="noopener">Code on GitHub</a>` : ''}</p></article>`).join('')}`,
  },
  ideas: {
    naslov: 'AI app ideas for developers',
    opis: (iz) => skrati(`Five app ideas you could build with AI, inspired by the news of ${datumTekst(iz.datum)}: ${iz.ideje.map((i) => i.naziv).join('; ')}`),
    telo: (iz) => `<h1>Top 5 AI app ideas</h1><p>Inspired by today's news.</p>${iz.ideje.map((i) => `<article><h2>${esc(i.naziv)}</h2><p>${esc(i.problem)}</p><p>Who it's for: ${esc(i.zaKoga)}</p><p>How AI helps: ${esc(i.ulogaAi)}</p><ol>${i.prviKoraci.map((k) => `<li>${esc(k)}</li>`).join('')}</ol></article>`).join('')}`,
  },
  social: {
    naslov: 'What developers are saying about AI',
    opis: (iz) => skrati(`The AI topics people are talking about on X, Reddit, Hacker News and YouTube: ${(iz.mreze?.teme ?? []).map((t) => t.naslov).join('; ')}`),
    telo: (iz) => `<h1>What people are talking about</h1>${(iz.mreze?.teme ?? []).map((t) => `<article><h2>${esc(t.naslov)}</h2><p>${esc(t.oCemuSePrica)}</p><p>${esc(t.glasovi)}</p></article>`).join('')}`,
  },
};

for (const [sekcija, s] of Object.entries(SEKCIJE)) {
  if (najnovije) {
    const d = najnovije.datum;
    await napisi(`/${sekcija}`, strana({ put: `/${sekcija}`, canonical: `/brief/${d}/${sekcija}`, naslov: `${s.naslov} · ${IME}`, opis: s.opis(najnovije), telo: s.telo(najnovije) }));
  }
  for (const iz of izdanja) {
    const put = `/brief/${iz.datum}/${sekcija}`;
    await napisi(
      put,
      strana({
        put,
        naslov: `${s.naslov}, ${datumTekst(iz.datum)} · ${IME}`,
        opis: s.opis(iz),
        jsonld: [mrvice([[IME, '/'], [datumTekst(iz.datum), `/brief/${iz.datum}`], [s.naslov, put]])],
        telo: s.telo(iz),
      }),
    );
  }
}

// Cene, arhiva, sačuvano
const cene = await readJson(join(KOREN, 'public/data/cene.json'), null);
await napisi(
  '/prices',
  strana({
    put: '/prices',
    naslov: `AI model token prices, tracked daily · ${IME}`,
    opis: 'Compare input and output token prices of GPT, Claude, Gemini, DeepSeek, Qwen and other AI models. Updated every day from OpenRouter.',
    telo: `<h1>AI model token prices</h1><p>Which models are cheapest this week, tracked daily since ${esc(cene?.pratimoOd ?? '2026')}.</p>${najnovije?.cene ? `<p>${esc(najnovije.cene)}</p>` : ''}`,
  }),
);
await napisi(
  '/archive',
  strana({
    put: '/archive',
    naslov: `Archive of AI news briefs · ${IME}`,
    opis: 'Every AI Morning Brief edition: daily AI news, new tools, research and app ideas for developers.',
    telo: `<h1>Archive</h1><ul>${izdanja.map((iz) => `<li><a href="/brief/${iz.datum}">${esc(datumTekst(iz.datum))}</a> — ${esc(skrati(iz.ukratko, 140))}</li>`).join('')}</ul>`,
  }),
);
await napisi('/saved', strana({ put: '/saved', naslov: `Saved · ${IME}`, opis: OPIS, indeks: false }));

// Dnevna izdanja, vesti i alati
for (const iz of izdanja) {
  const d = iz.datum;
  const putIzdanja = `/brief/${d}`;
  await napisi(putIzdanja, strana({ put: putIzdanja, naslov: `AI news, ${datumTekst(d)} · ${IME}`, opis: skrati(iz.ukratko), slikaUrl: slika(d, 'vest', 0), jsonld: jsonldIzdanja(iz, putIzdanja), telo: teloIzdanja(iz) }));

  for (const [i, v] of iz.vesti.entries()) {
    const put = `/brief/${d}/story/${i}`;
    const slikaUrl = slika(d, 'vest', i);
    await napisi(
      put,
      strana({
        put,
        tip: 'article',
        naslov: `${v.naslov} · ${IME}`,
        opis: skrati(v.staSeDesilo),
        slikaUrl,
        jsonld: [
          {
            '@type': 'NewsArticle',
            '@id': `${SAJT}${put}#article`,
            mainEntityOfPage: `${SAJT}${put}`,
            headline: skrati(v.naslov, 110),
            description: skrati(v.staSeDesilo),
            image: [slikaUrl],
            datePublished: objavljeno(d),
            dateModified: iz.generisano ?? objavljeno(d),
            articleSection: KATEGORIJE[v.kategorija] ?? 'AI',
            inLanguage: 'en',
            author: { '@type': 'Organization', name: IME, url: SAJT },
            publisher: izdavac,
            isBasedOn: v.izvori.map((s) => s.url),
          },
          mrvice([[IME, '/'], [datumTekst(d), putIzdanja], [v.naslov, put]]),
        ],
        telo: `<article><p>${esc(KATEGORIJE[v.kategorija] ?? '')} · <time datetime="${d}">${esc(datumTekst(d))}</time></p>
<h1>${esc(v.naslov)}</h1>
<h2>What happened</h2><p>${esc(v.staSeDesilo)}</p>
<h2>Why it matters</h2><p>${esc(v.zastoJeBitno)}</p>
<h2>Sources</h2><ul>${v.izvori.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.naziv)}</a></li>`).join('')}</ul></article>
<h2>More from this brief</h2><ul>${iz.vesti.map((o, j) => (j === i ? '' : linkVesti(d, j, o))).join('')}</ul>`,
      }),
    );
  }

  for (const [i, n] of iz.novo.entries()) {
    const put = `/brief/${d}/tool/${i}`;
    const slikaUrl = slika(d, 'novo', i);
    await napisi(
      put,
      strana({
        put,
        tip: 'article',
        naslov: `${n.naziv}: how to try it · ${IME}`,
        opis: skrati(n.opis),
        slikaUrl,
        jsonld: [
          {
            '@type': 'Article',
            '@id': `${SAJT}${put}#article`,
            mainEntityOfPage: `${SAJT}${put}`,
            headline: skrati(`${n.naziv}: how to try it`, 110),
            description: skrati(n.opis),
            image: [slikaUrl],
            datePublished: objavljeno(d),
            inLanguage: 'en',
            author: { '@type': 'Organization', name: IME, url: SAJT },
            publisher: izdavac,
            about: { '@type': n.tip === 'model' ? 'Thing' : 'SoftwareApplication', name: n.naziv, url: n.link },
          },
          mrvice([[IME, '/'], [datumTekst(d), putIzdanja], [n.naziv, put]]),
        ],
        telo: `<article><h1>${esc(n.naziv)}</h1><p>${esc(n.opis)}</p>
<h2>How to try it</h2><ol>${n.kakoProbati.map((k) => `<li>${esc(k)}</li>`).join('')}</ol>
<p>Price: ${esc(n.cena)}</p><p><a href="${esc(n.link)}" rel="noopener">Official link</a></p></article>
<h2>More new tools</h2><ul>${iz.novo.map((o, j) => (j === i ? '' : linkNovo(d, j, o))).join('')}</ul>`,
      }),
    );
  }
}

// Generička strana za sve ostale adrese (vercel.json je šalje umesto index.html)
await writeFile(join(DIST, 'app.html'), strana({ put: null, naslov: `${IME} · ${SLOGAN}`, opis: OPIS }));

console.log(`SEO: ${napisane.length} strana (${izdanja.length} izdanja) + app.html`);
