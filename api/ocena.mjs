// Prima ocenu (palac gore/dole) sa sajta i dopisuje je u repo (scripts/state/ocene.json).
// Jutarnji posao je čita, pa Claude zna šta čitaocu jeste ili nije korisno.
//
// Potrebna promenljiva: GITHUB_DISPATCH_TOKEN sa dozvolom Contents: Read and write za zirafica98/news.

const REPO = 'zirafica98/news';
const PUTANJA = 'scripts/state/ocene.json';
const MAX_OCENA = 300;
const TIPOVI = ['vest', 'ideja', 'novo', 'istrazivanje', 'tema'];

export async function POST(request) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) return odgovor(500, 'Nedostaje GITHUB_DISPATCH_TOKEN');

  let ocena;
  try {
    ocena = await request.json();
  } catch {
    return odgovor(400, 'Neispravan JSON');
  }
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(ocena?.datum ?? '') ||
    !TIPOVI.includes(ocena?.tip) ||
    ![1, -1].includes(ocena?.ocena) ||
    typeof ocena?.naslov !== 'string' ||
    ocena.naslov.length > 300
  ) {
    return odgovor(400, 'Neispravna ocena');
  }

  const nova = { datum: ocena.datum, tip: ocena.tip, naslov: ocena.naslov.slice(0, 300), ocena: ocena.ocena, vreme: new Date().toISOString() };

  // Kratke uzastopne ocene mogu da se preklope, pa upis pokušavamo nekoliko puta.
  for (let pokusaj = 0; pokusaj < 3; pokusaj++) {
    const { sadrzaj, sha } = await procitaj(token);
    const bez = sadrzaj.filter((o) => !(o.datum === nova.datum && o.tip === nova.tip && o.naslov === nova.naslov));
    const sve = [...bez, nova].slice(-MAX_OCENA);
    const res = await githubFetch(`https://api.github.com/repos/${REPO}/contents/${PUTANJA}`, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: `Ocena: ${nova.ocena > 0 ? '👍' : '👎'} ${nova.naslov.slice(0, 60)}`,
        content: Buffer.from(`${JSON.stringify(sve, null, 2)}\n`).toString('base64'),
        ...(sha && { sha }),
      }),
    });
    if (res.ok) return odgovor(200, 'Ocena sačuvana');
    if (res.status !== 409) {
      console.error(`GitHub nije sačuvao ocenu: HTTP ${res.status} ${await res.text()}`);
      return odgovor(502, 'Čuvanje nije uspelo');
    }
  }
  return odgovor(503, 'Pokušaj ponovo');
}

// ---------------------------------------------------------------------------

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
