// Šalje push notifikaciju o novom izdanju svim pretplaćenim uređajima.
// Radi samo ako postoje VAPID ključevi (tajne u GitHub Actions) i bar jedna pretplata,
// inače tiho preskače, da izdanje ne zavisi od notifikacije.
//
// Pokretanje: npm run obavesti
//             npm run obavesti -- --datum=2026-09-17

import { join } from 'node:path';
import webpush from 'web-push';
import { SCRIPTS_DIR, datumIzArgumenata, paths, readJson, writeJson } from './lib.mjs';

const SAJT = 'https://news-one-teal.vercel.app';
const PRETPLATE_FILE = join(SCRIPTS_DIR, 'state', 'pretplate.json');

const javni = process.env.VAPID_PUBLIC_KEY;
const privatni = process.env.VAPID_PRIVATE_KEY;
if (!javni || !privatni) {
  console.log('Notifikacije nisu podešene (VAPID ključevi), preskačem.');
  process.exit(0);
}

const pretplate = await readJson(PRETPLATE_FILE, []);
if (!pretplate.length) {
  console.log('Nema nijednog pretplaćenog uređaja, preskačem notifikaciju.');
  process.exit(0);
}

// Ako današnje izdanje još ne postoji (ručni test pre jutra), šalje se najnovije objavljeno.
let datum = datumIzArgumenata();
if (!(await readJson(paths.izdanje(datum), null)) && !process.argv.some((a) => a.startsWith('--datum='))) {
  datum = (await readJson(paths.index, []))[0]?.datum ?? datum;
}
const izdanje = await readJson(paths.izdanje(datum), null);
if (!izdanje) {
  console.error(`Nema objavljenog izdanja za ${datum}.`);
  process.exit(1);
}

webpush.setVapidDetails('mailto:zirafica.98@gmail.com', javni, privatni);

const poruka = JSON.stringify({
  naslov: `☕ AI News · ${izdanje.vesti[0]?.naslov ?? 'novo izdanje'}`,
  telo: izdanje.ukratko.slice(0, 180),
  url: `${SAJT}/izdanje/${datum}`,
  oznaka: `izdanje-${datum}`,
});

const rezultati = await Promise.all(
  pretplate.map(async (p) => {
    try {
      await webpush.sendNotification(p, poruka, { TTL: 6 * 3600 });
      return { ok: true, p };
    } catch (err) {
      // 404 i 410 znače da uređaj više nije pretplaćen (obrisana aplikacija, istekla pretplata).
      return { ok: false, p, istekla: [404, 410].includes(err.statusCode), poruka: err.statusCode ?? err.message };
    }
  }),
);

const poslato = rezultati.filter((r) => r.ok).length;
const istekle = rezultati.filter((r) => r.istekla);
if (istekle.length) {
  await writeJson(PRETPLATE_FILE, pretplate.filter((p) => !istekle.some((r) => r.p.endpoint === p.endpoint)));
}
const greske = rezultati.filter((r) => !r.ok && !r.istekla);
console.log(`Notifikacija poslata na ${poslato}/${pretplate.length} uređaja${istekle.length ? `, uklonjeno isteklih: ${istekle.length}` : ''}.`);
for (const g of greske) console.warn(`  Neuspelo slanje: ${g.poruka}`);
