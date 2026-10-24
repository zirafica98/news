// Produžava Instagram i Threads token (oba važe 60 dana) i, ako je Meta vratila novi, upisuje ga u GitHub tajnu
// (INSTAGRAM_ACCESS_TOKEN, THREADS_ACCESS_TOKEN). Token koji nije podešen se preskače.
// Jutarnji posao ovo pokreće 1. i 15. u mesecu. Za upis tajne treba GH_SECRETS_TOKEN:
// fine-grained GitHub token samo za ovaj repo, sa dozvolom Secrets: Read and write.
//
// Pokretanje: node scripts/osvezi-instagram-token.mjs

import { spawnSync } from 'node:child_process';
import { preuzmi } from './lib.mjs';

const TOKENI = [
  { naziv: 'Instagram', tajna: 'INSTAGRAM_ACCESS_TOKEN', url: 'https://graph.instagram.com/refresh_access_token', grant: 'ig_refresh_token' },
  { naziv: 'Threads', tajna: 'THREADS_ACCESS_TOKEN', url: 'https://graph.threads.net/refresh_access_token', grant: 'th_refresh_token' },
];

let greska = false;

for (const { naziv, tajna, url, grant } of TOKENI) {
  const token = process.env[tajna];
  if (!token) {
    console.log(`${naziv} nije podešen (${tajna}), preskačem.`);
    continue;
  }

  const parametri = new URLSearchParams({ grant_type: grant, access_token: token });
  const odgovor = await preuzmi(`${url}?${parametri}`, { timeoutMs: 60_000 });
  const podaci = JSON.parse(odgovor.tekst || '{}');
  if (!odgovor.ok || !podaci.access_token) {
    console.error(`${naziv} token nije produžen: ${podaci.error?.message ?? odgovor.status}`);
    greska = true;
    continue;
  }

  const dana = Math.round(podaci.expires_in / 86_400);
  if (podaci.access_token === token) {
    console.log(`${naziv} token je produžen, važi još ${dana} dana.`);
    continue;
  }

  // Novi token ne sme da se pojavi u logu posla.
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${podaci.access_token}`);

  const pat = process.env.GH_SECRETS_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!pat || !repo) {
    console.error(`${naziv} je vratio novi token (važi ${dana} dana), ali nema GH_SECRETS_TOKEN pa ne mogu da ga upišem u tajne.`);
    greska = true;
    continue;
  }
  const gh = spawnSync('gh', ['secret', 'set', tajna, '--repo', repo], {
    input: podaci.access_token,
    env: { ...process.env, GH_TOKEN: pat },
    encoding: 'utf8',
  });
  if (gh.status !== 0) {
    console.error(`Upis novog ${naziv} tokena u GitHub tajne nije uspeo: ${gh.stderr.trim()}`);
    greska = true;
    continue;
  }
  console.log(`Novi ${naziv} token je upisan u GitHub tajne, važi ${dana} dana.`);
}

if (greska) process.exit(1);
