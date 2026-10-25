// Briše stare medije za mreže iz public/insta (slike, videe, spiskove): sve sa datumom starijim od 14 dana.
// Mreže fajl preuzmu u trenutku objave, pa posle toga na sajtu više ne trebaju, a repo bi rastao ~250 MB mesečno.
// Datum se čita iz imena fajla (YYYY-MM-DD-…), ne iz vremena izmene, jer git checkout menja vremena.
//
// Pokretanje: node scripts/ocisti-medije.mjs [--dana=14]

import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTA_DIR } from './insta-slike.mjs';
import { datumIzArgumenata } from './lib.mjs';

const dana = Number(process.argv.find((a) => a.startsWith('--dana='))?.split('=')[1] ?? 14);
const danas = datumIzArgumenata([]);
const granica = new Date(new Date(`${danas}T00:00:00Z`).getTime() - dana * 86_400_000).toISOString().slice(0, 10);

let obrisano = 0;
for (const f of await readdir(INSTA_DIR).catch(() => [])) {
  const datum = f.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];
  if (datum && datum < granica) {
    await rm(join(INSTA_DIR, f));
    obrisano++;
  }
}
console.log(`Stari mediji (pre ${granica}): obrisano ${obrisano} fajlova.`);
