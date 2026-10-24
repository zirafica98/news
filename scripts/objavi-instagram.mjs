// Objavljuje izdanje na Instagram (@ai.morning.brief), preko Instagram API-ja sa Instagram prijavom:
//   1. karusel (post),
//   2. subotom nedeljni Reel (rekapitulacija nedelje, iz nedeljnog pregleda),
//   3. iste slajdove kao story, samo za današnje izdanje (story traje 24h).
// Slike i video pravi insta-slike.mjs i moraju već biti na sajtu, jer ih Instagram preuzima sa javnog URL-a:
// skripta zato prvo sačeka da Vercel objavi novi build.
//
// Tajne (GitHub → Settings → Secrets → Actions): INSTAGRAM_ACCESS_TOKEN, INSTAGRAM_USER_ID (nije obavezan, čita se iz tokena).
// Ako tokena nema, tiho preskače, da izdanje ne zavisi od Instagrama.
// Ništa se ne objavljuje dvaput: post i Reel se prepoznaju po naslovu sa datumom u opisu, a story se preskače
// ako na profilu već ima story-ja od danas. Opis nema link ka sajtu ni izvore.
//
// Pokretanje: node scripts/objavi-instagram.mjs
//             node scripts/objavi-instagram.mjs --datum=2026-10-24
//             node scripts/objavi-instagram.mjs --provera   (samo proveri token i limit, ništa ne objavljuje)

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, izaberiVesti, lepDatum, opsegNedelje, skrati } from './insta-slike.mjs';
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

let potrosnja = '';

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
  // X-App-Usage pokazuje koliko je potrošeno od limita poziva po satu (u procentima).
  potrosnja = odgovor.zaglavlja?.get('x-app-usage') ?? odgovor.zaglavlja?.get('x-business-use-case-usage') ?? potrosnja;
  if (!odgovor.ok || podaci.error) {
    throw new Error(`Instagram ${metoda} ${putanja}: ${podaci.error?.message ?? odgovor.status}${potrosnja ? ` (potrošnja: ${potrosnja})` : ''}`);
  }
  return podaci;
}

/** Post za taj datum među poslednjim objavama (po prvom redu opisa sa datumom), ako postoji. */
async function nadjiObjavu(korisnik, oznaka) {
  const poslednji = await graf(`/${korisnik}/media`, { polja: { fields: 'caption,permalink', limit: '10' } });
  return poslednji.data?.find((m) => m.caption?.includes(oznaka));
}

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));
const beogradDatum = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date(iso));

/** Čeka da fajl bude na sajtu. Dok ga nema, sajt vraća stranicu aplikacije (HTML) sa statusom 200, pa se gleda i vrsta sadržaja. */
async function cekajNaSajtu(url, vrsta) {
  for (let pokusaj = 1; ; pokusaj++) {
    const res = await fetch(`${url}?v=${Date.now()}`, { method: 'HEAD' }).catch(() => null);
    const status = res?.status ?? 0;
    if (status === 200 && res.headers.get('content-type')?.startsWith(vrsta)) return;
    if (pokusaj >= 40) throw new Error(`Fajl nije na sajtu ni posle 20 minuta (${url}: ${status}).`);
    if (pokusaj === 1) console.log('Čekam da Vercel objavi slike…');
    await spavaj(30_000);
  }
}

/** Instagram obrađuje kontejner u pozadini; objava pre FINISHED vraća grešku. Proverava se retko, jer app ima limit poziva po satu. */
async function cekajKontejner(id, { pauza = 10_000, pokusaja = 18 } = {}) {
  for (let pokusaj = 1; ; pokusaj++) {
    await spavaj(pauza);
    const { status_code: stanje } = await graf(`/${id}`, { polja: { fields: 'status_code' } });
    if (stanje === 'FINISHED') return;
    if (stanje === 'ERROR' || stanje === 'EXPIRED' || pokusaj >= pokusaja) throw new Error(`Kontejner ${id} nije spreman: ${stanje}`);
  }
}

/**
 * media_publish zna da vrati grešku (npr. „Application request limit reached“) iako je objava prošla,
 * pa se posle greške prvo proveri profil (proveri() vraća link ili true), a tek onda pokušava ponovo.
 */
async function objavi(korisnik, id, proveri) {
  for (let pokusaj = 1; ; pokusaj++) {
    try {
      const objava = await graf(`/${korisnik}/media_publish`, { metoda: 'POST', polja: { creation_id: id } });
      const { permalink } = await graf(`/${objava.id}`, { polja: { fields: 'permalink' } }).catch(() => ({}));
      return permalink ?? objava.id;
    } catch (err) {
      console.log(`${err.message}. Proveravam profil za minut…`);
      await spavaj(60_000);
      const nadjeno = await proveri().catch(() => null);
      if (nadjeno) return nadjeno;
      if (pokusaj >= 3) throw err;
      console.log('Objava nije na profilu, pokušavam ponovo za 5 minuta…');
      await spavaj(5 * 60_000);
    }
  }
}

const ja = await graf('/me', { polja: { fields: 'user_id,username' } });
const korisnik = process.env.INSTAGRAM_USER_ID || ja.user_id;
const limit = (await graf(`/${korisnik}/content_publishing_limit`, { polja: { fields: 'quota_usage,config' } })).data?.[0];
console.log(`Instagram: @${ja.username}, objava u poslednja 24h: ${limit?.quota_usage ?? '?'}/${limit?.config?.quota_total ?? '?'}`);
if (provera) process.exit(0);

const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}, Instagram objava se preskače.`);

const fajlovi = await readdir(INSTA_DIR).catch(() => []);
const redom = (prefiks) =>
  fajlovi
    .filter((f) => new RegExp(`^${datum}-${prefiks}\\d+\\.jpg$`).test(f))
    .sort((a, b) => parseInt(a.match(/(\d+)\.jpg$/)[1]) - parseInt(b.match(/(\d+)\.jpg$/)[1]))
    .map((f) => `${SAJT}/insta/${f}`);

let greske = 0;
async function korak(naziv, posao) {
  try {
    await posao();
  } catch (err) {
    greske++;
    console.error(`Instagram ${naziv} nije uspeo: ${err.message}`);
  }
}

// 1. Karusel. Opis ne sme da sadrži link ka sajtu ni izvore, pa se objava za dan prepoznaje po naslovu sa datumom.
await korak('post', async () => {
  const oznaka = `AI Morning Brief · ${lepDatum(datum)}`;
  const vecObjavljeno = await nadjiObjavu(korisnik, oznaka);
  if (vecObjavljeno) return console.log(`Post za ${datum} je već na Instagramu: ${vecObjavljeno.permalink}`);

  const slike = redom('');
  if (slike.length < 2) throw new Error(`nema slika za ${datum} u public/insta (pokreni scripts/insta-slike.mjs)`);
  await cekajNaSajtu(slike.at(-1), 'image/jpeg');

  const naslovi = izaberiVesti(izdanje).map((v, i) => `${i + 1}. ${v.naslov}`);
  const opis = [
    `☕ ${oznaka}`,
    skrati(izdanje.ukratko, 900),
    `Today's top ${naslovi.length}:\n${naslovi.join('\n')}`,
    `Follow for tomorrow's brief ☕`,
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
  await cekajKontejner(karusel.id);
  const link = await objavi(korisnik, karusel.id, async () => (await nadjiObjavu(korisnik, oznaka))?.permalink);
  console.log(`Objavljen post (${slike.length} slika): ${link}`);
  if (potrosnja) console.log(`Potrošnja limita API poziva: ${potrosnja}`);
});

// 2. Nedeljni Reel, subotom (izdanje sa nedeljnim pregledom).
if (izdanje.nedeljni?.tacke?.length && fajlovi.includes(`${datum}-reel.mp4`)) {
  await korak('Reel', async () => {
    const oznaka = `Weekly AI recap · ${opsegNedelje(datum)}`;
    const vecObjavljeno = await nadjiObjavu(korisnik, oznaka);
    if (vecObjavljeno) return console.log(`Nedeljni Reel je već na Instagramu: ${vecObjavljeno.permalink}`);

    const video = `${SAJT}/insta/${datum}-reel.mp4`;
    await cekajNaSajtu(video, 'video/mp4');
    const tacke = izdanje.nedeljni.tacke.map((t, i) => `${i + 1}. ${t.includes(': ') && t.indexOf(': ') < 120 ? t.slice(0, t.indexOf(': ')) : skrati(t, 120)}`);
    const opis = [
      `🎬 ${oznaka}`,
      skrati(izdanje.nedeljni.ukratko, 900),
      `This week:\n${tacke.join('\n')}`,
      'Follow for a new AI brief every morning ☕',
      HASHTAGOVI,
    ].join('\n\n');

    const reel = await graf(`/${korisnik}/media`, {
      metoda: 'POST',
      polja: { media_type: 'REELS', video_url: video, caption: opis.slice(0, 2200), share_to_feed: 'true' },
    });
    // Video se obrađuje duže od slika, do desetak minuta.
    await cekajKontejner(reel.id, { pauza: 20_000, pokusaja: 30 });
    const link = await objavi(korisnik, reel.id, async () => (await nadjiObjavu(korisnik, oznaka))?.permalink);
    console.log(`Objavljen nedeljni Reel: ${link}`);
  });
}

// 3. Story: isti slajdovi u 9:16, samo za današnje izdanje.
if (datum === datumIzArgumenata([])) {
  await korak('story', async () => {
    const danasnji = async () =>
      ((await graf(`/${korisnik}/stories`, { polja: { fields: 'timestamp' } })).data ?? []).filter((s) => beogradDatum(s.timestamp) === datum).length;
    const vecIma = await danasnji();
    if (vecIma) return console.log(`Na profilu već ima ${vecIma} story-ja od danas, preskačem.`);

    const slike = redom('story-');
    if (!slike.length) throw new Error(`nema story slika za ${datum} u public/insta`);
    await cekajNaSajtu(slike.at(-1), 'image/jpeg');

    // Redom, jedan po jedan, da bi na profilu išli istim redosledom kao slajdovi.
    for (const [i, url] of slike.entries()) {
      const story = await graf(`/${korisnik}/media`, { metoda: 'POST', polja: { media_type: 'STORIES', image_url: url } });
      await cekajKontejner(story.id, { pauza: 5_000, pokusaja: 24 });
      await objavi(korisnik, story.id, async () => (await danasnji()) > i);
    }
    console.log(`Objavljeno ${slike.length} story-ja.`);
  });
}

if (greske) process.exit(1);
