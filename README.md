# AI News ☕

Lični sajt koji svako jutro ima pregled AI vesti na srpskom: vesti, novo izašle stvari sa „kako probati“, istraživanje dana, top 5 ideja za app i cene tokena.

Live: https://news-one-teal.vercel.app

Detaljan plan i spisak izvora: [PLAN.md](PLAN.md).

## Kako radi

```
06:30 (Beograd)  GitHub Actions → .github/workflows/jutro.yml → scripts/jutro.sh
         1. fetch-news.mjs       skupi vesti iz scripts/sources.json
            fetch-prices.mjs     cene tokena sa OpenRouter-a (modeli u scripts/cene-modeli.json)
         2. write-digest.mjs     Claude Code (claude -p, preko Claude pretplate) napiše izdanje
         3. finalize.mjs         provera → public/data/YYYY-MM-DD.json + index.json
            translate-digest.mjs engleski prevod → public/data/en/ (ako ne uspe, srpsko ide svejedno)
         4. git push             → Vercel build
       rezerva u 09:30 i 12:30 ako GitHub zakasni ili nešto pukne
```

Claude se prijavljuje tokenom iz tajne `CLAUDE_CODE_OAUTH_TOKEN` (pravi se komandom `claude setup-token`), pa nema plaćanja po API pozivu.
Ručno pokretanje: GitHub → Actions → **Jutarnje izdanje** → Run workflow (normalno / ponovo / provera).

Ranije je posao radio launchd na Mac-u, ali MacBook sa zatvorenim poklopcem macOS uspava posle par sekundi buđenja, pa izdanja nisu stizala na vreme.

## Komande

| Komanda | Šta radi |
|---|---|
| `npm start` | sajt lokalno |
| `npm run fetch` | skupi današnje vesti (`-- --hours=72` za duži period) |
| `npm run prices` | osveži cene tokena |
| `npm run digest` | Claude napiše nacrt izdanja |
| `npm run translate` | engleski prevod objavljenog izdanja |
| `npm run finalize` | proveri i objavi nacrt (`-- --provera` samo proverava) |
| `bash scripts/instaliraj.sh --ukloni` | ugasi stari jutarnji posao na Mac-u |
| `bash scripts/jutro.sh --provera` | test automatike bez objavljivanja (lokalno) |

## Kad nešto ne radi

- **Log jutra:** GitHub → Actions → Jutarnje izdanje → poslednje pokretanje
- **Izvor ne radi:** u `scripts/sources.json` postavi `"enabled": false`
- **Promena izgleda izdanja:** `scripts/prompt.md` (šta Claude piše) i `scripts/digest-schema.json` (oblik podataka, prati ga `src/app/izdanje.model.ts`)
- **Posle promene skripti:** push na GitHub je dovoljan, jutarnja skripta sama povuče najnoviju verziju
