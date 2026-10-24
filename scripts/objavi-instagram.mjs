// Objavljuje današnje izdanje kao karusel na Instagram (@ai.morning.brief), preko Instagram API-ja sa Instagram prijavom.
// Slike pravi insta-slike.mjs i one moraju već biti na sajtu, jer ih Instagram preuzima sa javnog URL-a:
// skripta zato prvo sačeka da Vercel objavi novi build.
//
// Tajne (GitHub → Settings → Secrets → Actions): INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID (nije obavezan, čita se iz tokena).
// Ako tokena nema, tiho preskače, da izdanje ne zavisi od Instagrama.
// Ako je izdanje za taj dan već objavljeno (link sa datumom u opisu nekog od poslednjih postova), ne objavljuje ponovo.
//
// Pokretanje: node scripts/objavi-instagram.mjs
//             node scripts/objavi-instagram.mjs --datum=2026-10-24
//             node scripts/objavi-instagram.mjs --provera   (samo proveri token i limit, ništa ne objavljuje)

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, izaberiVesti, lepDatum, skrati } from './insta-slike.mjs';
import { DATA_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

const SAJT = 'https://news-one-teal.vercel.app';
const API = 'https://graph.instagram.com/v25.0';
const HASHTAGOVI = '#AI #ArtificialIntelligence #AINews #MachineLearning #LLM #GenerativeAI #TechNews';

const token = process.env.INSTAGRAM_ACCESS_TOKEN;
if (!token) {
  console.log('Instagram nije podešen (INSTAGRAM_ACCESS_TOKEN), preskačem.');
  process.exit(0);
}
const provera = process.argv.includes('--provera');
const datum = datumIzArgumenata();

async function graf(putanja, { metoda = 'GET', polja = {} } = {}) {
  const parametri = new URLSearchParams({ ...polja, access_token: token });
  const get = metoda === 'GET';
  // Token ide u telo POST zahteva, a ne u URL, da ne završi u logovima.
  const odgovor = await preuzmi(get ? `${API}${putanja}?${parametri}` : `${API}${putanja}`, {
    metoda,
    telo: get ? undefined : parametri,
    headers: get ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeoutMs: 60_000,
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok || podaci.error) {
    throw new Error(`Instagram ${metoda} ${putanja}: ${podaci.error?.message ?? odgovor.status}`);
  }
  return podaci;
}

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));

const ja = await graf('/me', { polja: { fields: 'user_id,username' } });
const korisnik = process.env.INSTAGRAM_USER_ID || ja.user_id;
const limit = (await graf(`/${korisnik}/content_publishing_limit`, { polja: { fields: 'quota_usage,config' } })).data?.[0];
console.log(`Instagram: @${ja.username}, objava u poslednja 24h: ${limit?.quota_usage ?? '?'}/${limit?.config?.quota_total ?? '?'}`);
if (provera) process.exit(0);

const linkIzdanja = `${SAJT}/izdanje/${datum}`;
const poslednji = await graf(`/${korisnik}/media`, { polja: { fields: 'caption,permalink', limit: '10' } });
const vecObjavljeno = poslednji.data?.find((m) => m.caption?.includes(linkIzdanja.replace('https://', '')));
if (vecObjavljeno) {
  console.log(`Izdanje ${datum} je već na Instagramu: ${vecObjavljeno.permalink}`);
  process.exit(0);
}

const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}, Instagram objava se preskače.`);

const slike = (await readdir(INSTA_DIR).catch(() => []))
  .filter((f) => new RegExp(`^${datum}-\\d+\\.jpg$`).test(f))
  .sort((a, b) => parseInt(a.slice(11)) - parseInt(b.slice(11)))
  .map((f) => `${SAJT}/insta/${f}`);
if (slike.length < 2) throw new Error(`Nema slika za ${datum} u public/insta (pokreni scripts/insta-slike.mjs).`);

// Vercel build traje par minuta posle git push-a.
for (let pokusaj = 1; ; pokusaj++) {
  const { status } = await preuzmi(`${slike.at(-1)}?v=${Date.now()}`, { metoda: 'HEAD' }).catch(() => ({ status: 0 }));
  if (status === 200) break;
  if (pokusaj >= 40) throw new Error(`Slike nisu na sajtu ni posle 20 minuta (${slike.at(-1)}: ${status}).`);
  if (pokusaj === 1) console.log('Čekam da Vercel objavi slike…');
  await spavaj(30_000);
}

const naslovi = izaberiVesti(izdanje).map((v, i) => `${i + 1}. ${v.naslov}`);
const opis = [
  `☕ AI Morning Brief · ${lepDatum(datum)}`,
  skrati(izdanje.ukratko, 900),
  `Today's top ${naslovi.length}:\n${naslovi.join('\n')}`,
  `Full brief with sources: ${linkIzdanja.replace('https://', '')} (link in bio)`,
  HASHTAGOVI,
].join('\n\n');

const deca = [];
for (const url of slike) {
  deca.push((await graf(`/${korisnik}/media`, { metoda: 'POST', polja: { image_url: url, is_carousel_item: 'true' } })).id);
}
const karusel = await graf(`/${korisnik}/media`, {
  metoda: 'POST',
  polja: { media_type: 'CAROUSEL', children: deca.join(','), caption: opis.slice(0, 2200) },
});

// Instagram obrađuje kontejner u pozadini; objava pre FINISHED vraća grešku.
for (let pokusaj = 1; ; pokusaj++) {
  const { status_code: stanje } = await graf(`/${karusel.id}`, { polja: { fields: 'status_code' } });
  if (stanje === 'FINISHED') break;
  if (stanje === 'ERROR' || stanje === 'EXPIRED' || pokusaj >= 30) throw new Error(`Karusel nije spreman: ${stanje}`);
  await spavaj(5_000);
}

const objava = await graf(`/${korisnik}/media_publish`, { metoda: 'POST', polja: { creation_id: karusel.id } });
const { permalink } = await graf(`/${objava.id}`, { polja: { fields: 'permalink' } });
console.log(`Objavljeno na Instagramu (${slike.length} slika): ${permalink}`);
