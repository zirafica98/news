// Dev's pick: nedeljni YouTube video u kome Michael (Mihajlo) testira jedan alat sa petkove liste.
// Video, thumbnail, Instagram reel i tekst za X pravimo zajedno u chatu (ponedeljkom), a Mihajlo sam zakazuje video
// na YouTube-u za utorak u 16h. Epizode su u public/data/devs-pick.json (sajt i newsletter ih čitaju odatle).
//
// Utorkom (Vercel cron → podsetnik.yml, režim devs-pick) ova skripta:
//   1. nađe epizodu sa današnjim datumom objave (ako je nema, ništa ne radi),
//   2. sačeka da video „Dev's Pick #N“ postane javan na YouTube-u (najviše 90 min) i upiše link u devs-pick.json,
//   3. objavi na Instagram reel (public/devs-pick/N-reel.mp4) i story (N-story.jpg) koji zovu na YouTube,
//   4. pošalje Mihajlu na Telegram link videa i X objavu spremnu za kopiranje.
// Ništa se ne objavljuje dvaput (scripts/state/devs-pick.json).
//
// Tajne: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN, INSTAGRAM_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN,
// TELEGRAM_ADMIN_CHAT_ID.
// Pokretanje: node scripts/devs-pick.mjs --objavi [--datum=YYYY-MM-DD]

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, preuzmi, readJson, writeJson } from './lib.mjs';

export const SAJT = 'https://www.aimorningbrief.dev';
export const EPIZODE = join(DATA_DIR, 'devs-pick.json');
const STANJE = join(SCRIPTS_DIR, 'state', 'devs-pick.json');
const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));

export async function epizode() {
  return (await readJson(EPIZODE, { epizode: [] })).epizode ?? [];
}

/** Datum (YYYY-MM-DD) u Beogradu, pomeren za `dana`. */
export function beograd(dana = 0, od = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(new Date(od.getTime() + dana * 86_400_000));
}
/** 0 = nedelja … 6 = subota, za datum YYYY-MM-DD. */
export const danUNedelji = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();

export async function telegram(tekst) {
  const { TELEGRAM_BOT_TOKEN: bot, TELEGRAM_ADMIN_CHAT_ID: admin } = process.env;
  if (!bot || !admin) return console.log('Nema TELEGRAM_BOT_TOKEN ili TELEGRAM_ADMIN_CHAT_ID, poruka nije poslata.');
  const odgovor = await preuzmi(`https://api.telegram.org/bot${bot}/sendMessage`, {
    metoda: 'POST',
    headers: { 'Content-Type': 'application/json' },
    telo: JSON.stringify({ chat_id: admin, text: tekst.slice(0, 4000), disable_web_page_preview: true }),
  });
  if (!odgovor.ok) throw new Error(`Telegram nije primio poruku: ${odgovor.status} ${odgovor.tekst}`);
}

/** Prijava na YouTube (isti nalog kao za Shorts). Vraća funkciju za API pozive ili null ako tajni nema. */
export async function youtube() {
  const { YOUTUBE_CLIENT_ID: klijent, YOUTUBE_CLIENT_SECRET: tajna, YOUTUBE_REFRESH_TOKEN: osvezi } = process.env;
  if (!klijent || !tajna || !osvezi) return null;
  const prijava = await preuzmi('https://oauth2.googleapis.com/token', {
    metoda: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    telo: new URLSearchParams({ client_id: klijent, client_secret: tajna, refresh_token: osvezi, grant_type: 'refresh_token' }),
  });
  const { access_token: pristup } = JSON.parse(prijava.tekst || '{}');
  if (!pristup) throw new Error('YouTube prijava nije uspela (ponovo pokreni scripts/youtube-prijava.mjs).');
  return async (putanja, parametri) => {
    const odgovor = await preuzmi(`https://www.googleapis.com/youtube/v3${putanja}?${new URLSearchParams(parametri)}`, { headers: { Authorization: `Bearer ${pristup}` } });
    const podaci = JSON.parse(odgovor.tekst || '{}');
    if (!odgovor.ok) throw new Error(`YouTube ${putanja}: ${podaci.error?.message ?? odgovor.status}`);
    return podaci;
  };
}

/**
 * Video epizode na kanalu, po naslovu („Dev's Pick #N“) među poslednjih 50 otpremljenih (uključujući zakazane).
 * Vraća { id, url, status: 'public' | 'private' | 'unlisted', zakazano: ISO ili null } ili null.
 */
export async function nadjiVideo(yt, ep) {
  const kanal = (await yt('/channels', { part: 'contentDetails', mine: 'true' })).items?.[0];
  const plejlista = kanal?.contentDetails?.relatedPlaylists?.uploads;
  if (!plejlista) return null;
  const stavke = (await yt('/playlistItems', { part: 'snippet', playlistId: plejlista, maxResults: '50' })).items ?? [];
  const oznaka = new RegExp(`dev'?s pick\\s*#\\s*${ep.broj}\\b`, 'i');
  const stavka = stavke.find((s) => oznaka.test(s.snippet?.title ?? ''));
  if (!stavka) return null;
  const id = stavka.snippet.resourceId.videoId;
  const video = (await yt('/videos', { part: 'status', id })).items?.[0];
  return { id, url: `https://youtu.be/${id}`, status: video?.status?.privacyStatus ?? 'private', zakazano: video?.status?.publishAt ?? null };
}

/* ---------- Instagram ---------- */

const IG = 'https://graph.instagram.com/v25.0';
async function graf(putanja, { metoda = 'GET', polja = {} } = {}) {
  const parametri = new URLSearchParams({ ...polja, access_token: process.env.INSTAGRAM_ACCESS_TOKEN });
  const get = metoda === 'GET';
  // Token ide u telo POST zahteva, a ne u URL, da ne završi u logovima.
  const odgovor = await preuzmi(get ? `${IG}${putanja}?${parametri}` : `${IG}${putanja}`, {
    metoda,
    telo: get ? undefined : parametri,
    headers: get ? undefined : { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeoutMs: 60_000,
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok || podaci.error) throw new Error(`Instagram ${metoda} ${putanja}: ${podaci.error?.message ?? odgovor.status}`);
  return podaci;
}
async function cekajKontejner(id, { pauza, pokusaja }) {
  for (let i = 1; ; i++) {
    await spavaj(pauza);
    const { status_code: s } = await graf(`/${id}`, { polja: { fields: 'status_code' } });
    if (s === 'FINISHED') return;
    if (s === 'ERROR' || s === 'EXPIRED' || i >= pokusaja) throw new Error(`Instagram kontejner ${id} nije spreman: ${s}`);
  }
}

export function opisReela(ep) {
  return [
    `🧑‍💻 Dev's Pick #${ep.broj}: ${ep.alat}`,
    ep.sazetak,
    `His verdict: ${ep.ocena}/10.`,
    '▶️ The full test is on our YouTube channel: AI Morning Brief',
    'A real developer tests a new AI tool every Tuesday. Follow @ai.morning.brief so you don\'t miss it.',
    '#AI #AITools #Developer #Coding #ClaudeCode #Programming #TechTools',
    `Dev's Pick #${ep.broj}`,
  ].join('\n\n');
}

async function objaviInstagram(ep, stanje) {
  if (!process.env.INSTAGRAM_ACCESS_TOKEN) return console.log('Instagram nije podešen, preskačem.');
  const ja = await graf('/me', { polja: { fields: 'user_id' } });
  const korisnik = process.env.INSTAGRAM_USER_ID || ja.user_id;
  const s = (stanje[ep.broj] ??= {});

  if (!s.reel && ep.reel) {
    // Duplikat se prepoznaje po oznaci „Dev's Pick #N“ u opisu (ako je prošli pokušaj objavio, a pao pre upisa stanja).
    const poslednji = await graf(`/${korisnik}/media`, { polja: { fields: 'caption,permalink', limit: '10' } });
    const vec = poslednji.data?.find((m) => m.caption?.endsWith(`Dev's Pick #${ep.broj}`));
    if (vec) s.reel = vec.permalink;
    else {
      const reel = await graf(`/${korisnik}/media`, { metoda: 'POST', polja: { media_type: 'REELS', video_url: `${SAJT}${ep.reel}`, caption: opisReela(ep), share_to_feed: 'true' } });
      await cekajKontejner(reel.id, { pauza: 20_000, pokusaja: 30 });
      const objava = await graf(`/${korisnik}/media_publish`, { metoda: 'POST', polja: { creation_id: reel.id } });
      s.reel = (await graf(`/${objava.id}`, { polja: { fields: 'permalink' } }).catch(() => ({}))).permalink ?? objava.id;
    }
    console.log(`Instagram reel: ${s.reel}`);
  }
  if (!s.story && ep.story) {
    const story = await graf(`/${korisnik}/media`, { metoda: 'POST', polja: { media_type: 'STORIES', image_url: `${SAJT}${ep.story}` } });
    await cekajKontejner(story.id, { pauza: 5_000, pokusaja: 24 });
    await graf(`/${korisnik}/media_publish`, { metoda: 'POST', polja: { creation_id: story.id } });
    s.story = true;
    console.log('Instagram story objavljen.');
  }
}

/* ---------- utorak: objava ---------- */

async function objavi() {
  const datum = datumIzArgumenata();
  const sve = await readJson(EPIZODE, { epizode: [] });
  const ep = sve.epizode.find((e) => e.objava === datum);
  if (!ep) return console.log(`Nema Dev's pick epizode za ${datum}, ništa se ne objavljuje.`);

  const stanje = await readJson(STANJE, {});
  if (!ep.youtube) {
    const yt = await youtube();
    if (!yt) throw new Error('YouTube nije podešen, ne mogu da proverim da li je video izašao.');
    // Video je zakazan za 16h; cron može da krene i malo ranije, pa se čeka da postane javan.
    let video = null;
    for (let i = 1; i <= 30; i++) {
      video = await nadjiVideo(yt, ep);
      if (video?.status === 'public') break;
      if (i === 1) console.log(`Video još nije javan (${video ? video.status : 'nije na kanalu'}), čekam…`);
      await spavaj(3 * 60_000);
    }
    if (video?.status !== 'public') {
      await telegram(
        `⚠️ Dev's Pick #${ep.broj} još nije javan na YouTube-u (${video ? `status: ${video.status}` : 'video sa naslovom „Dev\'s Pick #' + ep.broj + '“ nije na kanalu'}).\n\nInstagram objava čeka. Kad video izađe, pokreni GitHub posao „Podsetnik i Dev's pick“ u režimu devs-pick.`,
      );
      throw new Error(`Video Dev's Pick #${ep.broj} nije javan.`);
    }
    ep.youtube = video.url;
    await writeJson(EPIZODE, sve);
    console.log(`YouTube: ${video.url}`);
  }

  let igGreska = null;
  await objaviInstagram(ep, stanje).catch((e) => (igGreska = e));
  await writeJson(STANJE, stanje);

  const ig = stanje[ep.broj] ?? {};
  await telegram(
    [
      `🎬 Dev's Pick #${ep.broj} je izašao: ${ep.youtube}`,
      igGreska ? `❌ Instagram nije uspeo: ${igGreska.message}` : `📸 Instagram: ${ig.reel ? `reel ${ig.reel}` : 'reel preskočen'}${ig.story ? ' + story' : ''}`,
      '',
      '👉 Sad objavi na X sa svog profila:',
      '',
      ep.xPost,
      '',
      '👉 Pa odmah odgovori na svoju objavu (prvi komentar):',
      '',
      `Full test on YouTube 👉 ${ep.youtube}`,
    ].join('\n'),
  );
  if (igGreska) throw igGreska;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href && process.argv.includes('--objavi')) await objavi();
