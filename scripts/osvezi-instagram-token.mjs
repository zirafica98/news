// Produžava Instagram token (važi 60 dana) i, ako je Instagram vratio novi, upisuje ga u GitHub tajnu INSTAGRAM_ACCESS_TOKEN.
// Jutarnji posao ovo pokreće 1. i 15. u mesecu. Za upis tajne treba GH_SECRETS_TOKEN:
// fine-grained GitHub token samo za ovaj repo, sa dozvolom Secrets: Read and write.
//
// Pokretanje: node scripts/osvezi-instagram-token.mjs

import { spawnSync } from 'node:child_process';
import { preuzmi } from './lib.mjs';

const token = process.env.INSTAGRAM_ACCESS_TOKEN;
if (!token) {
  console.log('Instagram nije podešen (INSTAGRAM_ACCESS_TOKEN), preskačem.');
  process.exit(0);
}

const parametri = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
const odgovor = await preuzmi(`https://graph.instagram.com/refresh_access_token?${parametri}`, { timeoutMs: 60_000 });
const podaci = JSON.parse(odgovor.tekst || '{}');
if (!odgovor.ok || !podaci.access_token) {
  console.error(`Instagram token nije produžen: ${podaci.error?.message ?? odgovor.status}`);
  process.exit(1);
}

const dana = Math.round(podaci.expires_in / 86_400);
if (podaci.access_token === token) {
  console.log(`Instagram token je produžen, važi još ${dana} dana.`);
  process.exit(0);
}

// Novi token ne sme da se pojavi u logu posla.
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${podaci.access_token}`);

const pat = process.env.GH_SECRETS_TOKEN;
const repo = process.env.GITHUB_REPOSITORY;
if (!pat || !repo) {
  console.error(`Instagram je vratio novi token (važi ${dana} dana), ali nema GH_SECRETS_TOKEN pa ne mogu da ga upišem u tajne.`);
  process.exit(1);
}
const gh = spawnSync('gh', ['secret', 'set', 'INSTAGRAM_ACCESS_TOKEN', '--repo', repo], {
  input: podaci.access_token,
  env: { ...process.env, GH_TOKEN: pat },
  encoding: 'utf8',
});
if (gh.status !== 0) {
  console.error(`Upis novog tokena u GitHub tajne nije uspeo: ${gh.stderr.trim()}`);
  process.exit(1);
}
console.log(`Novi Instagram token je upisan u GitHub tajne, važi ${dana} dana.`);
