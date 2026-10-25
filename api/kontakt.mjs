// Prima upit sa stranice /engine (AI Content Engine) i šalje ga vlasniku na Telegram, preko istog bota kao izveštaji.
//
// Potrebne promenljive u Vercel projektu (Settings → Environment Variables):
//   TELEGRAM_BOT_TOKEN      — token bota od @BotFather
//   TELEGRAM_ADMIN_CHAT_ID  — privatni chat vlasnika sa botom

const MAX = { ime: 100, mejl: 200, brend: 200, nisa: 200, poruka: 2000 };

export async function POST(request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const admin = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !admin) return odgovor(503, 'Kontakt forma još nije podešena');

  let u;
  try {
    u = await request.json();
  } catch {
    return odgovor(400, 'Neispravan JSON');
  }
  // Skriveno polje „sajt“ popunjavaju samo botovi: tiho prihvatamo, ali ništa ne šaljemo.
  if (u?.sajt) return odgovor(200, 'OK');
  const polja = Object.fromEntries(Object.entries(MAX).map(([k, max]) => [k, String(u?.[k] ?? '').trim().slice(0, max)]));
  if (!polja.ime || !/^\S+@\S+\.\S+$/.test(polja.mejl)) return odgovor(400, 'Nedostaje ime ili mejl');

  const tekst = [
    '📩 Novi upit · AI Content Engine',
    '',
    `Ime: ${polja.ime}`,
    `Mejl: ${polja.mejl}`,
    polja.brend && `Brend: ${polja.brend}`,
    polja.nisa && `Oblast: ${polja.nisa}`,
    polja.poruka && `\n${polja.poruka}`,
    `\nJezik stranice: ${u?.jezik === 'sr' ? 'srpski' : 'engleski'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: admin, text: tekst, disable_web_page_preview: true }),
  });
  if (!res.ok) {
    console.error(`Telegram je odbio poruku: HTTP ${res.status} ${await res.text()}`);
    return odgovor(502, 'Slanje nije uspelo');
  }
  return odgovor(200, 'OK');
}

function odgovor(status, poruka) {
  return new Response(JSON.stringify({ poruka }), { status, headers: { 'Content-Type': 'application/json' } });
}
