# n8n workflows for AI Morning Brief

A visual layer on top of the existing automation (GitHub Actions + Vercel cron). They do not replace it:
the daily jobs keep running even when n8n is off.

| Workflow | What it does |
|---|---|
| `pipeline-status.json` | Reads the latest GitHub Actions runs (read-only) and shows the status of every stage: news, Claude edition, translation, images and voiced Shorts, website, push, Instagram, Threads, YouTube, Telegram. Runs every 30 minutes or on demand. |
| `telegram-message.json` | A form to send a message as the bot: to yourself (test), to the AI Morning Brief channel, or to any group or channel where the bot is an admin. Optional image, silent sending and pinning. Needs a **Telegram** credential with the bot token. |
| `run-actions.json` | A form to start a job by hand (health check, social posting, rebuild, push, YouTube or Instagram only). It dispatches the same `jutro.yml` workflow. |

## Run n8n locally (free)

```bash
docker run -d --name n8n -p 127.0.0.1:5678:5678 -v n8n_data:/home/node/.n8n \
  -e GENERIC_TIMEZONE=Europe/Belgrade -e TZ=Europe/Belgrade --restart unless-stopped docker.n8n.io/n8nio/n8n:latest
docker cp pipeline-status.json n8n:/tmp/ && docker exec n8n n8n import:workflow --input=/tmp/pipeline-status.json
docker cp run-actions.json n8n:/tmp/ && docker exec n8n n8n import:workflow --input=/tmp/run-actions.json
```

Then open http://localhost:5678 and add a **Header Auth** credential named `GitHub token (AI Morning Brief)`:
name `Authorization`, value `Bearer <fine-grained token for zirafica98/news with Actions: Read and write>`.
