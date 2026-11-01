// Zajedničko za videe sa maskotom Byte (AI Wars, Tool of the Day): glas, pokreti usta, snimak ekrana i render (Remotion u video/).

import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REPO_DIR, SCRIPTS_DIR } from './lib.mjs';

export const VIDEO_DIR = join(REPO_DIR, 'video');
export const FPS = 30;
const GLAS = 'am_puck';

/** Izgovara svaku repliku u poseban WAV u folderu (video/public/<putanja>) i dopisuje sekundi, jacina i audio. */
export async function ozvuci(replike, putanja) {
  for (const [i, r] of replike.entries()) {
    const wav = join(VIDEO_DIR, 'public', putanja, `${i}.wav`);
    const { ukupno } = await govori({ izlaz: wav, glas: GLAS, brzina: 1.08, delovi: [r.tekst] });
    Object.assign(r, { sekundi: ukupno, jacina: jacinaPoKadru(await readFile(wav)), audio: `${putanja}/${i}.wav` });
  }
  return replike;
}

/** Renderuje kompoziciju Episode iz video/ sa datim podacima. */
export function renderuj(propsFajl, izlaz) {
  return pokreni('npx', ['remotion', 'render', 'src/index.ts', 'Episode', izlaz, `--props=${propsFajl}`, '--log=error'], VIDEO_DIR);
}

/** Snimak ekrana sajta (video/snimak.mjs). Vraća true ako je uspeo. */
export async function snimiEkran(url, izlaz) {
  try {
    await pokreni('node', ['snimak.mjs', url, izlaz], VIDEO_DIR, 'ignore');
    return true;
  } catch (err) {
    console.log(`Snimak ekrana nije uspeo (${url}): ${err.message}`);
    return false;
  }
}

/** Kadar (u ms) kad je naslovna kartica (druga replika) potpuno na ekranu: naslovna slika za Instagram. */
export const naslovnaMs = (replike) => Math.round(((8 + Math.ceil(replike[0].sekundi * FPS) + 6 + 36) / FPS) * 1000);

export const trajanje = (replike) => Math.round(replike.reduce((z, r) => z + r.sekundi + 0.2, 1.8));

function govori(ulaz) {
  return new Promise((resolve, reject) => {
    const proces = spawn(process.env.TTS_PYTHON || 'python3', ['-I', join(SCRIPTS_DIR, 'tts.py')], { stdio: ['pipe', 'pipe', 'inherit'] });
    let izlaz = '';
    proces.stdout.on('data', (d) => (izlaz += d));
    proces.on('error', reject);
    proces.on('close', (kod) => (kod === 0 ? resolve(JSON.parse(izlaz)) : reject(new Error(`tts.py je završio sa kodom ${kod}`))));
    proces.stdin.end(JSON.stringify(ulaz));
  });
}

/** WAV (PCM 16-bit, mono) → jačina zvuka po kadru, 0..1. */
function jacinaPoKadru(wav) {
  let p = 12;
  let ucestanost = 24000;
  while (p < wav.length - 8) {
    const id = wav.toString('ascii', p, p + 4);
    const vel = wav.readUInt32LE(p + 4);
    if (id === 'fmt ') ucestanost = wav.readUInt32LE(p + 12);
    if (id === 'data') {
      const uzorci = new Int16Array(wav.buffer.slice(wav.byteOffset + p + 8, wav.byteOffset + p + 8 + (vel & ~1)));
      const n = Math.floor(ucestanost / FPS);
      const r = [];
      for (let i = 0; i < uzorci.length; i += n) {
        let z = 0;
        const kraj = Math.min(uzorci.length, i + n);
        for (let j = i; j < kraj; j++) z += (uzorci[j] / 32768) ** 2;
        r.push(Math.sqrt(z / (kraj - i)));
      }
      const max = Math.max(...r) || 1;
      return r.map((v) => Math.round(Math.min(1, (v / max) * 1.3) * 1000) / 1000);
    }
    p += 8 + vel + (vel % 2);
  }
  throw new Error('WAV bez podataka');
}

function pokreni(komanda, args, cwd, stdio = 'inherit') {
  return new Promise((resolve, reject) => {
    const p = spawn(komanda, args, { cwd, stdio, timeout: 15 * 60_000 });
    p.on('error', reject);
    p.on('close', (kod) => (kod === 0 ? resolve() : reject(new Error(`${komanda} ${args[0]} je završio sa kodom ${kod}`))));
  });
}
