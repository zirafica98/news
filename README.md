# AI Jutro ☕

Lični sajt koji svako jutro ima pregled AI vesti na srpskom: vesti, novo izašle stvari sa „kako probati“, istraživanje dana, top 5 ideja za app i cene tokena.

Live: https://news-one-teal.vercel.app

Detaljan plan i spisak izvora: [PLAN.md](PLAN.md).

## Kako radi

```
06:30  launchd na Mac-u → scripts/jutro.sh (iz kopije repoa u ~/.ai-jutro/repo)
         1. git pull
         2. fetch-news.mjs   skupi vesti iz scripts/sources.json
            fetch-prices.mjs cene tokena sa OpenRouter-a (modeli u scripts/cene-modeli.json)
         3. write-digest.mjs Claude Code (claude -p, pretplata) napiše izdanje
         4. finalize.mjs     provera → public/data/YYYY-MM-DD.json + index.json
            translate-digest.mjs engleski prevod → public/data/en/ (ako ne uspe, srpsko ide svejedno)
         5. git push         → Vercel build
       rezerva u 09:00 i 12:00 ako je Mac bio ugašen ili nešto puklo
```

## Komande

| Komanda | Šta radi |
|---|---|
| `npm start` | sajt lokalno |
| `npm run fetch` | skupi današnje vesti (`-- --hours=72` za duži period) |
| `npm run prices` | osveži cene tokena |
| `npm run digest` | Claude napiše nacrt izdanja |
| `npm run translate` | engleski prevod objavljenog izdanja |
| `npm run finalize` | proveri i objavi nacrt (`-- --provera` samo proverava) |
| `bash scripts/instaliraj.sh` | podesi ili osveži jutarnju automatiku (`--ukloni` je gasi) |
| `bash ~/.ai-jutro/repo/scripts/jutro.sh --provera` | test automatike bez objavljivanja |

## Kad nešto ne radi

- **Log jutra:** `~/.ai-jutro/repo/scripts/logs/YYYY-MM-DD.log`
- **Izvor ne radi:** u `scripts/sources.json` postavi `"enabled": false`
- **Promena izgleda izdanja:** `scripts/prompt.md` (šta Claude piše) i `scripts/digest-schema.json` (oblik podataka, prati ga `src/app/izdanje.model.ts`)
- **Posle promene skripti:** push na GitHub je dovoljan, jutarnja skripta sama povuče najnoviju verziju
