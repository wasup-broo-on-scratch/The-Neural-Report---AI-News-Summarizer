# The Neural Report

The Neural Report gathers current AI coverage from external publisher RSS feeds and query-based Google News RSS results. Its Home view groups live stories by reporting desk; it links each story to its source and does not host a news archive or fabricate articles. Ollama is an optional, separate service used only when a reader requests an AI-generated brief.

## Local setup

Requirements: Node.js 20 or newer, Python 3.10 or newer, and npm. Ollama is optional for browsing.

```sh
npm install
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. `npm run dev` starts three services: Vite on port 5173, the Express RSS/search API on port 8787, and the Flask AI service on port 8788. Express proxies AI requests to Flask; Flask calls Ollama at `OLLAMA_URL`. News browsing works without Ollama, but summaries and chat require Ollama and the configured model to be available. The initial feed loads from configured publisher RSS feeds; searches also query Google News RSS. Feed results are cached in memory for five minutes. If some feeds fail, working sources still appear and the page reports source errors; there are no sample-story fallbacks.

## News sources

Default RSS sources are The Verge AI, MIT Technology Review AI, NVIDIA Blog, Hugging Face, and Google DeepMind. Feed availability and formats are controlled by their publishers and can change. Add or replace feeds using `NEWS_FEEDS` in `.env`:

```env
NEWS_FEEDS=Publisher One|https://publisher.example/feed.xml,Publisher Two|https://publisher.example/rss
```

The query provider is Google News RSS and requires no API key. RSS items are normalized, categorized, deduplicated, and linked to their reported publisher/article URL. The service fetches feed metadata only; it does not scrape or reproduce article bodies. In-memory RSS and search caches expire after five minutes.

## AI summaries and chat

The Flask service handles AI readiness, single-article briefs, feed summaries, and chat grounded in the currently retrieved articles. It cites only publisher URLs from that feed. Ollama is a separate runtime; install and run it where Flask can reach it, then pull a supported model explicitly. The app never downloads a model automatically.

```sh
ollama serve
ollama pull qwen3:30b
```

Set `AI_SERVICE_URL`, `OLLAMA_URL`, and `OLLAMA_MODEL` in `.env`. Suggested quality models are `qwen3:30b` (default) and `llama3.3:70b`; `gemma3:12b` is the lower-resource option. Strong, fast inference requires a GPU-backed Ollama host with enough VRAM for the chosen model; this Codespace has no GPU and cannot serve 30B/70B models quickly. Point `OLLAMA_URL` to that host from Flask. `OLLAMA_KEEP_ALIVE=30m` avoids repeated cold starts, while `OLLAMA_NUM_CTX` and `OLLAMA_NUM_PREDICT` bound context and response length. Open a story and choose **Generate AI brief**, choose **Summarize Articles With AI**, or use **Ask AI** in the header to chat about the loaded news. Chat answers are constrained to retrieved headlines and publisher excerpts; article links are attached from trusted feed metadata. Responses are labeled AI-generated. Summary caches expire after 24 hours. If Ollama is offline or the model is missing, the readiness indicator and AI controls report that; news browsing still works.

## Deployment

### Cloudflare Pages frontend

Build and deploy the static frontend from the repository root. Configure the Pages build command as `npm run build` and output directory as `dist`. If your Cloudflare setup uses a custom deploy command, set it to `npm run deploy:pages` (or `npx wrangler pages deploy ./dist --project-name=the-neural-report`). Do **not** use `npx wrangler deploy`; that deploys a Worker and produces the “Missing entry-point to Worker script or to assets directory” error for this Pages app. With normal Pages Git integration, leave the custom deploy command unset and let Pages publish the configured `dist` output. Set the Pages environment variable `VITE_API_BASE_URL` to the public origin of the separately hosted API, for example `https://news-api.example.com`. Vite embeds this public base URL at build time; do not put secrets in `VITE_*` variables.

### API and Ollama host

Deploy the Express API, Flask AI service, and Ollama together on a persistent server. The included `compose.yaml` sets `restart: unless-stopped` and stores Ollama models in a named volume, so services return after a host/Docker restart and downloaded models persist.

```sh
cp .env.example .env
# Set FRONTEND_ORIGIN to the Cloudflare Pages site URL.
docker compose up -d --build
docker compose logs -f
```

Compose automatically pulls the configured model once on first startup, then waits for it before starting Flask and the API. The model is stored in the persistent Ollama volume and is not downloaded again on ordinary restarts. The initial download can be large and depends on your model and network. For an NVIDIA GPU host with NVIDIA Container Toolkit installed, start the GPU override instead:

```sh
docker compose -f compose.yaml -f compose.gpu.yaml up -d --build
```

Use `docker compose down` to stop the app; the Ollama model volume is retained. Set Pages' `VITE_API_BASE_URL` to the public Express API URL. Cloudflare Pages hosts only the frontend; it cannot run the API, Flask, or Ollama. Choose a host with enough GPU memory for the configured model if low-latency 30B/70B inference is required. Keep any provider credentials server-side if you add a credentialed search provider later.

The Express API exposes `GET /api/health`, `GET /api/news`, `POST /api/summarize`, `POST /api/summarize-feed`, and `POST /api/chat`. The Flask service exposes matching AI routes and its own `GET /health`. There are no API keys in frontend code.

## Checks

```sh
npm test
npm run build
```