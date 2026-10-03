# The Neural Report

The Neural Report gathers current AI coverage from external publisher RSS feeds and query-based Google News RSS results. Its Home view groups live stories by reporting desk; it links each story to its source and does not host a news archive or fabricate articles. Ollama is an optional, separate service used only when a reader requests an AI-generated brief.

## Local setup

Requirements: Node.js 20 or newer and npm. Ollama is optional.

```sh
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`. Vite serves the React frontend and proxies `/api` requests to the Express API on port 8787. The initial feed loads from configured publisher RSS feeds; searches also query Google News RSS. Feed results are cached in memory for five minutes. If some feeds fail, working sources still appear and the page reports source errors; there are no sample-story fallbacks.

## News sources

Default RSS sources are The Verge AI, MIT Technology Review AI, NVIDIA Blog, Hugging Face, and Google DeepMind. Feed availability and formats are controlled by their publishers and can change. Add or replace feeds using `NEWS_FEEDS` in `.env`:

```env
NEWS_FEEDS=Publisher One|https://publisher.example/feed.xml,Publisher Two|https://publisher.example/rss
```

The query provider is Google News RSS and requires no API key. RSS items are normalized, categorized, deduplicated, and linked to their reported publisher/article URL. The service fetches feed metadata only; it does not scrape or reproduce article bodies. In-memory RSS and search caches expire after five minutes.

## Optional Ollama summaries

Install and run Ollama separately, then pull one of the supported models yourself. The app never downloads a model automatically.

```sh
ollama serve
ollama pull qwen3:30b
```

Set `OLLAMA_URL` and `OLLAMA_MODEL` in `.env`. Supported suggested values are `qwen3:30b` (default), `gemma3:12b`, and `llama3.3:70b`. Open a story brief and choose **Generate AI brief**. Only the retrieved headline, publisher, date, excerpt, and category are sent to Ollama. The response includes an AI-labeled summary, key points, cautious significance, category, topics, and entities. Summaries are cached in memory for 24 hours. If Ollama is offline, browsing and external search remain available.

## Deployment

### Cloudflare Pages frontend

Build and deploy the static frontend from the repository root. Configure the Pages build command as `npm run build` and output directory as `dist`. Set the Pages environment variable `VITE_API_BASE_URL` to the public origin of the separately hosted API, for example `https://news-api.example.com`. Vite embeds this public base URL at build time; do not put secrets in `VITE_*` variables.

### API and Ollama host

Run the Node API on a server/container host that can access the configured RSS sources. Build the included container with `docker build -t neural-report-api .` and run it with port 8787 exposed. Configure `FRONTEND_ORIGIN` to the Pages site origin, along with `OLLAMA_URL`, `OLLAMA_MODEL`, and optional `NEWS_FEEDS`. Ollama should run on a machine reachable by that API; Cloudflare Pages does not run Ollama. Keep any provider credentials server-side if you add a credentialed search provider later.

The API exposes `GET /api/health`, `GET /api/news`, and `POST /api/summarize`. There are no API keys in frontend code.

## Checks

```sh
npm test
npm run build
```