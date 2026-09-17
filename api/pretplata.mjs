// Prima pretplatu na push notifikacije sa telefona i čuva je u repou (scripts/state/pretplate.json),
// odakle je jutarnji posao na GitHub-u koristi da pošalje notifikaciju.
//
// Potrebna promenljiva: GITHUB_DISPATCH_TOKEN sa dozvolom Contents: Read and write za zirafica98/news.

const REPO = 'zirafica98/news';
const PUTANJA = 'scripts/state/pretplate.json';
const MAX_PRETPLATA = 20;

/** Javni VAPID ključ treba pregledaču da bi se pretplatio; nije tajna. */
export async function GET() {
  const javniKljuc = process.env.VAPID_PUBLIC_KEY;
  if (!javniKljuc) return odgovor(503, 'Notifikacije još nisu podešene');
  return new Response(JSON.stringify({ javniKljuc }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(request) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return odgovor(500, 'Nedostaje GITHUB_DISPATCH_TOKEN');

  let pretplata;
  try {
    pretplata = await request.json();
  } catch {
    return odgovor(400, 'Neispravan JSON');
  }
  if (!validna(pretplata)) return odgovor(400, 'Neispravna pretplata');

  const postojeci = await procitaj(token);
  const ostale = postojeci.sadrzaj.filter((p) => p.endpoint !== pretplata.endpoint);
  const sve = [...ostale, { endpoint: pretplata.endpoint, keys: pretplata.keys, dodato: new Date().toISOString() }].slice(-MAX_PRETPLATA);

  const res = await githubFetch(`https://api.github.com/repos/${REPO}/contents/${PUTANJA}`, token, {
    method: 'PUT',
    body: JSON.stringify({
      message: 'Pretplata na notifikacije',
      content: Buffer.from(`${JSON.stringify(sve, null, 2)}\n`).toString('base64'),
      ...(postojeci.sha && { sha: postojeci.sha }),
    }),
  });
  if (!res.ok) {
    console.error(`GitHub nije sačuvao pretplatu: HTTP ${res.status} ${await res.text()}`);
    return odgovor(502, 'Čuvanje nije uspelo');
  }
  return odgovor(200, 'Pretplata sačuvana');
}

// ---------------------------------------------------------------------------

/** Pretplata mora da ima endpoint kod pravog push servisa i ključeve, da se endpoint ne bi zloupotrebio. */
function validna(p) {
  if (!p?.endpoint || typeof p.endpoint !== 'string' || !p.keys?.p256dh || !p.keys?.auth) return false;
  try {
    const { protocol, hostname } = new URL(p.endpoint);
    return protocol === 'https:' && /(^|\.)(push\.apple\.com|googleapis\.com|mozilla\.com|windows\.com)$/.test(hostname);
  } catch {
    return false;
  }
}

async function procitaj(token) {
  const res = await githubFetch(`https://api.github.com/repos/${REPO}/contents/${PUTANJA}`, token);
  if (res.status === 404) return { sadrzaj: [], sha: null };
  if (!res.ok) throw new Error(`GitHub HTTP ${res.status}`);
  const podaci = await res.json();
  try {
    return { sadrzaj: JSON.parse(Buffer.from(podaci.content, 'base64').toString('utf8')), sha: podaci.sha };
  } catch {
    return { sadrzaj: [], sha: podaci.sha };
  }
}

function githubFetch(url, token, opcije = {}) {
  return fetch(url, {
    ...opcije,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-news',
    },
  });
}

function odgovor(status, poruka) {
  return new Response(JSON.stringify({ poruka }), { status, headers: { 'Content-Type': 'application/json' } });
}
