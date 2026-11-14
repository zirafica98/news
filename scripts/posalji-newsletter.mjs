// Jutarnji email newsletter preko Resend Broadcasts: englesko izdanje (sažetak, top vesti, alat dana)
// ide svim potvrđenim kontaktima iz segmenta. Odjava je Resend-ov link u dnu mejla.
// Ako tajne nisu podešene, tiho preskače, da izdanje ne zavisi od newslettera.
// Isti dan se ne šalje dvaput (scripts/state/newsletter.json).
//
// Tajne: RESEND_API_KEY, RESEND_SEGMENT_ID (i po želji NEWSLETTER_FROM).
// Pokretanje: node scripts/posalji-newsletter.mjs [--datum=YYYY-MM-DD] [--pregled]
//   --pregled  samo napravi scripts/out/newsletter-DATUM.html, bez slanja

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { KATEGORIJE, izaberiVesti } from './insta-slike.mjs';
import { DATA_DIR, OUT_DIR, SCRIPTS_DIR, datumIzArgumenata, readJson, writeJson } from './lib.mjs';

const SAJT = 'https://aimorningbrief.dev';
const POSILJALAC = process.env.NEWSLETTER_FROM || 'AI Morning Brief <brief@aimorningbrief.dev>';
const STANJE = join(SCRIPTS_DIR, 'state', 'newsletter.json');
const pregled = process.argv.includes('--pregled');

const datum = datumIzArgumenata();
const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
if (!izdanje) {
  console.log(`Nema engleskog izdanja za ${datum}, newsletter se preskače.`);
  process.exit(0);
}

const { RESEND_API_KEY: kljuc, RESEND_SEGMENT_ID: segment } = process.env;
const stanje = await readJson(STANJE, { poslato: [] });
if (!pregled) {
  if (!kljuc || !segment) {
    console.log('Newsletter nije podešen (RESEND_API_KEY, RESEND_SEGMENT_ID), preskačem.');
    process.exit(0);
  }
  if (stanje.poslato.some((p) => p.datum === datum)) {
    console.log(`Newsletter za ${datum} je već poslat.`);
    process.exit(0);
  }
}

const vesti = izaberiVesti(izdanje).slice(0, 5);
const alat = (izdanje.novo ?? [])
  .filter((n) => n.kakoProbati?.length)
  .sort((a, b) => Number(!['alat', 'projekat'].includes(a.tip)) - Number(!['alat', 'projekat'].includes(b.tip)))[0];
const lepDatum = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${datum}T12:00:00Z`));
const naslov = `☕ ${vesti[0]?.naslov ?? 'Your AI brief'}`.slice(0, 140);
const html = napravi();

if (pregled) {
  await mkdir(OUT_DIR, { recursive: true });
  const fajl = join(OUT_DIR, `newsletter-${datum}.html`);
  await writeFile(fajl, html);
  console.log(`Naslov: ${naslov}\nPregled: ${fajl}`);
  process.exit(0);
}

const res = await fetch('https://api.resend.com/broadcasts', {
  method: 'POST',
  headers: { Authorization: `Bearer ${kljuc}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ segment_id: segment, from: POSILJALAC, subject: naslov, html, name: `AI Morning Brief ${datum}`, send: true }),
});
const odgovor = await res.text();
if (!res.ok) throw new Error(`Resend nije poslao newsletter: ${res.status} ${odgovor}`);
stanje.poslato = [...stanje.poslato, { datum, id: JSON.parse(odgovor).id }].slice(-60);
await writeJson(STANJE, stanje);
console.log(`Newsletter za ${datum} poslat: ${naslov}`);

// ---------- HTML ----------

function napravi() {
  const e = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\{\{/g, '{ {');
  const vest = (v, i) => `
    <tr><td style="padding:0 0 22px">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em">${i + 1} · ${e(KATEGORIJE[v.kategorija] ?? v.kategorija)}</p>
      <h2 style="margin:0 0 6px;font-size:18px;line-height:1.35;color:#0f172a">${e(v.naslov)}</h2>
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#334155">${e(v.staSeDesilo)}</p>
      <p style="margin:0;font-size:14px;line-height:1.55;color:#334155;background:#fef3c7;border-radius:10px;padding:10px 12px"><b style="color:#b45309">Why it matters:</b> ${e(v.zastoJeBitno)}</p>
      ${v.izvori?.[0] ? `<p style="margin:8px 0 0;font-size:13px"><a href="${e(v.izvori[0].url)}" style="color:#4f46e5">${e(v.izvori[0].naziv)} ↗</a></p>` : ''}
    </td></tr>`;
  const alatHtml = alat
    ? `
    <tr><td style="padding:6px 0 24px">
      <div style="border:1px solid #a7f3d0;background:#ecfdf5;border-radius:14px;padding:16px 18px">
        <p style="margin:0 0 4px;font-size:12px;color:#047857;text-transform:uppercase;letter-spacing:.08em;font-weight:700">🛠 Tool of the day</p>
        <h2 style="margin:0 0 6px;font-size:18px;color:#0f172a">${e(alat.naziv)}</h2>
        <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155">${e(alat.opis)}</p>
        <ol style="margin:0 0 10px;padding-left:20px;font-size:14px;line-height:1.6;color:#334155">${alat.kakoProbati.map((k) => `<li>${e(k)}</li>`).join('')}</ol>
        ${alat.cena ? `<p style="margin:0 0 8px;font-size:13px;color:#475569"><b>Price:</b> ${e(alat.cena)}</p>` : ''}
        ${alat.link ? `<p style="margin:0;font-size:14px"><a href="${e(alat.link)}" style="color:#047857;font-weight:600">Try it ↗</a></p>` : ''}
      </div>
    </td></tr>`
    : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(naslov)}</title></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${e(izdanje.ukratko).slice(0, 140)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:18px">
  <tr><td style="padding:24px 26px 8px">
    <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.2em;color:#b45309">AI MORNING BRIEF</p>
    <p style="margin:4px 0 0;font-size:13px;color:#64748b">${e(lepDatum)}</p>
  </td></tr>
  <tr><td style="padding:12px 26px 6px">
    <p style="margin:0;font-size:16px;line-height:1.65;color:#0f172a">${e(izdanje.ukratko)}</p>
  </td></tr>
  <tr><td style="padding:18px 26px 0">
    <p style="margin:0 0 14px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.12em">Top stories</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${vesti.map(vest).join('')}${alatHtml}</table>
  </td></tr>
  <tr><td style="padding:0 26px 26px" align="center">
    <a href="${SAJT}" style="display:inline-block;background:#0f172a;color:#ffffff;padding:12px 22px;border-radius:12px;font-weight:600;font-size:14px;text-decoration:none">Read the full brief</a>
  </td></tr>
</table>
<p style="max-width:600px;margin:16px auto 0;font-size:12px;line-height:1.6;color:#64748b;text-align:center">
  Daily AI news and tools for developers, every morning.<br>
  <a href="https://www.youtube.com/@ai-morning-brief" style="color:#64748b">YouTube</a> · <a href="https://www.instagram.com/ai.morning.brief/" style="color:#64748b">Instagram</a> · <a href="https://t.me/aimorningbrief" style="color:#64748b">Telegram</a><br>
  <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#64748b">Unsubscribe</a>
</p>
</td></tr></table></body></html>`;
}
