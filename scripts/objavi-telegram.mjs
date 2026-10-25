// Objavljuje izdanje u Telegram kanal: album sa slajdovima karusela i kratkim opisom, a subotom i nedeljni video.
// Slike i video su na sajtu (public/insta), Telegram ih preuzima sa javnog URL-a. Opis nema link ka sajtu ni izvore.
//
// Tajne (GitHub → Settings → Secrets → Actions):
//   TELEGRAM_BOT_TOKEN  — token bota od @BotFather; bot mora biti administrator kanala sa pravom objavljivanja
//   TELEGRAM_CHAT_ID    — @ime_kanala (javni kanal) ili brojčani ID (-100…)
// Ako tajni nema, tiho preskače.
//
// Napomena: bot ne može da čita istoriju kanala, pa nema provere duplikata. Ručno ponovno pokretanje
// režima drustvene za isti dan objaviće izdanje u kanalu još jednom.
//
// Pokretanje: node scripts/objavi-telegram.mjs
//             node scripts/objavi-telegram.mjs --datum=2026-10-24
//             node scripts/objavi-telegram.mjs --provera   (samo proveri bota i kanal, ništa ne objavljuje)

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR, izaberiVesti, jeNedeljniReel, lepDatum, opisReela, skrati } from './insta-slike.mjs';
import { DATA_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

const SAJT = 'https://news-one-teal.vercel.app';
const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: kanal } = process.env;
if (!token || !kanal) {
  console.log('Telegram nije podešen (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID), preskačem.');
  process.exit(0);
}
const provera = process.argv.includes('--provera');
const datum = datumIzArgumenata();

async function tg(metoda, polja = {}) {
  const odgovor = await preuzmi(`https://api.telegram.org/bot${token}/${metoda}`, {
    metoda: 'POST',
    headers: { 'Content-Type': 'application/json' },
    telo: JSON.stringify(polja),
    timeoutMs: 120_000,
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!podaci.ok) throw new Error(`Telegram ${metoda}: ${podaci.description ?? odgovor.status}`);
  return podaci.result;
}

const bot = await tg('getMe');
const chat = await tg('getChat', { chat_id: kanal });
console.log(`Telegram: bot @${bot.username}, kanal „${chat.title}“`);
if (provera) process.exit(0);

const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) throw new Error(`Nema engleskog izdanja za ${datum}.`);

const fajlovi = await readdir(INSTA_DIR).catch(() => []);
const slike = fajlovi
  .filter((f) => new RegExp(`^${datum}-\\d+\\.jpg$`).test(f))
  .sort((a, b) => parseInt(a.match(/(\d+)\.jpg$/)[1]) - parseInt(b.match(/(\d+)\.jpg$/)[1]))
  .map((f) => `${SAJT}/insta/${f}`);
if (slike.length < 2) throw new Error(`Nema slika za ${datum} u public/insta.`);

// Opis albuma je najviše 1024 znaka.
const naslovi = izaberiVesti(izdanje).map((v, i) => `${i + 1}. ${v.naslov}`);
const opis = [`☕ AI Morning Brief · ${lepDatum(datum)}`, skrati(izdanje.ukratko, 420), `Today's top ${naslovi.length}:\n${naslovi.join('\n')}`].join('\n\n');

// Telegram album ima najviše 10 stavki, a opis se prikazuje uz prvu.
await tg('sendMediaGroup', {
  chat_id: kanal,
  media: slike.slice(0, 10).map((url, i) => ({ type: 'photo', media: url, ...(i === 0 ? { caption: opis.slice(0, 1024) } : {}) })),
});
console.log(`Objavljeno u Telegram kanalu (${Math.min(slike.length, 10)} slika).`);

// Subotom i nedeljni video; dnevni Reel bi samo ponovio album.
// Subotom ide nedeljni Short sa glasom (shorts.mjs), a ako ga nema, stari Reel od slajdova.
const nedeljniVideo = [`${datum}-short-nedelja.mp4`, `${datum}-reel.mp4`].find((f) => fajlovi.includes(f));
if (jeNedeljniReel(izdanje) && nedeljniVideo) {
  const { opis: opisVidea } = opisReela(izdanje, '');
  await tg('sendVideo', {
    chat_id: kanal,
    video: `${SAJT}/insta/${nedeljniVideo}`,
    caption: opisVidea.trim().slice(0, 1024),
    supports_streaming: true,
    width: 1080,
    height: 1920,
  });
  console.log('Objavljen nedeljni video u Telegram kanalu.');
}
