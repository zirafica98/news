// Najnoviji videi sa YouTube kanala za početnu stranu sajta: čita javni RSS kanala (bez ključa)
// i upisuje public/data/videi.json. Ako RSS ne radi, stari fajl ostaje.
//
// Pokretanje: node scripts/videi.mjs

import { join } from 'node:path';
import { DATA_DIR, preuzmi, writeJson } from './lib.mjs';

const KANAL = 'UCM86-lHlv65hOscGe3hUQLg';
const MAX = 12;

const res = await preuzmi(`https://www.youtube.com/feeds/videos.xml?channel_id=${KANAL}`);
if (!res.ok) {
  console.error(`YouTube RSS nije dostupan (${res.status}), videi.json ostaje kakav je.`);
  process.exit(0);
}

const dekoduj = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const videi = [...res.tekst.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
  .map(([, e]) => {
    const id = e.match(/<yt:videoId>([^<]+)/)?.[1];
    const naslov = dekoduj(e.match(/<title>([^<]*)/)?.[1] ?? '');
    const link = e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? '';
    return id && { id, naslov, datum: e.match(/<published>([^<]+)/)?.[1] ?? '', url: link || `https://www.youtube.com/watch?v=${id}`, short: link.includes('/shorts/') };
  })
  .filter(Boolean)
  .slice(0, MAX);

await writeJson(join(DATA_DIR, 'videi.json'), videi);
console.log(`Videi za sajt: ${videi.length} (public/data/videi.json)`);
