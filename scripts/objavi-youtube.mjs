// Objavljuje YouTube Shorts: tri Shorta sa glasom, po jedna vest (public/insta/YYYY-MM-DD-short-N.mp4, pravi ih shorts.mjs),
// a subotom i rekapitulaciju nedelje (YYYY-MM-DD-reel.mp4). Opisi su bez linka ka sajtu i izvora.
//
// Tajne (GitHub → Settings → Secrets → Actions): YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.
// Refresh token se pravi jednom, lokalno: node scripts/youtube-prijava.mjs (uputstvo je u toj skripti).
// Ako tajni nema, tiho preskače. Ako je video za taj dan već na kanalu (oznaka u opisu), ne objavljuje ponovo.
//
// Napomena: dok Google ne odobri API projekat (YouTube API audit), video poslat preko API-ja ostaje privatan.
//
// Pokretanje: node scripts/objavi-youtube.mjs
//             node scripts/objavi-youtube.mjs --datum=2026-10-24 [--najvise=2]
//             node scripts/objavi-youtube.mjs --provera   (samo proveri prijavu, ništa ne objavljuje)

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, jeNedeljniReel, opisReela } from './insta-slike.mjs';
import { DATA_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

const HASHTAGOVI = '#AI #AINews #ArtificialIntelligence #TechNews #Shorts';
const { YOUTUBE_CLIENT_ID: klijent, YOUTUBE_CLIENT_SECRET: tajna, YOUTUBE_REFRESH_TOKEN: osvezi } = process.env;
if (!klijent || !tajna || !osvezi) {
  console.log('YouTube nije podešen (YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN), preskačem.');
  process.exit(0);
}
const provera = process.argv.includes('--provera');
const datum = datumIzArgumenata();

const prijava = await preuzmi('https://oauth2.googleapis.com/token', {
  metoda: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  telo: new URLSearchParams({ client_id: klijent, client_secret: tajna, refresh_token: osvezi, grant_type: 'refresh_token' }),
});
const { access_token: pristup, error_description: razlog } = JSON.parse(prijava.tekst || '{}');
if (!pristup) throw new Error(`YouTube prijava nije uspela: ${razlog ?? prijava.status}. Ponovo pokreni scripts/youtube-prijava.mjs.`);

async function yt(putanja, parametri) {
  const odgovor = await preuzmi(`https://www.googleapis.com/youtube/v3${putanja}?${new URLSearchParams(parametri)}`, {
    headers: { Authorization: `Bearer ${pristup}` },
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok) throw new Error(`YouTube ${putanja}: ${podaci.error?.message ?? odgovor.status}`);
  return podaci;
}

const kanal = (await yt('/channels', { part: 'snippet,contentDetails', mine: 'true' })).items?.[0];
if (!kanal) throw new Error('Nalog nema YouTube kanal. Napravi ga na youtube.com, pa ponovo pokreni scripts/youtube-prijava.mjs.');
console.log(`YouTube: kanal „${kanal.snippet.title}“`);
if (provera) process.exit(0);

const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);

// Šta se objavljuje: Shorts v2 (po jedna vest sa glasom, pravi ih shorts.mjs) i subotom nedeljni recap.
// Ako Shorts v2 za taj dan ne postoje, ide stari Reel dana.
// Nedeljni recap (stari Reel bez glasa) ide na YouTube samo kad nema Shortova sa glasom, da kanal bude ujednačen.
const shortovi = await readJson(join(INSTA_DIR, `${datum}-shorts.json`), null);
const videi = (shortovi ?? []).map((s) => ({ ...s, tagovi: ['AI', 'AI news', 'artificial intelligence', 'tech news'] }));
if (!shortovi) {
  const { oznaka, naslov, opis } = opisReela(izdanje, HASHTAGOVI);
  videi.push({
    fajl: `${datum}-reel.mp4`,
    naslov,
    opis,
    oznaka,
    tagovi: ['AI', 'AI news', 'weekly recap'],
    ...(jeNedeljniReel(izdanje) ? { plejlista: 'This Week in AI', pitanje: 'What was the biggest AI story of the week for you? 👇' } : {}),
  });
}
// Kanal prikazuje najnovije gore, pa Short #1 ide poslednji.
videi.reverse();
// --najvise=N: samo prvih N (zbog dnevne kvote od ~6 uploada pri naknadnom kačenju).
const najvise = Number(process.argv.find((a) => a.startsWith('--najvise='))?.split('=')[1] ?? videi.length);
videi.splice(najvise);

// Poslednji videi na kanalu: lista „uploads“ košta 1 jedinicu kvote, a pretraga 100.
const poslednji = await yt('/playlistItems', { part: 'snippet', playlistId: kanal.contentDetails.relatedPlaylists.uploads, maxResults: '25' });

// Stanje za posleObjave (plejliste, komentari); mora biti pre petlje jer se funkcija poziva iz nje.
let bezOvlascenja = false;
const plejliste = new Map();

let greske = 0;
for (const v of videi) {
  try {
    const vec = poslednji.items?.find((p) => p.snippet.description?.includes(v.oznaka));
    if (vec) {
      console.log(`Već na YouTube-u: ${v.naslov} → https://youtube.com/shorts/${vec.snippet.resourceId.videoId}`);
      continue;
    }
    const fajl = await readFile(join(INSTA_DIR, v.fajl)).catch(() => null);
    if (!fajl) throw new Error(`nema fajla public/insta/${v.fajl}`);
    const id = await otpremi(fajl, v);
    console.log(`Objavljen YouTube Short: https://youtube.com/shorts/${id} (${v.naslov})`);
    await posleObjave(id, v);
  } catch (err) {
    greske++;
    console.error(`YouTube „${v.naslov}“ nije objavljen: ${err.message}`);
    // Dnevna kvota je potrošena (resetuje se u ponoć po pacifičkom vremenu, 09h kod nas): nema smisla nastavljati.
    if (/quota/i.test(err.message)) break;
  }
}
if (greske) process.exit(1);

/**
 * Plejlista i komentar sa pitanjem. Traže ovlašćenje youtube.force-ssl; ako ga stari token nema,
 * samo se preskače (upload i dalje radi) dok se ne pokrene ponovo scripts/youtube-prijava.mjs.
 */
async function posleObjave(id, { plejlista, pitanje }) {
  if (bezOvlascenja) return;
  try {
    if (plejlista) await graf('/playlistItems?part=snippet', { snippet: { playlistId: await idPlejliste(plejlista), resourceId: { kind: 'youtube#video', videoId: id } } });
    if (pitanje) await graf('/commentThreads?part=snippet', { snippet: { videoId: id, topLevelComment: { snippet: { textOriginal: pitanje } } } });
  } catch (err) {
    if (/insufficient|scope|permission/i.test(err.message)) {
      bezOvlascenja = true;
      console.log('Plejliste i komentari preskočeni: token nema ovlašćenje youtube.force-ssl (ponovo pokreni scripts/youtube-prijava.mjs).');
    } else {
      console.log(`Plejlista ili komentar nisu dodati: ${err.message}`);
    }
  }
}

async function idPlejliste(naziv) {
  if (!plejliste.size) {
    for (const p of (await yt('/playlists', { part: 'snippet', mine: 'true', maxResults: '50' })).items ?? []) plejliste.set(p.snippet.title, p.id);
  }
  if (!plejliste.has(naziv)) {
    const nova = await graf('/playlists?part=snippet,status', { snippet: { title: naziv, defaultLanguage: 'en' }, status: { privacyStatus: 'public' } });
    plejliste.set(naziv, nova.id);
  }
  return plejliste.get(naziv);
}

/** POST na YouTube Data API sa JSON telom. */
async function graf(putanja, telo) {
  const odgovor = await preuzmi(`https://www.googleapis.com/youtube/v3${putanja}`, {
    metoda: 'POST',
    headers: { Authorization: `Bearer ${pristup}`, 'Content-Type': 'application/json' },
    telo: JSON.stringify(telo),
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok) throw new Error(`${putanja}: ${podaci.error?.message ?? odgovor.status} ${podaci.error?.errors?.[0]?.reason ?? ''}`.trim());
  return podaci;
}

/** Otpremanje u dva koraka (resumable upload): prvo podaci o videu, pa sam fajl na adresu koju YouTube vrati. */
async function otpremi(video, { naslov, opis, tagovi }) {
  // YouTube ne dozvoljava < i > u naslovu; naslov je najviše 100 znakova.
  const naslovVidea = naslov.replace(/[<>]/g, '').slice(0, 100).trim();
  const pocetak = await preuzmi('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    metoda: 'POST',
    headers: {
      Authorization: `Bearer ${pristup}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': String(video.length),
    },
    telo: JSON.stringify({
      snippet: { title: naslovVidea, description: opis.slice(0, 4900), categoryId: '28', defaultLanguage: 'en', tags: tagovi },
      status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
    }),
  });
  const adresa = pocetak.zaglavlja?.get('location');
  if (!pocetak.ok || !adresa) throw new Error(`YouTube nije prihvatio video: ${pocetak.status} ${pocetak.tekst.slice(0, 300)}`);

  const otpremljeno = await preuzmi(adresa, { metoda: 'PUT', headers: { 'Content-Type': 'video/mp4' }, telo: video, timeoutMs: 5 * 60_000 });
  const rezultat = JSON.parse(otpremljeno.tekst || '{}');
  if (!otpremljeno.ok || !rezultat.id) throw new Error(`otpremanje nije uspelo: ${rezultat.error?.message ?? otpremljeno.status}`);
  if (rezultat.status?.privacyStatus && rezultat.status.privacyStatus !== 'public') console.log(`  vidljivost: ${rezultat.status.privacyStatus}`);
  return rezultat.id;
}
