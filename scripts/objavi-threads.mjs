// Objavljuje današnje izdanje kao karusel na Threads (@ai.morning.brief), sa istim slikama kao Instagram (public/insta).
// Pokreće se posle Instagram koraka, pa su slike tada već na sajtu; za svaki slučaj ipak sačeka da stignu kao JPEG.
//
// Tajna (GitHub → Settings → Secrets → Actions): THREADS_ACCESS_TOKEN. Ako je nema, tiho preskače.
// Threads tekst ima najviše 500 znakova i jednu temu (#), pa je kraći od Instagram opisa.
// Ako je izdanje za taj dan već objavljeno (prvi red sa datumom u nekoj od poslednjih objava), ne objavljuje ponovo.
//
// Pokretanje: node scripts/objavi-threads.mjs
//             node scripts/objavi-threads.mjs --datum=2026-10-25
//             node scripts/objavi-threads.mjs --provera   (samo proveri token i limit, ništa ne objavljuje)

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, lepDatum, skrati } from './insta-slike.mjs';
import { DATA_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

const SAJT = 'https://news-one-teal.vercel.app';
const API = 'https://graph.threads.net/v1.0';

const token = process.env.THREADS_ACCESS_TOKEN;
if (!token) {
  console.log('Threads nije podešen (THREADS_ACCESS_TOKEN), preskačem.');
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
    const e = podaci.error ?? {};
    const detalji = [e.error_user_title, e.error_user_msg, e.code && `kod ${e.code}`, e.error_subcode && `podkod ${e.error_subcode}`].filter(Boolean).join(', ');
    throw new Error(`Threads ${metoda} ${putanja}: ${e.message ?? odgovor.status}${detalji ? ` (${detalji})` : ''}`);
  }
  return podaci;
}

const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));

const ja = await graf('/me', { polja: { fields: 'id,username' } });
const limit = (await graf(`/${ja.id}/threads_publishing_limit`, { polja: { fields: 'quota_usage,config' } })).data?.[0];
console.log(`Threads: @${ja.username}, objava u poslednja 24h: ${limit?.quota_usage ?? '?'}/${limit?.config?.quota_total ?? '?'}`);
if (provera) process.exit(0);

const oznaka = `AI Morning Brief · ${lepDatum(datum)}`;

/** Objava za taj datum među poslednjim objavama (po prvom redu sa datumom), ako postoji. */
async function nadjiObjavu() {
  const poslednje = await graf(`/${ja.id}/threads`, { polja: { fields: 'text,permalink', limit: '10' } });
  return poslednje.data?.find((m) => m.text?.includes(oznaka));
}

const vecObjavljeno = await nadjiObjavu();
if (vecObjavljeno) {
  console.log(`Izdanje ${datum} je već na Threads-u: ${vecObjavljeno.permalink}`);
  process.exit(0);
}

const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}, Threads objava se preskače.`);

const slike = (await readdir(INSTA_DIR).catch(() => []))
  .filter((f) => new RegExp(`^${datum}-\\d+\\.jpg$`).test(f))
  .sort((a, b) => parseInt(a.slice(11)) - parseInt(b.slice(11)))
  .map((f) => `${SAJT}/insta/${f}`);
if (slike.length < 2) throw new Error(`Nema slika za ${datum} u public/insta (pokreni scripts/insta-slike.mjs).`);

// Dok slike nema, sajt vraća stranicu aplikacije (HTML) sa statusom 200, pa se gleda i vrsta sadržaja.
for (let pokusaj = 1; ; pokusaj++) {
  const res = await fetch(`${slike.at(-1)}?v=${Date.now()}`, { method: 'HEAD' }).catch(() => null);
  if (res?.status === 200 && res.headers.get('content-type')?.startsWith('image/jpeg')) break;
  if (pokusaj >= 40) throw new Error(`Slike nisu na sajtu ni posle 20 minuta (${slike.at(-1)}).`);
  if (pokusaj === 1) console.log('Čekam da Vercel objavi slike…');
  await spavaj(30_000);
}

const pocetak = `☕ ${oznaka}\n\n`;
const kraj = '\n\n#AI';
const tekst = `${pocetak}${skrati(izdanje.ukratko, 500 - pocetak.length - kraj.length)}${kraj}`;

const deca = [];
for (const url of slike) {
  deca.push((await graf(`/${ja.id}/threads`, { metoda: 'POST', polja: { media_type: 'IMAGE', image_url: url, is_carousel_item: 'true' } })).id);
}
// Threads, za razliku od Instagrama, odbija karusel dok svaka slika nije obrađena (podkod 4279004).
async function sacekajObradu(id, opis) {
  for (let pokusaj = 1; ; pokusaj++) {
    await spavaj(pokusaj === 1 ? 5_000 : 10_000);
    const { status, error_message: greska } = await graf(`/${id}`, { polja: { fields: 'status,error_message' } });
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED' || pokusaj >= 18) throw new Error(`Threads ${opis} nije spreman: ${status}${greska ? ` (${greska})` : ''}`);
  }
}
for (const [i, id] of deca.entries()) await sacekajObradu(id, `slika ${i + 1}`);

const karusel = await graf(`/${ja.id}/threads`, { metoda: 'POST', polja: { media_type: 'CAROUSEL', children: deca.join(','), text: tekst } });

// Threads preporučuje da se sačeka obrada kontejnera pre objave.
for (let pokusaj = 1; ; pokusaj++) {
  await spavaj(10_000);
  const { status } = await graf(`/${karusel.id}`, { polja: { fields: 'status' } });
  if (status === 'FINISHED') break;
  if (status === 'ERROR' || status === 'EXPIRED' || pokusaj >= 18) throw new Error(`Threads karusel nije spreman: ${status}`);
}

// Kao kod Instagrama: posle greške pri objavi prvo proveri profil, pa tek onda pokušaj ponovo.
for (let pokusaj = 1; ; pokusaj++) {
  try {
    const objava = await graf(`/${ja.id}/threads_publish`, { metoda: 'POST', polja: { creation_id: karusel.id } });
    const { permalink } = await graf(`/${objava.id}`, { polja: { fields: 'permalink' } });
    console.log(`Objavljeno na Threads-u (${slike.length} slika): ${permalink}`);
    break;
  } catch (err) {
    console.log(`${err.message}. Proveravam profil za minut…`);
    await spavaj(60_000);
    const objava = await nadjiObjavu().catch(() => null);
    if (objava) {
      console.log(`Objavljeno na Threads-u (${slike.length} slika): ${objava.permalink}`);
      break;
    }
    if (pokusaj >= 3) throw err;
    console.log('Objava nije na profilu, pokušavam ponovo za 5 minuta…');
    await spavaj(5 * 60_000);
  }
}
