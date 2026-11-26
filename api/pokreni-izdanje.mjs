// Vercel Cron zove ovu funkciju, a ona pokreće GitHub posao „Jutarnje izdanje“:
//   ujutru bez parametra (rezim normalno) — pravi izdanje,
//   popodne sa ?rezim=drustvene — objava na Instagram, Threads, YouTube i Telegram, kad je jutro u SAD,
//   ponedeljkom sa ?rezim=nedeljni — nedeljni izveštaj o formatima i pratiocima na Telegram,
//   petkom sa ?rezim=alati-nedelje — lista alata te nedelje na Telegram, za Dev's pick video,
//   svako jutro sa ?rezim=podsetnik — šta Mihajlo danas treba ručno da uradi (posao „Podsetnik i Dev's pick“),
//   svaki dan sa ?rezim=devs-pick (radi samo kad tog dana izlazi epizoda) — kad Dev's pick video izađe, Instagram objava i X tekst na Telegram (isti posao).
// GitHub-ovi zakazani poslovi za ovaj repo kasne satima ili se ne pokrenu, pa je okidač ovde.
//
// Potrebne promenljive u Vercel projektu (Settings → Environment Variables):
//   CRON_SECRET            — proizvoljan tajni niz; Vercel ga šalje uz svaki cron poziv
//   GITHUB_DISPATCH_TOKEN  — GitHub fine-grained token za zirafica98/news sa dozvolom Actions: Read and write

const REPO = 'zirafica98/news';
const WORKFLOW = 'jutro.yml';
const DOZVOLJENI_REZIMI = ['normalno', 'drustvene', 'nedeljni', 'alati-nedelje', 'podsetnik', 'devs-pick'];
// Ovi režimi idu u poseban, mali posao, da ne čekaju u redu iza jutarnjeg izdanja.
const POSEBAN_POSAO = { podsetnik: 'podsetnik.yml', 'devs-pick': 'podsetnik.yml' };

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
  const rezim = new URL(request.url).searchParams.get('rezim') || 'normalno';
  if (!DOZVOLJENI_REZIMI.includes(rezim)) {
    return new Response(`Nepoznat režim: ${rezim}`, { status: 400 });
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${POSEBAN_POSAO[rezim] ?? WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'ai-news-cron',
    },
    body: JSON.stringify({ ref: 'main', inputs: { rezim } }),
  });

  if (res.status !== 204) {
    const detalji = await res.text();
    console.error(`GitHub je odbio pokretanje: HTTP ${res.status} ${detalji}`);
    return new Response(`GitHub je odbio pokretanje (HTTP ${res.status})`, { status: 502 });
  }

  console.log(`Posao ${POSEBAN_POSAO[rezim] ?? WORKFLOW} pokrenut na GitHub-u (režim ${rezim}).`);
  return new Response('Pokrenuto', { status: 200 });
}
