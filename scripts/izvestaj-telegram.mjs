// Kratak izveštaj na Telegram (privatno, samo tebi) posle svakog GitHub posla: šta je urađeno, šta nije i link ka logu.
// Čita ispis posla (workflow ga snima u $RUNNER_TEMP/izlaz.log) i iz njega izvlači rezultate po koracima i mrežama.
//
// Tajne: TELEGRAM_BOT_TOKEN (isti bot kao za kanal) i TELEGRAM_ADMIN_CHAT_ID (tvoj privatni chat sa botom).
// Kako dobiti chat ID: pošalji botu bilo koju poruku (npr. /start), pa pokreni posao u režimu telegram-id;
// u logu piše ID koji upišeš u tajnu TELEGRAM_ADMIN_CHAT_ID.
//
// Pokretanje: node scripts/izvestaj-telegram.mjs <izlaz.log>
//             node scripts/izvestaj-telegram.mjs --nadji-chat
// Promenljive iz workflow-a: REZIM, ISHOD (success/failure/cancelled), RUN_URL.

import { readFile } from 'node:fs/promises';
import { preuzmi } from './lib.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN;
const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
if (!token) {
  console.log('Telegram bot nije podešen (TELEGRAM_BOT_TOKEN), preskačem izveštaj.');
  process.exit(0);
}

async function tg(metoda, polja = {}) {
  const odgovor = await preuzmi(`https://api.telegram.org/bot${token}/${metoda}`, {
    metoda: 'POST',
    headers: { 'Content-Type': 'application/json' },
    telo: JSON.stringify(polja),
  });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!podaci.ok) throw new Error(`Telegram ${metoda}: ${podaci.description ?? odgovor.status}`);
  return podaci.result;
}

if (process.argv.includes('--nadji-chat')) {
  const poruke = await tg('getUpdates', { allowed_updates: ['message'] });
  const chatovi = new Map(poruke.filter((u) => u.message?.chat?.type === 'private').map((u) => [u.message.chat.id, u.message.chat]));
  if (!chatovi.size) console.log('Bot nema nijednu privatnu poruku. Pošalji mu /start u Telegram-u, pa pokreni ovo ponovo.');
  for (const [id, c] of chatovi) console.log(`Privatni chat: ${[c.first_name, c.last_name].filter(Boolean).join(' ')} ${c.username ? `(@${c.username})` : ''} → TELEGRAM_ADMIN_CHAT_ID = ${id}`);
  process.exit(0);
}
if (!admin) {
  console.log('Nema TELEGRAM_ADMIN_CHAT_ID, preskačem izveštaj (vidi uputstvo na vrhu scripts/izvestaj-telegram.mjs).');
  process.exit(0);
}

const rezim = process.env.REZIM || 'normalno';
const ishod = process.env.ISHOD || 'unknown';
const log = (await readFile(process.argv[2] ?? '', 'utf8').catch(() => ''))
  // Bez ANSI boja i GitHub vremenskih oznaka.
  .replace(/\x1b\[[0-9;]*m/g, '')
  .split('\n')
  .map((l) => l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s/, '').trim())
  .filter(Boolean);
const ima = (re) => log.some((l) => re.test(l));
const nadji = (re) => log.find((l) => re.test(l));
const skrati = (t, n = 160) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

const redovi = [];

// Jutarnje izdanje (normalno, ponovo).
if (['normalno', 'ponovo'].includes(rezim)) {
  // Rezervni termini koji nisu imali šta da rade ne šalju poruku.
  if (ishod === 'success' && ima(/je već objavljeno\. Kraj\./)) process.exit(0);
  if (ishod === 'skipped') process.exit(0);
  const izdanje = nadji(/Izdanje za \S+ je ispravno/);
  redovi.push(izdanje && ima(/Poslato na GitHub/) ? '✅ Izdanje napisano i objavljeno na sajtu' : '❌ Izdanje nije objavljeno');
  if (ima(/Engleski prevod nije uspeo/)) redovi.push('⚠️ Engleski prevod nije uspeo (mreže ga koriste)');
  const slike = nadji(/^Instagram za \S+: karusel/);
  redovi.push(slike ? '✅ Slike za Instagram (karusel i story)' : '⚠️ Slike za Instagram nisu napravljene');
  const videi = nadji(/^Video za \S+:/);
  if (videi) redovi.push(`✅ YouTube videa napravljeno: ${(videi.match(/\.mp4/g) ?? []).length}`);
  else if (ima(/Shorts nisu napravljeni/)) redovi.push('⚠️ YouTube videi nisu napravljeni');
  const push = nadji(/Notifikacija poslata na/);
  if (push) redovi.push(`✅ ${push.replace(/\.$/, '')}`);
  else if (ima(/Push notifikacija nije poslata/)) redovi.push('⚠️ Push notifikacija nije poslata');
}

// Objave na mreže (drustvene, ili jedna mreža ručno).
if (['drustvene', 'instagram', 'threads', 'youtube'].includes(rezim)) {
  const NAZIVI = { instagram: 'Instagram', threads: 'Threads', youtube: 'YouTube', telegram: 'Telegram' };
  const odeljci = new Map();
  let tekuci = rezim === 'drustvene' ? null : rezim;
  for (const l of log) {
    const grupa = l.match(/^::group::(\w+)/);
    if (grupa) tekuci = grupa[1];
    else if (l.startsWith('::endgroup::')) tekuci = rezim === 'drustvene' ? null : rezim;
    else if (tekuci) odeljci.set(tekuci, [...(odeljci.get(tekuci) ?? []), l]);
  }
  for (const [mreza, linije] of odeljci) {
    const objavljeno = linije.filter((l) => /^Objavljen/.test(l));
    const vec = linije.filter((l) => /već/i.test(l)).length;
    const greske = linije.filter((l) => /nije uspeo|nije objavljen|nije uspela|Error:|GREŠKA/.test(l));
    const kvota = linije.some((l) => /quota/i.test(l));
    const nepodesen = linije.some((l) => /nije podešen/.test(l));
    const ikona = greske.length && !kvota ? '❌' : kvota ? '⚠️' : objavljeno.length || vec ? '✅' : nepodesen ? '⏸' : '⚠️';
    const delovi = [];
    if (objavljeno.length) delovi.push(`objavljeno ${objavljeno.length}`);
    if (vec) delovi.push(`već ranije ${vec}`);
    if (kvota) delovi.push('kvota potrošena, ostatak ide sutra');
    if (nepodesen && !objavljeno.length) delovi.push('nije podešen');
    if (!delovi.length) delovi.push('ništa objavljeno');
    redovi.push(`${ikona} ${NAZIVI[mreza] ?? mreza}: ${delovi.join(', ')}`);
    for (const g of greske.filter((g) => !/quota/i.test(g)).slice(0, 2)) redovi.push(`   ↳ ${skrati(g)}`);
  }
  if (!odeljci.size) redovi.push(ishod === 'success' ? '✅ Nema ničeg novog za objavu' : '❌ Posao nije stigao do objava');
}

if (rezim === 'provera') {
  for (const l of log.filter((l) => /^(Instagram|Threads|YouTube|Telegram):|ne radi|nije podešen/.test(l))) redovi.push(`• ${skrati(l)}`);
  redovi.push(ima(/Provera je prošla/) ? '✅ Provera je prošla, ništa nije objavljeno' : '❌ Provera nije prošla');
}
if (rezim === 'notifikacija') {
  redovi.push(nadji(/Notifikacija poslata na|Nema nijednog pretplaćenog/) ?? '❌ Notifikacija nije poslata');
}

// Greške iz jutarnje skripte i nepredviđeni padovi.
for (const g of log.filter((l) => /GREŠKA \(kod/.test(l)).slice(0, 2)) redovi.push(`❌ ${skrati(g)}`);

const naslovi = {
  normalno: '☕ Jutarnje izdanje',
  ponovo: '☕ Izdanje (ponovo)',
  drustvene: '📣 Objave na mreže',
  instagram: '📸 Instagram',
  threads: '🧵 Threads',
  youtube: '▶️ YouTube',
  provera: '🔎 Provera',
  notifikacija: '🔔 Notifikacija',
  'instagram-token': '🔑 Instagram token',
};
const datum = new Intl.DateTimeFormat('sr-Latn-RS', { timeZone: 'Europe/Belgrade', day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date());
const status = ishod === 'success' ? '✅' : ishod === 'cancelled' ? '⏹' : '❌';
const poruka = [`${status} ${naslovi[rezim] ?? rezim} · ${datum}`, '', ...(redovi.length ? redovi : [`Ishod: ${ishod}`]), '', process.env.RUN_URL ? `Log: ${process.env.RUN_URL}` : '']
  .join('\n')
  .trim();

await tg('sendMessage', { chat_id: admin, text: poruka, disable_web_page_preview: true });
console.log('Izveštaj poslat na Telegram.');
