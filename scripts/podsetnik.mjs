// Jutarnji podsetnik Mihajlu na Telegram (svaki dan oko 7h, Vercel cron → podsetnik.yml):
// šta danas treba da uradi on, ručno. Sve ostalo (izdanje, objave, newsletter) ide automatski i ima svoje izveštaje.
//
// Nedeljni ritam Dev's pick videa:
//   petak 16h   lista alata stiže na Telegram → bira alat i testira ga preko vikenda
//   ponedeljak  pravimo video u chatu sa Claude-om; on ga zakazuje na YouTube-u za utorak 16h
//   utorak 16h  video izlazi; Instagram ide sam (devs-pick.mjs), on objavljuje X post
//   sreda       odgovara na komentare
// Da li je video napravljen, zna se po public/data/devs-pick.json; da li je zakazan, po YouTube kanalu.
// Jednokratni zadaci su u scripts/state/zadaci.json (Claude ih briše kad Mihajlo javi da su urađeni).
//
// Pokretanje: node scripts/podsetnik.mjs [--datum=YYYY-MM-DD] [--bez-slanja]

import { join } from 'node:path';
import { danUNedelji, epizode, nadjiVideo, telegram, youtube } from './devs-pick.mjs';
import { SCRIPTS_DIR, datumIzArgumenata, readJson } from './lib.mjs';

const danas = datumIzArgumenata();
const dan = danUNedelji(danas);
const pomeri = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const utorak = pomeri(danas, (2 - dan + 7) % 7); // ovaj ili sledeći utorak
const juce = pomeri(danas, -1);

const sve = await epizode();
const ep = sve.find((e) => e.objava === utorak);
const proslaNedelja = sve.find((e) => e.objava === juce);

/** Stanje videa na YouTube-u: '✅ zakazan …', 'javan' ili poruka zašto se ne vidi. */
async function naYoutube(e) {
  try {
    const yt = await youtube();
    if (!yt) return { ok: null, tekst: '' };
    const v = await nadjiVideo(yt, e);
    if (!v) return { ok: false, tekst: `ne vidim video sa „Dev's Pick #${e.broj}“ u naslovu na kanalu` };
    if (v.status === 'public') return { ok: true, tekst: `javan je: ${v.url}` };
    if (v.zakazano) {
      const kad = new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: 'Europe/Belgrade', weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date(v.zakazano));
      return { ok: true, tekst: `zakazan je za ${kad}` };
    }
    return { ok: false, tekst: `otpremljen je, ali nije zakazan (status: ${v.status})` };
  } catch (err) {
    return { ok: null, tekst: `ne mogu da proverim YouTube (${err.message})` };
  }
}

const zadaci = [];
const dodaj = (t) => zadaci.push(t);

if (dan === 1) {
  if (ep) {
    const yt = await naYoutube(ep);
    if (yt.ok) dodaj(`🎬 Dev's Pick #${ep.broj} je spreman i ${yt.tekst}. Ništa ne treba.`);
    else dodaj(`🎬 Dev's Pick #${ep.broj} je spreman${yt.tekst ? `, ali ${yt.tekst}` : ''}. Otpremi ga na YouTube i zakaži za sutra (utorak) u 16:00: Visibility → Schedule. Thumbnail i opis su u folderu te nedelje.`);
  } else {
    dodaj('🎬 Danas pravimo Dev\'s pick video: otvori chat sa Claude-om i pošalji snimak ekrana i par rečenica o alatu (šta ti se svidelo, šta ne, ocena 1–10). Ja pravim video, thumbnail, Instagram reel i tvoju X objavu.');
    dodaj('📅 Kad video bude gotov, zakaži ga na YouTube-u za sutra u 16:00.');
  }
  dodaj('📊 Oko 8h stiže nedeljni izveštaj (pratioci, formati, newsletter). Samo ga pogledaj.');
}

if (dan === 2) {
  if (ep) {
    const yt = await naYoutube(ep);
    if (yt.ok === false) dodaj(`⚠️ Dev's Pick #${ep.broj}: ${yt.tekst}. Zakaži ga za danas u 16:00 (Visibility → Schedule), inače Instagram objava neće krenuti.`);
    else dodaj(`🎬 Danas u 16:00 izlazi Dev's Pick #${ep.broj}${yt.tekst ? ` (${yt.tekst})` : ''}.`);
    dodaj('📸 Instagram reel i story i YouTube Short idu sami čim video izađe.');
    dodaj('🐦 Posle 16h stiže ti poruka sa X objavom i linkom: objavi je sa svog profila, a link stavi u prvi komentar.');
  } else {
    dodaj('🎬 Ove nedelje nema Dev\'s pick videa, pa danas nema ničeg za YouTube i X.');
  }
}

if (dan === 3 && proslaNedelja?.youtube) {
  dodaj(`💬 Odgovori na komentare ispod Dev's Pick #${proslaNedelja.broj} (${proslaNedelja.youtube}) i na X. Prva dva dana najviše utiču na to koliko će ga YouTube preporučivati.`);
}

if (dan === 5) {
  dodaj('🧑‍💻 U 16h stiže lista alata ove nedelje. Izaberi jedan i probaj ga preko vikenda na stvarnom problemu.');
}

if ((dan === 6 || dan === 0) && !ep) {
  dodaj('🧪 Testiraj alat koji si izabrao i snimi ekran dok radiš (Cmd+Shift+5). Zapiši utiske i ocenu 1–10, u ponedeljak od toga pravimo video.');
}

const { zadaci: jednokratni = [] } = await readJson(join(SCRIPTS_DIR, 'state', 'zadaci.json'), {});

const naslov = new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${danas}T12:00:00Z`));
const poruka = [
  `☀️ Dobro jutro! Za danas (${naslov}):`,
  '',
  ...(zadaci.length ? zadaci.flatMap((z) => [z, '']) : ['☕ Danas nemaš ništa da uradiš, sve ide automatski.', '']),
  ...(jednokratni.length
    ? ['📌 Još nije urađeno (javi Claude-u kad završiš, da skine sa liste):', ...jednokratni.map((z) => `• ${z}`), '']
    : []),
]
  .join('\n')
  .trim();

console.log(poruka);
if (!process.argv.includes('--bez-slanja')) {
  await telegram(poruka);
  console.log('Podsetnik poslat.');
}
