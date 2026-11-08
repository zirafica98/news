// Petkom šalje na admin Telegram listu alata iz Tool of the Day videa te nedelje (subota–petak),
// da Mihajlo izabere jedan, isproba ga na stvarnom problemu i od toga zajedno napravimo video za nedelju.
// Opis i cena se uzimaju iz srpskog izdanja (public/data/DATUM.json), a ako ga nema, iz engleskog.
//
// Tajne: TELEGRAM_BOT_TOKEN i TELEGRAM_ADMIN_CHAT_ID.
// Pokretanje: node scripts/alati-nedelje.mjs [--datum=YYYY-MM-DD] [--bez-slanja]

import { join } from 'node:path';
import { DATA_DIR, SCRIPTS_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

const bezSlanja = process.argv.includes('--bez-slanja');
const datum = datumIzArgumenata();
const dan = (pomak) => new Date(Date.parse(`${datum}T12:00:00Z`) + pomak * 86_400_000).toISOString().slice(0, 10);
const od = dan(-6);

const { alati = [] } = await readJson(join(SCRIPTS_DIR, 'state', 'alat-dana.json'), {});
const nedelja = alati.filter((a) => a.datum >= od && a.datum <= datum).sort((a, b) => a.broj - b.broj);

const stavke = [];
for (const a of nedelja) {
  const en = (await readJson(join(DATA_DIR, 'en', `${a.datum}.json`), {})).novo ?? [];
  const sr = (await readJson(join(DATA_DIR, `${a.datum}.json`), {})).novo ?? [];
  const i = en.findIndex((n) => n.naziv === a.naziv);
  // Srpska stavka je na istom mestu u listi; proverava se po linku da se ne pomeša sa drugom.
  const alat = i >= 0 && sr[i] && sr[i].link === en[i].link ? sr[i] : en[i];
  stavke.push({ ...a, opis: alat?.opis ?? '', cena: alat?.cena ?? '', link: alat?.link ?? '' });
}

const formatDatum = (d) => new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T12:00:00Z`));
const poruka = stavke.length
  ? [
      `🧑‍💻 Alati ove nedelje (${formatDatum(od)} – ${formatDatum(datum)})`,
      '',
      ...stavke.map((s) =>
        [
          `#${s.broj} ${s.naziv}`,
          s.opis,
          s.cena ? `💰 ${s.cena}` : '',
          s.link ? `🔗 ${s.link}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      ).flatMap((t) => [t, '']),
      'Izaberi jedan, probaj ga na stvarnom problemu i do nedelje se javi u chatu sa Claude-om sa svojim mišljenjem (i snimkom ekrana ako ga imaš), pa zajedno pravimo video.',
    ].join('\n')
  : `🧑‍💻 Ove nedelje (${formatDatum(od)} – ${formatDatum(datum)}) nije bilo Tool of the Day videa.`;

console.log(poruka);
if (bezSlanja) process.exit(0);

const { TELEGRAM_BOT_TOKEN: bot, TELEGRAM_ADMIN_CHAT_ID: admin } = process.env;
if (!bot || !admin) {
  console.log('Nema TELEGRAM_BOT_TOKEN ili TELEGRAM_ADMIN_CHAT_ID, lista nije poslata.');
  process.exit(0);
}
// Telegram poruka ima najviše 4096 znakova.
const odgovor = await preuzmi(`https://api.telegram.org/bot${bot}/sendMessage`, {
  metoda: 'POST',
  headers: { 'Content-Type': 'application/json' },
  telo: JSON.stringify({ chat_id: admin, text: poruka.slice(0, 4000), disable_web_page_preview: true }),
});
if (!odgovor.ok) throw new Error(`Telegram nije primio listu: ${odgovor.status} ${odgovor.tekst}`);
console.log('Lista alata poslata na Telegram.');
