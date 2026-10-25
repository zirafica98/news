// Jednokratna prijava na YouTube: otvori Google prijavu u pregledaču i ispiše refresh token za GitHub tajnu YOUTUBE_REFRESH_TOKEN.
// Pokreće se lokalno, na Mac-u, sa podacima OAuth klijenta iz Google Cloud konzole (tip: Desktop app):
//
//   YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... node scripts/youtube-prijava.mjs
//
// Prijavi se nalogom koji ima YouTube kanal. Token ne šalji nikome, upiši ga samo u GitHub tajne.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';

const { YOUTUBE_CLIENT_ID: klijent, YOUTUBE_CLIENT_SECRET: tajna } = process.env;
if (!klijent || !tajna) {
  console.error('Pokreni ovako: YOUTUBE_CLIENT_ID=... YOUTUBE_CLIENT_SECRET=... node scripts/youtube-prijava.mjs');
  process.exit(1);
}

// upload za videe; force-ssl za čitanje kanala, plejliste i komentar sa pitanjem ispod Shorta.
const OVLASCENJA = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl'];

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const kod = url.searchParams.get('code');
  if (!kod) {
    res.end(`Prijava nije uspela: ${url.searchParams.get('error') ?? 'nema koda'}`);
    return;
  }
  const odgovor = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: kod, client_id: klijent, client_secret: tajna, redirect_uri: adresaPovratka, grant_type: 'authorization_code' }),
  });
  const podaci = await odgovor.json();
  if (!podaci.refresh_token) {
    res.end('Google nije vratio refresh token. Pogledaj terminal.');
    console.error('Google nije vratio refresh token:', podaci.error_description ?? podaci.error ?? podaci);
  } else {
    res.end('Prijava je uspela. Vrati se u terminal i zatvori ovaj prozor.');
    console.log('\nUpiši ovo u GitHub tajnu YOUTUBE_REFRESH_TOKEN (repo news → Settings → Secrets and variables → Actions):\n');
    console.log(podaci.refresh_token);
    console.log();
  }
  server.close();
});

let adresaPovratka;
server.listen(0, '127.0.0.1', () => {
  adresaPovratka = `http://127.0.0.1:${server.address().port}`;
  const prijava = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: klijent,
    redirect_uri: adresaPovratka,
    response_type: 'code',
    scope: OVLASCENJA.join(' '),
    // offline + consent: Google tada vraća refresh token koji ne ističe posle sat vremena.
    access_type: 'offline',
    prompt: 'consent',
  })}`;
  console.log(`Otvaram Google prijavu u pregledaču. Ako se ne otvori, otvori ovu adresu:\n${prijava}\n`);
  execFile('open', [prijava], () => {});
});
