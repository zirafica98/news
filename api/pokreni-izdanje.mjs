// Vercel Cron svako jutro zove ovu funkciju, a ona pokreće GitHub posao „Jutarnje izdanje“.
// GitHub-ovi zakazani poslovi za ovaj repo kasne satima ili se ne pokrenu, pa je okidač ovde.
//
// Potrebne promenljive u Vercel projektu (Settings → Environment Variables):
//   CRON_SECRET            — proizvoljan tajni niz; Vercel ga šalje uz svaki cron poziv
//   GITHUB_DISPATCH_TOKEN  — GitHub fine-grained token za zirafica98/news sa dozvolom Actions: Read and write

const REPO = 'zirafica98/news';
const WORKFLOW = 'jutro.yml';

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Neovlašćen pristup', { status: 401 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  if (!token) {
    return new Response('Nedostaje GITHUB_DISPATCH_TOKEN', { status: 500 });
  }

  // „normalno“: posao ništa ne radi ako je današnje izdanje već objavljeno.
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-news-cron',
    },
    body: JSON.stringify({ ref: 'main', inputs: { rezim: 'normalno' } }),
  });

  if (res.status !== 204) {
    const detalji = await res.text();
    console.error(`GitHub je odbio pokretanje: HTTP ${res.status} ${detalji}`);
    return new Response(`GitHub je odbio pokretanje (HTTP ${res.status})`, { status: 502 });
  }

  console.log('Jutarnje izdanje pokrenuto na GitHub-u.');
  return new Response('Pokrenuto', { status: 200 });
}
