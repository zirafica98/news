// Objavljuje Reel dana kao YouTube Short (public/insta/YYYY-MM-DD-reel.mp4, pravi ga insta-slike.mjs):
// radnim danima slajdovi dana, subotom rekapitulacija nedelje. Naslov i opis su isti kao na Instagramu, bez linka i izvora.
//
// Tajne (GitHub → Settings → Secrets → Actions): YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN.
// Refresh token se pravi jednom, lokalno: node scripts/youtube-prijava.mjs (uputstvo je u toj skripti).
// Ako tajni nema, tiho preskače. Ako je video za taj dan već na kanalu (oznaka u opisu), ne objavljuje ponovo.
//
// Napomena: dok Google ne odobri API projekat (YouTube API audit), video poslat preko API-ja ostaje privatan.
//
// Pokretanje: node scripts/objavi-youtube.mjs
//             node scripts/objavi-youtube.mjs --datum=2026-10-24
//             node scripts/objavi-youtube.mjs --provera   (samo proveri prijavu, ništa ne objavljuje)

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, opisReela } from './insta-slike.mjs';
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
const video = await readFile(join(INSTA_DIR, `${datum}-reel.mp4`)).catch(() => null);
if (!video) throw new Error(`Nema videa public/insta/${datum}-reel.mp4 (pokreni scripts/insta-slike.mjs).`);

const { oznaka, naslov, opis } = opisReela(izdanje, HASHTAGOVI);

// Poslednji video na kanalu: lista „uploads“ košta 1 jedinicu kvote, a pretraga 100.
const poslednji = await yt('/playlistItems', { part: 'snippet', playlistId: kanal.contentDetails.relatedPlaylists.uploads, maxResults: '15' });
const vec = poslednji.items?.find((v) => v.snippet.description?.includes(oznaka));
if (vec) {
  console.log(`Short za ${datum} je već na YouTube-u: https://youtube.com/shorts/${vec.snippet.resourceId.videoId}`);
  process.exit(0);
}

// YouTube ne dozvoljava < i > u naslovu; naslov je najviše 100 znakova.
const naslovVidea = `${naslov.replace(/[<>]/g, '')}`.slice(0, 90).trim() + ' #Shorts';

// Otpremanje u dva koraka (resumable upload): prvo podaci o videu, pa sam fajl na adresu koju YouTube vrati.
const pocetak = await preuzmi('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
  metoda: 'POST',
  headers: {
    Authorization: `Bearer ${pristup}`,
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Upload-Content-Type': 'video/mp4',
    'X-Upload-Content-Length': String(video.length),
  },
  telo: JSON.stringify({
    snippet: { title: naslovVidea, description: opis.slice(0, 4900), categoryId: '28', defaultLanguage: 'en', tags: ['AI', 'AI news', 'artificial intelligence', 'tech news'] },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  }),
});
const adresa = pocetak.zaglavlja?.get('location');
if (!pocetak.ok || !adresa) throw new Error(`YouTube nije prihvatio video: ${pocetak.status} ${pocetak.tekst.slice(0, 300)}`);

const otpremljeno = await preuzmi(adresa, {
  metoda: 'PUT',
  headers: { 'Content-Type': 'video/mp4' },
  telo: video,
  timeoutMs: 5 * 60_000,
});
const rezultat = JSON.parse(otpremljeno.tekst || '{}');
if (!otpremljeno.ok || !rezultat.id) throw new Error(`Otpremanje na YouTube nije uspelo: ${rezultat.error?.message ?? otpremljeno.status}`);

const vidljivost = rezultat.status?.privacyStatus;
console.log(`Objavljen YouTube Short: https://youtube.com/shorts/${rezultat.id}${vidljivost && vidljivost !== 'public' ? ` (vidljivost: ${vidljivost})` : ''}`);
