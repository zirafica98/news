# AI News — plan

Lični sajt koji svako jutro u 7:00 ima pregled AI vesti na srpskom: šta se desilo, šta je novo izašlo i kako da probam, i top 5 ideja za nove app-ove.

Samo za mene: sajt na Vercel-u sa `noindex`, bez prijave. GitHub repo `zirafica98/news` je trenutno javan.

## Kako radi

Sve se dešava lokalno na Mac-u. Nema plaćenih API poziva jer Claude Code koristi postojeću pretplatu.

```
06:25  Mac se sam probudi (na punjaču, može zatvoren poklopac, samo da nije ugašen)
06:30  launchd pokrene scripts/jutro.sh
  1. git pull
  2. npm run fetch   → fetch-news.mjs skupi vesti iz poslednjih 24h (RSS/JSON, bez AI-ja)
  3. claude -p       → Claude Code pročita vesti i napiše public/data/YYYY-MM-DD.json na srpskom
  4. node finalize.mjs  → proveri JSON; ako je pokvaren, NE šalje na git
  5. git commit + push
  6. macOS notifikacija „AI News je spreman ☕“
~06:45  Vercel uradi build i sajt je ažuriran
```

## Struktura

```
ai-jutro/
├── src/                      Angular 22 + Tailwind
├── public/data/
│   ├── index.json            spisak datuma
│   └── YYYY-MM-DD.json       jedno izdanje
└── scripts/
    ├── jutro.sh              glavna skripta (sa caffeinate da Mac ne zaspi usred rada)
    ├── fetch-news.mjs
    ├── sources.json
    ├── prompt.md             uputstvo za Claude-a
    ├── finalize.mjs
    └── logs/
```

Razvoj ide u `/Volumes/Extreme Pro/Projects/News`. Jutarnja skripta radi iz male kopije repoa na internom disku (bez node_modules), jer se spoljni disk zna sam otkačiti.

## Jedno izdanje

1. **Ukratko:** dan u 3 rečenice
2. **Top vesti (5–10):** naslov, šta se desilo, zašto je bitno, izvor + link
3. **Novo izašlo:** modeli, alati, projekti sa GitHub kodom, svaki sa koracima „Kako probati“
4. **Istraživanje dana:** 2–3 najzanimljivija rada sa HF Daily Papers, objašnjena jednostavno
5. **Top 5 ideja za app:** naziv, problem, za koga, uloga AI-ja, težina 1–5, da li može za vikend

Vesti se prepričavaju svojim rečima, uvek sa linkom ka originalu.

## Izvori (provereno 13.09.2026)

### Dnevni pregledi (neko je već uradio filtriranje)
| Izvor | Adresa | Napomena |
|---|---|---|
| AINews (smol.ai) | https://news.smol.ai/rss.xml | dnevni pregled AI Twitter/Reddit/Discord |
| The Rundown AI | https://rss.beehiiv.com/feeds/2R3C6Bt5wj.xml | dnevni newsletter |
| TLDR AI | https://tldr.tech/api/rss/ai | dnevni newsletter |
| Ben's Bites | https://www.bensbites.com/feed | alati i proizvodi |

### Istraživanje i novi projekti
| Izvor | Adresa | Napomena |
|---|---|---|
| Hugging Face Daily Papers ⭐ | https://huggingface.co/api/daily_papers | JSON, ~50 radova dnevno |
| Import AI (Jack Clark) | https://importai.substack.com/feed | nedeljno |
| The Batch (DeepLearning.AI) | https://www.deeplearning.ai/the-batch/ | nema RSS, Claude čita stranicu |
| Latent Space | https://www.latent.space/feed | za AI inženjere |
| Simon Willison | https://simonwillison.net/atom/everything/ | praktično isprobavanje alata |

### Mediji
| Izvor | Adresa |
|---|---|
| The Verge AI | https://www.theverge.com/rss/ai-artificial-intelligence/index.xml |
| MIT Technology Review AI | https://www.technologyreview.com/topic/artificial-intelligence/feed |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ |
| Last Week in AI | https://lastweekin.ai/feed |

### Zvanični blogovi
| Izvor | Adresa |
|---|---|
| OpenAI | https://openai.com/news/rss.xml |
| Google DeepMind | https://deepmind.google/blog/rss.xml |
| Hugging Face blog | https://huggingface.co/blog/feed.xml |
| Anthropic | https://www.anthropic.com/news (nema RSS, Claude čita stranicu) |

### Zajednica
| Izvor | Adresa |
|---|---|
| Hacker News (AI, 100+ poena) | https://hnrss.org/newest?q=AI+OR+LLM&points=100 |

## Faze

| Faza | Šta | Stanje (13.09.2026) |
|---|---|---|
| 0. Postavka | Angular projekat, GitHub repo `zirafica98/news`, noindex | ✅ (Vercel povezuje Mihajlo) |
| 1. Skupljanje | fetch-news.mjs + sources.json | ✅ |
| 2. Izdanje | prompt.md + `claude -p` + finalize.mjs, pamćenje objavljenih linkova | ✅ prvo izdanje 13.09. |
| 3. Ekrani | Danas, Arhiva, Sačuvano (localStorage) | ✅ |
| 4. Automatika | jutro.sh + launchd 06:30 (rezerva 09:00, 12:00), notifikacija | ✅ instalirano; buđenje u 06:25 podešava Mihajlo |
| 5. Dodaci | ikonica na iPhone početnom ekranu | ✅ |
| Kasnije | nedeljni pregled, ocenjivanje ideja | — |

## Na šta paziti
- Mac treba da bude **na punjaču i uspavan, ne ugašen**. Ako je bio ugašen, skripta pokušava ponovo u 09:00 i 12:00.
- Buđenje u 06:25 podešava se jednom komandom sa lozinkom (pokreće Mihajlo):
  `sudo pmset repeat wake MTWRFSU 06:25:00`
- Svako jutro troši deo limita Claude pretplate.
