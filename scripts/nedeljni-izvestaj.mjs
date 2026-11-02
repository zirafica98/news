// Nedeljni izveštaj na Telegram (privatno, samo tebi): kako prolazi koji format (AI Wars, Tool of the Day,
// Byte Explains, vesti, karusel…) na Instagramu i YouTube-u, koliko pratilaca je stiglo i koji video je najbolji.
// Pokreće se ponedeljkom ujutru (Vercel Cron → GitHub posao, režim nedeljni) i gleda objave iz prethodnih 7 dana.
//
// Format se prepoznaje po oznaci u opisu (AI Morning Brief · DATUM · wars/alat/explains/1/cene/nedelja).
// Pregledi su ukupni do trenutka izveštaja, pa nedeljni videi imaju manje vremena od ponedeljkovih.
// Brojevi pratilaca i proseci po formatu se čuvaju u scripts/state/statistika.json, da bi izveštaj pokazao promenu.
//
// Tajne: iste kao za objave (INSTAGRAM_ACCESS_TOKEN, YOUTUBE_*, THREADS_ACCESS_TOKEN, TELEGRAM_BOT_TOKEN,
// TELEGRAM_CHAT_ID) i TELEGRAM_ADMIN_CHAT_ID za slanje. Mreža bez tajne se preskače.
// Zadržavanje na YouTube-u (koliko videa ljudi odgledaju) traži ovlašćenje yt-analytics.readonly; stari token ga
// nema, pa se ta kolona prikaže tek kad se ponovo pokrene scripts/youtube-prijava.mjs.
//
// Pokretanje: node scripts/nedeljni-izvestaj.mjs [--dana=7] [--bez-slanja]

import { join } from 'node:path';
import { SCRIPTS_DIR, preuzmi, readJson, writeJson } from './lib.mjs';

const STANJE = join(SCRIPTS_DIR, 'state', 'statistika.json');
const dana = Number(process.argv.find((a) => a.startsWith('--dana='))?.split('=')[1] ?? 7);
const bezSlanja = process.argv.includes('--bez-slanja');
const env = process.env;

const FORMATI = {
  wars: '⚔️ AI Wars',
  alat: '🛠 Tool of the Day',
  explains: '🧠 Byte Explains',
  vesti: '📰 Vesti (Short)',
  cene: '💰 Cene modela',
  nedelja: '📅 Nedeljni pregled',
  ideja: '💡 Ideja za app',
  reel: '🎞 Reel dana (stari)',
  karusel: '🖼 Karusel',
  ostalo: '❔ Ostalo',
};

const danas = new Date();
const od = new Date(danas.getTime() - dana * 86_400_000);
const beograd = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Belgrade' }).format(d);
const kratko = (d) => new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'numeric' }).format(d);

/** Format videa ili posta po oznaci u opisu. */
function format(tekst = '') {
  const oznaka = tekst.match(/AI Morning Brief · \d{4}-\d{2}-\d{2} · (\w+)/)?.[1];
  if (oznaka) return /^\d+$/.test(oznaka) ? 'vesti' : oznaka.startsWith('alat') ? 'alat' : oznaka;
  if (/Weekly AI recap/.test(tekst)) return 'nedelja';
  if (/Today in AI ·/.test(tekst)) return 'reel';
  if (/AI Morning Brief ·/.test(tekst)) return 'karusel';
  return 'ostalo';
}

async function json(url, opcije) {
  const odgovor = await preuzmi(url, { timeoutMs: 60_000, ...opcije });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok || podaci.error) {
    const e = podaci.error;
    throw new Error(`${odgovor.status} ${typeof e === 'string' ? e : (e?.message ?? '')}`.trim());
  }
  return podaci;
}

const objave = []; // { mreza, format, naslov, link, pregledi, lajkovi, komentari, cuvanja, deljenja, gledanje (s), procenat }
const pratioci = {};
const napomene = [];

async function mreza(naziv, posao) {
  try {
    await posao();
  } catch (err) {
    napomene.push(`${naziv}: ${err.message}`);
    console.error(`${naziv} nije uspeo: ${err.message}`);
  }
}

// Instagram: Reels i karuseli sa statistikom po objavi (insights), plus broj pratilaca.
await mreza('Instagram', async () => {
  const token = env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) return;
  const API = 'https://graph.instagram.com/v25.0';
  const ig = (putanja, polja = {}) => json(`${API}${putanja}?${new URLSearchParams({ ...polja, access_token: token })}`);

  const ja = await ig('/me', { fields: 'user_id,username,followers_count' });
  pratioci.instagram = ja.followers_count;
  const korisnik = env.INSTAGRAM_USER_ID || ja.user_id;
  const mediji = [];
  let strana = await ig(`/${korisnik}/media`, { fields: 'id,caption,media_type,media_product_type,timestamp,like_count,comments_count,permalink', limit: '50' });
  while (strana) {
    mediji.push(...(strana.data ?? []));
    if (!strana.paging?.next || new Date(mediji.at(-1)?.timestamp) < od) break;
    strana = await json(strana.paging.next);
  }
  let bezInsightsa = null;
  for (const m of mediji.filter((m) => new Date(m.timestamp) >= od)) {
    const reel = m.media_product_type === 'REELS';
    const o = {
      mreza: 'instagram',
      format: format(m.caption),
      naslov: (m.caption ?? '').split('\n')[0].replace(/^\W+/u, '').slice(0, 70),
      link: m.permalink,
      lajkovi: m.like_count ?? 0,
      komentari: m.comments_count ?? 0,
    };
    if (!bezInsightsa) {
      try {
        const metrike = reel ? 'views,reach,saved,shares,ig_reels_avg_watch_time' : 'views,reach,saved,shares';
        const ins = Object.fromEntries((await ig(`/${m.id}/insights`, { metric: metrike })).data.map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
        Object.assign(o, { pregledi: ins.views, doseg: ins.reach, cuvanja: ins.saved, deljenja: ins.shares });
        if (reel && ins.ig_reels_avg_watch_time != null) o.gledanje = ins.ig_reels_avg_watch_time / 1000;
      } catch (err) {
        // Token bez ovlašćenja instagram_business_manage_insights: ostaju samo lajkovi i komentari.
        bezInsightsa = err.message;
      }
    }
    objave.push(o);
  }
  if (bezInsightsa) napomene.push(`Instagram pregledi nisu dostupni (${bezInsightsa}), prikazani su samo lajkovi i komentari.`);
});

// YouTube: Shortovi sa kanala, statistika po videu; zadržavanje iz YouTube Analytics ako token ima ovlašćenje.
await mreza('YouTube', async () => {
  const { YOUTUBE_CLIENT_ID: klijent, YOUTUBE_CLIENT_SECRET: tajna, YOUTUBE_REFRESH_TOKEN: osvezi } = env;
  if (!klijent || !tajna || !osvezi) return;
  const { access_token: pristup } = await json('https://oauth2.googleapis.com/token', {
    metoda: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    telo: new URLSearchParams({ client_id: klijent, client_secret: tajna, refresh_token: osvezi, grant_type: 'refresh_token' }),
  });
  const yt = (putanja, parametri) => json(`https://www.googleapis.com/youtube/v3${putanja}?${new URLSearchParams(parametri)}`, { headers: { Authorization: `Bearer ${pristup}` } });

  const kanal = (await yt('/channels', { part: 'statistics,contentDetails', mine: 'true' })).items[0];
  pratioci.youtube = Number(kanal.statistics.subscriberCount);
  const stavke = [];
  let token = '';
  do {
    const strana = await yt('/playlistItems', { part: 'snippet', playlistId: kanal.contentDetails.relatedPlaylists.uploads, maxResults: '50', ...(token ? { pageToken: token } : {}) });
    stavke.push(...strana.items);
    token = new Date(stavke.at(-1)?.snippet.publishedAt) >= od ? strana.nextPageToken : '';
  } while (token);
  const nedeljni = stavke.filter((s) => new Date(s.snippet.publishedAt) >= od);
  if (!nedeljni.length) return;

  const statistika = new Map();
  for (let i = 0; i < nedeljni.length; i += 50) {
    const ids = nedeljni.slice(i, i + 50).map((s) => s.snippet.resourceId.videoId);
    for (const v of (await yt('/videos', { part: 'statistics,status', id: ids.join(',') })).items) statistika.set(v.id, v);
  }
  let zadrzavanje = new Map();
  try {
    const ids = nedeljni.map((s) => s.snippet.resourceId.videoId);
    const izvestaj = await json(
      `https://youtubeanalytics.googleapis.com/v2/reports?${new URLSearchParams({
        ids: 'channel==MINE',
        startDate: beograd(new Date(od.getTime() - 86_400_000)),
        endDate: beograd(danas),
        metrics: 'averageViewDuration,averageViewPercentage',
        dimensions: 'video',
        filters: `video==${ids.join(',')}`,
      })}`,
      { headers: { Authorization: `Bearer ${pristup}` } },
    );
    zadrzavanje = new Map((izvestaj.rows ?? []).map(([id, trajanje, procenat]) => [id, { trajanje, procenat }]));
  } catch {
    napomene.push('YouTube zadržavanje nije dostupno: token nema ovlašćenje za Analytics (ponovo pokreni scripts/youtube-prijava.mjs).');
  }
  let privatni = 0;
  for (const s of nedeljni) {
    const id = s.snippet.resourceId.videoId;
    const v = statistika.get(id);
    if (v?.status?.privacyStatus !== 'public') privatni++;
    objave.push({
      mreza: 'youtube',
      format: format(s.snippet.description),
      naslov: s.snippet.title.slice(0, 70),
      link: `https://youtube.com/shorts/${id}`,
      pregledi: Number(v?.statistics?.viewCount ?? 0),
      lajkovi: Number(v?.statistics?.likeCount ?? 0),
      // Bez komentara: ispod svakog Shorta je i naše pitanje, pa broj ne govori ništa.
      gledanje: zadrzavanje.get(id)?.trajanje,
      procenat: zadrzavanje.get(id)?.procenat,
    });
  }
  if (privatni) napomene.push(`YouTube: ${privatni} videa nije javno (privatni ili na čekanju), oni nemaju preglede.`);
});

// Threads: pregledi profila za nedelju i broj pratilaca.
let threadsPregledi = null;
await mreza('Threads', async () => {
  const token = env.THREADS_ACCESS_TOKEN;
  if (!token) return;
  const p = { access_token: token, metric: 'views,followers_count', since: String(Math.floor(od / 1000)), until: String(Math.floor(danas / 1000)) };
  const podaci = (await json(`https://graph.threads.net/v1.0/me/threads_insights?${new URLSearchParams(p)}`)).data ?? [];
  for (const d of podaci) {
    if (d.name === 'followers_count') pratioci.threads = d.total_value?.value;
    if (d.name === 'views') threadsPregledi = (d.values ?? []).reduce((z, v) => z + (v.value ?? 0), 0);
  }
});

// Telegram kanal: broj članova.
await mreza('Telegram', async () => {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: kanal } = env;
  if (!token || !kanal) return;
  pratioci.telegram = (await json(`https://api.telegram.org/bot${token}/getChatMemberCount?${new URLSearchParams({ chat_id: kanal })}`)).result;
});

// Proseci po formatu i mreži.
const prosek = (niz, polje) => {
  const vrednosti = niz.map((o) => o[polje]).filter((v) => typeof v === 'number');
  return vrednosti.length ? vrednosti.reduce((a, b) => a + b, 0) / vrednosti.length : null;
};
const formati = {};
for (const f of new Set(objave.map((o) => o.format))) {
  formati[f] = {};
  for (const m of ['instagram', 'youtube']) {
    const niz = objave.filter((o) => o.format === f && o.mreza === m);
    if (!niz.length) continue;
    formati[f][m] = {
      broj: niz.length,
      pregledi: prosek(niz, 'pregledi'),
      lajkovi: prosek(niz, 'lajkovi'),
      gledanje: prosek(niz, 'gledanje'),
      procenat: prosek(niz, 'procenat'),
      cuvanja: niz.reduce((z, o) => z + (o.cuvanja ?? 0), 0),
      deljenja: niz.reduce((z, o) => z + (o.deljenja ?? 0), 0),
      komentari: niz.reduce((z, o) => z + (o.komentari ?? 0), 0),
    };
  }
}

const stanje = await readJson(STANJE, { nedelje: [] });
const prosla = stanje.nedelje.filter((n) => n.datum !== beograd(danas)).at(-1);

const broj = (n) => (n == null ? '–' : n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(Math.round(n)));
const promena = (sad, ranije) => {
  if (sad == null || ranije == null) return '';
  const r = sad - ranije;
  return r === 0 ? ' (=)' : ` (${r > 0 ? '+' : ''}${Math.round(r)})`;
};
const trend = (sad, ranije) => (sad == null || !ranije ? '' : sad >= ranije * 1.15 ? ' ↑' : sad <= ranije * 0.85 ? ' ↓' : ' →');

const redovi = [`📊 Nedeljni izveštaj · ${kratko(od)}–${kratko(danas)}`, ''];

const NAZIVI = { instagram: 'Instagram', youtube: 'YouTube', threads: 'Threads', telegram: 'Telegram' };
const pratiociRed = Object.entries(NAZIVI)
  .filter(([k]) => pratioci[k] != null)
  .map(([k, naziv]) => `${naziv} ${broj(pratioci[k])}${promena(pratioci[k], prosla?.pratioci?.[k])}`);
if (pratiociRed.length) redovi.push('👥 Pratioci', pratiociRed.join(' · '), '');
if (threadsPregledi != null) redovi.push(`🧵 Threads: ${broj(threadsPregledi)} pregleda za nedelju${promena(threadsPregledi, prosla?.threadsPregledi)}`, '');

// Formati od najgledanijeg (zbir prosečnih pregleda na obe mreže).
const ukupno = (f) => (formati[f].instagram?.pregledi ?? 0) + (formati[f].youtube?.pregledi ?? 0);
const redosled = Object.keys(formati).sort((a, b) => ukupno(b) - ukupno(a));
if (redosled.length) {
  redovi.push('🎬 Formati (prosek po objavi)');
  for (const f of redosled) {
    redovi.push(FORMATI[f] ?? f);
    for (const m of ['instagram', 'youtube']) {
      const s = formati[f][m];
      if (!s) continue;
      const ranije = prosla?.formati?.[f]?.[m];
      const delovi = [`${s.broj}×`, `${broj(s.pregledi)} pregleda${trend(s.pregledi, ranije?.pregledi)}`];
      if (s.gledanje != null) delovi.push(`gledaju ${s.gledanje.toFixed(1)} s${s.procenat != null ? ` (${Math.round(s.procenat)}%)` : ''}`);
      delovi.push(`♥ ${broj(s.lajkovi)}`);
      if (s.cuvanja || s.deljenja) delovi.push(`${s.cuvanja} čuvanja, ${s.deljenja} deljenja`);
      if (s.komentari) delovi.push(`${s.komentari} kom.`);
      redovi.push(`   ${m === 'instagram' ? 'IG' : 'YT'}: ${delovi.join(' · ')}`);
    }
  }
  redovi.push('');
}

const najbolji = objave.filter((o) => o.pregledi != null).sort((a, b) => b.pregledi - a.pregledi);
if (najbolji.length) {
  const b = najbolji[0];
  redovi.push(`🏆 Najgledanije: ${b.naslov} (${NAZIVI[b.mreza]}, ${broj(b.pregledi)} pregleda)`, b.link, '');
}
// Poređenje samo formata sa bar 3 objave, da jedan svež video ne ispadne „najslabiji“.
const poredivi = redosled.filter((f) => f !== 'ostalo' && objave.filter((o) => o.format === f).length >= 3);
if (poredivi.length >= 2 && ukupno(poredivi[0]) > 0) {
  redovi.push(`📈 Najbolje prolazi ${FORMATI[poredivi[0]] ?? poredivi[0]}, najslabije ${FORMATI[poredivi.at(-1)] ?? poredivi.at(-1)}.`);
}
if (!objave.length) redovi.push('Nema objava u poslednjih 7 dana (ili mreže nisu podešene).');
if (napomene.length) redovi.push('', ...napomene.map((n) => `⚠️ ${n}`));

const poruka = redovi.join('\n').replace(/\n{3,}/g, '\n\n').trim();
console.log(poruka);

stanje.nedelje = [...stanje.nedelje.filter((n) => n.datum !== beograd(danas)), { datum: beograd(danas), pratioci, threadsPregledi, formati }].slice(-26);
await writeJson(STANJE, stanje);

if (bezSlanja) process.exit(0);
const { TELEGRAM_BOT_TOKEN: bot, TELEGRAM_ADMIN_CHAT_ID: admin } = env;
if (!bot || !admin) {
  console.log('Nema TELEGRAM_BOT_TOKEN ili TELEGRAM_ADMIN_CHAT_ID, izveštaj nije poslat.');
  process.exit(0);
}
// Telegram poruka ima najviše 4096 znakova.
await json(`https://api.telegram.org/bot${bot}/sendMessage`, {
  metoda: 'POST',
  headers: { 'Content-Type': 'application/json' },
  telo: JSON.stringify({ chat_id: admin, text: poruka.slice(0, 4000), disable_web_page_preview: true }),
});
console.log('Izveštaj poslat na Telegram.');
