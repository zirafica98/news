// Provera podešavanja jutarnjeg okidača, bez pokretanja posla.
// Vraća samo da/ne za svaku stavku, bez tajni.
//
// Dozvolu za pokretanje posla proverava zahtevom za granu koja ne postoji:
// token sa dozvolom Actions: Read and write dobija 422 (nema te grane), a bez nje 403.

const REPO = 'zirafica98/news';

export async function GET() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const rezultat = {
    cronSecret: Boolean(process.env.CRON_SECRET),
    vapidJavni: Boolean(process.env.VAPID_PUBLIC_KEY),
    token: Boolean(token),
    tokenMozeDaPokrene: null,
    tokenMozeDaUpisuje: null,
  };

  if (token) {
    const zaglavlja = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-news-status',
    };
    const pokretanje = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/jutro.yml/dispatches`, {
      method: 'POST',
      headers: zaglavlja,
      body: JSON.stringify({ ref: 'grana-koja-ne-postoji-provera' }),
    });
    rezultat.tokenMozeDaPokrene = pokretanje.status === 422;
    rezultat.pokretanjeHttp = pokretanje.status;
    // GitHub-ova poruka i dozvola koju traži (bez tajni), da se vidi zašto je odbijeno.
    rezultat.githubPoruka = (await pokretanje.json().catch(() => ({})))?.message ?? null;
    rezultat.potrebnaDozvola = pokretanje.headers.get('x-accepted-github-permissions');

    const korisnik = await fetch('https://api.github.com/user', { headers: zaglavlja });
    rezultat.tokenPripada = korisnik.ok ? (await korisnik.json()).login : `HTTP ${korisnik.status}`;
    rezultat.tokenIstice = korisnik.headers.get('github-authentication-token-expiration');

    const citanje = await fetch(`https://api.github.com/repos/${REPO}/contents/scripts/state/pretplate.json`, { headers: zaglavlja });
    rezultat.tokenMozeDaUpisuje = citanje.ok ? 'citanje radi (upis se proverava pretplatom)' : false;
  }

  return new Response(JSON.stringify(rezultat, null, 2), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
