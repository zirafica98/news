// Prijava na email newsletter (Resend). Dvostruka potvrda:
//   POST {email}           — kontakt se upiše kao odjavljen i stigne mejl sa linkom za potvrdu,
//   GET ?potvrdi=<token>   — link iz mejla: kontakt postaje prijavljen i od sutra dobija jutarnje izdanje,
//   GET bez parametara     — {ukljuceno}: sajt prikazuje formu samo kad je newsletter podešen.
// Odjava ide preko Resend-ovog linka u dnu svakog newslettera.
//
// Potrebne promenljive u Vercel projektu:
//   RESEND_API_KEY     — ključ sa resend.com (Sending + Contacts)
//   RESEND_SEGMENT_ID  — ID segmenta „AI Morning Brief“ u Resend-u (Contacts → Segments)
//   CRON_SECRET        — već postoji; ovde služi i za potpis linka za potvrdu
//   NEWSLETTER_FROM    — nije obavezno; podrazumevano „AI Morning Brief <brief@aimorningbrief.dev>“

import { createHmac, timingSafeEqual } from 'node:crypto';

const RESEND = 'https://api.resend.com';
const POSILJALAC = process.env.NEWSLETTER_FROM || 'AI Morning Brief <brief@aimorningbrief.dev>';
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/i;

export async function POST(request) {
  const { RESEND_API_KEY: kljuc, RESEND_SEGMENT_ID: segment, CRON_SECRET: tajna } = process.env;
  if (!kljuc || !segment || !tajna) return json(503, { poruka: 'Newsletter još nije podešen' });

  let telo;
  try {
    telo = await request.json();
  } catch {
    return json(400, { poruka: 'Neispravan JSON' });
  }
  // Skriveno polje: popunjavaju ga samo botovi.
  if (telo?.web) return json(200, { poruka: 'ok' });
  const email = String(telo?.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email)) return json(400, { poruka: 'Neispravna email adresa' });

  // Kontakt se upisuje kao odjavljen dok ne potvrdi. Ako već postoji, ostaje kakav jeste.
  const novi = await resend(kljuc, 'POST', '/contacts', { email, unsubscribed: true, segments: [{ id: segment }] });
  if (!novi.ok && novi.status !== 409 && novi.status !== 422) {
    console.error(`Resend nije upisao kontakt: ${novi.status} ${await novi.text()}`);
    return json(502, { poruka: 'Prijava nije uspela' });
  }

  const link = `${new URL(request.url).origin}/api/newsletter?potvrdi=${potpisi(email, tajna)}`;
  const mejl = await resend(kljuc, 'POST', '/emails', {
    from: POSILJALAC,
    to: [email],
    subject: 'Confirm your AI Morning Brief subscription',
    html: potvrdaHtml(link),
    text: `Confirm your subscription to AI Morning Brief: ${link}\n\nIf you didn't sign up, just ignore this email.`,
  });
  if (!mejl.ok) {
    console.error(`Resend nije poslao potvrdu: ${mejl.status} ${await mejl.text()}`);
    return json(502, { poruka: 'Slanje potvrde nije uspelo' });
  }
  return json(200, { poruka: 'Potvrda poslata' });
}

export async function GET(request) {
  const { RESEND_API_KEY: kljuc, RESEND_SEGMENT_ID: segment, CRON_SECRET: tajna } = process.env;
  const token = new URL(request.url).searchParams.get('potvrdi');
  if (token === null) return json(200, { ukljuceno: Boolean(kljuc && segment && tajna) });
  if (!kljuc || !tajna || !token) return strana(400, 'Invalid link', 'This confirmation link is incomplete.');

  const email = proveri(token, tajna);
  if (!email) return strana(400, 'Invalid link', 'This confirmation link is not valid. Try signing up again.');

  const res = await resend(kljuc, 'PATCH', `/contacts/${encodeURIComponent(email)}`, { unsubscribed: false });
  if (!res.ok) {
    console.error(`Resend nije potvrdio kontakt: ${res.status} ${await res.text()}`);
    return strana(502, 'Something went wrong', 'We couldn’t confirm your subscription. Please try again in a few minutes.');
  }
  return strana(200, 'You’re in ☕', 'Your subscription is confirmed. The next AI Morning Brief lands in your inbox tomorrow morning.');
}

// ---------- pomoćne ----------

function resend(kljuc, metoda, putanja, telo) {
  return fetch(`${RESEND}${putanja}`, {
    method: metoda,
    headers: { Authorization: `Bearer ${kljuc}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(telo),
  });
}

/** Token za potvrdu: email (base64url) i HMAC potpis, da niko ne može da prijavi tuđu adresu bez mejla. */
function potpisi(email, tajna) {
  const deo = Buffer.from(email).toString('base64url');
  return `${deo}.${createHmac('sha256', tajna).update(`newsletter:${email}`).digest('base64url')}`;
}

function proveri(token, tajna) {
  const [deo, potpis] = token.split('.');
  if (!deo || !potpis) return null;
  const email = Buffer.from(deo, 'base64url').toString();
  const ocekivano = Buffer.from(potpisi(email, tajna).split('.')[1]);
  const dobijeno = Buffer.from(potpis);
  return ocekivano.length === dobijeno.length && timingSafeEqual(ocekivano, dobijeno) && EMAIL.test(email) ? email : null;
}

function json(status, telo) {
  return new Response(JSON.stringify(telo), { status, headers: { 'Content-Type': 'application/json' } });
}

function strana(status, naslov, tekst) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${naslov} · AI Morning Brief</title><meta name="robots" content="noindex"></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#020617;color:#e2e8f0;font-family:-apple-system,Helvetica,Arial,sans-serif">
<main style="max-width:420px;padding:32px;text-align:center"><p style="font-size:40px;margin:0">☕</p>
<h1 style="color:#fff;font-size:24px">${naslov}</h1><p style="line-height:1.6;color:#94a3b8">${tekst}</p>
<p><a href="/" style="display:inline-block;margin-top:12px;background:#fbbf24;color:#020617;padding:10px 20px;border-radius:12px;font-weight:600;text-decoration:none">Read today’s brief</a></p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

function potvrdaHtml(link) {
  return `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
<p style="font-size:32px;margin:0">☕</p>
<h1 style="font-size:20px">One click and you’re in</h1>
<p style="line-height:1.6">Confirm your email to get AI Morning Brief every morning: the AI news that matters, a new tool to try and why it matters, in five minutes.</p>
<p><a href="${link}" style="display:inline-block;background:#fbbf24;color:#020617;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none">Confirm subscription</a></p>
<p style="font-size:13px;color:#64748b;line-height:1.5">If you didn’t sign up, just ignore this email and you won’t hear from us.</p></div>`;
}
