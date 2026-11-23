// Svako jutro Mihajlu na Telegram: gde danas da ostavi komentar sa naloga AI Morning Brief i šta da napiše.
// Novi nalozi najviše rastu od pametnih komentara kod većih kanala iz iste niše (ljudi kliknu na ime koje kaže nešto korisno).
//
//   YouTube: sveži videi (poslednjih ~36h, bez Shortova) sa većih AI/dev kanala, preko javnog RSS-a (bez API kvote).
//            Claude bira 3 gde komentar može da doda nešto korisno i piše ga.
//   Instagram/Threads: tema dana (vest #1 iz današnjeg izdanja) i komentar za objave drugih naloga o njoj.
//            Meta API sa našom vrstom prijave ne daje tuđe objave, pa se ide preko teme koju će veliki nalozi sigurno pokriti.
//
// Komentari su na engleskom, bez linkova i bez reklame. Claude ne sme da izmišlja šta se kaže u videu: oslanja se samo
// na naslov, opis i ono što znamo iz izdanja.
//
// Tajne: CLAUDE_CODE_OAUTH_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID.
// Pokretanje: node scripts/komentari.mjs [--datum=YYYY-MM-DD] [--bez-slanja]

import { join } from 'node:path';
import { pitajClaude } from './claude.mjs';
import { telegram } from './devs-pick.mjs';
import { DATA_DIR, datumIzArgumenata, preuzmi, readJson } from './lib.mjs';

// Veći AI i dev kanali (10K–1M pratilaca) koji redovno objavljuju. ID je stalan, ime kanala se menja.
const KANALI = [
  'UCsBjURrPoezykLs9EqgamOA', // Fireship
  'UCawZsQWqfGSbCI5yjkdVkTA', // Matthew Berman
  'UCNJ1Ymd5yFuUPtn21xtRbbw', // AI Explained
  'UCbfYPyITQ-7l4upoX8nvctg', // Two Minute Papers
  'UCqcbQf6yw5KzRoDDcZ_wBSw', // Wes Roth
  'UChpleBmo18P08aKCIgti38g', // Matt Wolfe
  'UCHhYXsLBEVVnbvsq57n1MTQ', // The AI Advantage
  'UCMwVTLZIRRUyyVrkjDpn4pA', // Cole Medin
  'UC55ODQSvARtgSyc8ThfiepQ', // Sam Witteveen
  'UCDq7SjbgRKty5TgGafW8Clg', // Prompt Engineering
  'UC_x36zCEGilGpB1m-V4gmjg', // IndyDevDan
  'UC2WmuBuFq6gL08QYG-JjXKw', // WorldofAI
  'UCR9j1jqqB5Rse69wjUnbYwA', // All About AI
  'UCuE6iwZKgGz8s6kznBRI9LQ', // Developers Digest
  'UC0m81bQuthaQZmFbXEY9QSw', // AICodeKing
  'UCPGrgwfbkjTIgPoOh2q1BAg', // David Ondrej
  'UCMcoud_ZW7cfxeIugBflSBw', // Riley Brown
  'UCPjNBjflYl0-HQtUvOx0Ibw', // Greg Isenberg
  'UCUyeluBRhGPCW4rPe_UvBZQ', // The PrimeTime
];

const datum = datumIzArgumenata();
const bezSlanja = process.argv.includes('--bez-slanja');
const odXml = (t) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const polje = (xml, tag) => odXml(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? '').trim();

/** Videi sa kanala objavljeni u poslednjih `sati` sati, bez Shortova. */
async function sveziVidei(kanal, sati = 36) {
  const odgovor = await preuzmi(`https://www.youtube.com/feeds/videos.xml?channel_id=${kanal}`).catch(() => null);
  if (!odgovor?.ok) return [];
  const granica = Date.now() - sati * 3_600_000;
  return odgovor.tekst
    .split('<entry>')
    .slice(1)
    .map((e) => ({
      id: polje(e, 'yt:videoId'),
      kanal: polje(e, 'name'),
      naslov: polje(e, 'title'),
      link: e.match(/<link rel="alternate" href="([^"]+)"/)?.[1] ?? '',
      objavljeno: polje(e, 'published'),
      pregledi: Number(e.match(/views="(\d+)"/)?.[1] ?? 0),
      // Opis bez linkova i reklama, samo da Claude razume temu.
      opis: polje(e, 'media:description').replace(/https?:\/\/\S+/g, '').replace(/\n{2,}/g, '\n').slice(0, 600),
    }))
    .filter((v) => v.id && !v.link.includes('/shorts/') && Date.parse(v.objavljeno) >= granica);
}

const svi = (await Promise.all(KANALI.map((k) => sveziVidei(k)))).flat().sort((a, b) => b.pregledi - a.pregledi).slice(0, 20);
const izdanje = await readJson(join(DATA_DIR, 'en', `${datum}.json`), null);
const vesti = (izdanje?.vesti ?? []).slice(0, 3).map((v, i) => `${i + 1}. ${v.naslov}\n${v.staSeDesilo ?? ''}`).join('\n\n');

if (!svi.length && !vesti) {
  console.log('Nema svežih videa ni današnjeg izdanja, predlozi se preskaču.');
  process.exit(0);
}

const prompt = `You help "AI Morning Brief" (@ai.morning.brief on Instagram, "AI Morning Brief" on YouTube), a small, new account with daily AI news and one new AI tool a day, for developers. It grows by leaving genuinely useful comments under bigger creators' content, so people click the account name.

Today's date: ${datum}.

Fresh YouTube videos from bigger AI/dev channels (title, channel, views, description excerpt):
${svi.map((v, i) => `[${i}] "${v.naslov}" · ${v.kanal} · ${v.pregledi} views\n${v.opis}`).join('\n\n') || '(none)'}

Today's top AI stories from our own brief (facts we know):
${vesti || '(none)'}

Tasks:
1. Pick up to 3 videos where a comment from us can add real value (a relevant fact from our stories, a practical tip for developers, or a sharp question). Prefer videos with more views that are less than a day old, and different channels.
2. For each, write one comment in English: 1–3 short sentences, specific to the video's topic, sounds like a knowledgeable developer, friendly. It should add something (a fact, a nuance, a tip, or a real question that invites replies).
   Rules: NO links, NO mention of our account or "check out", NO hashtags, NO generic praise like "Great video!", at most one emoji. Do NOT claim anything about what is said inside the video beyond the title and description; you haven't watched it. Only use facts that are in the title, description or our stories.
3. For Instagram/Threads: big AI accounts will post about today's #1 story. Write one comment we can leave under such posts, same rules.
4. For each pick, give a one-line reason in Serbian (Latin script) why this one is worth it.`;

const schema = JSON.stringify({
  type: 'object',
  properties: {
    youtube: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: { indeks: { type: 'integer' }, komentar: { type: 'string' }, zasto: { type: 'string' } },
        required: ['indeks', 'komentar', 'zasto'],
      },
    },
    instagram: {
      type: 'object',
      properties: { tema: { type: 'string', description: 'The #1 story in a few words, in Serbian (Latin)' }, komentar: { type: 'string' } },
      required: ['tema', 'komentar'],
    },
  },
  required: ['youtube', 'instagram'],
});

const odgovor = await pitajClaude(prompt, { schema, model: process.env.KOMENTARI_MODEL || 'sonnet' });
const r = odgovor.structured_output;
if (odgovor.is_error || !r) throw new Error(`Claude nije vratio predloge: ${odgovor.subtype ?? ''} ${odgovor.result ?? ''}`.trim());

const yt = r.youtube.filter((p) => svi[p.indeks]);
const poruka = [
  '💬 Komentari za danas (10 minuta, pa ti se vraća u pratiocima)',
  '',
  ...(yt.length
    ? [
        '▶️ YouTube: komentariši kao kanal AI Morning Brief (u YouTube aplikaciji gore desno prebaci nalog na kanal).',
        '',
        ...yt.flatMap((p, i) => {
          const v = svi[p.indeks];
          return [`${i + 1}. ${v.kanal}: „${v.naslov}“`, v.link, `💡 ${p.zasto}`, '', p.komentar, ''];
        }),
      ]
    : ['▶️ Danas nema svežih videa na praćenim kanalima.', '']),
  `📸 Instagram/Threads: kad naiđeš na objavu o temi „${r.instagram.tema}“ kod većeg AI naloga, ostavi (sa @ai.morning.brief):`,
  '',
  r.instagram.komentar,
  '',
  '👉 Prilagodi komentar sopstvenim rečima ako hoćeš, i odgovori ako ti neko odgovori. Razgovor ispod tuđeg videa donosi najviše klikova na profil.',
]
  .join('\n')
  .trim();

console.log(poruka);
if (!bezSlanja) {
  await telegram(poruka);
  console.log('Predlozi komentara poslati.');
}
