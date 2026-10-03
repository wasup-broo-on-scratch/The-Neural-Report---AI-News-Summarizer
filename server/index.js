import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchNews } from './news.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const pageSize = 12;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()) : true,
}));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', async (_request, response) => {
  const result = await fetchAiService('/health', undefined, 2500);
  if (!result.reachable) {
    return response.json({
      ok: true,
      model: process.env.OLLAMA_MODEL || 'qwen3:30b',
      aiServiceReachable: false,
      ollama: { reachable: false, modelAvailable: false },
    });
  }
  response.status(result.status).json({ ...result.data, apiService: 'express', aiServiceReachable: true });
});

app.get('/api/news', async (request, response) => {
  try {
    const query = String(request.query.query || '').slice(0, 180);
    const category = String(request.query.category || 'Home');
    const sort = request.query.sort === 'relevance' ? 'relevance' : 'newest';
    const page = Math.max(1, Math.min(100, Number.parseInt(request.query.page, 10) || 1));
    const result = await searchNews({ query, category: category === 'Home' ? 'Latest' : category, sort });
    const start = (page - 1) * pageSize;
    const sections = category === 'Home'
      ? ['AI Models', 'Research', 'Companies', 'Robotics', 'Developer', 'Hardware']
        .map((name) => ({ name, articles: result.articles.filter((article) => article.category === name).slice(0, 2) }))
        .filter((section) => section.articles.length > 0)
      : [];
    response.json({
      articles: result.articles.slice(start, start + pageSize),
      total: result.articles.length,
      page,
      pageSize,
      hasMore: start + pageSize < result.articles.length,
      sections,
      errors: result.errors,
      cacheHit: result.cacheHit,
    });
  } catch (error) {
    response.status(502).json({ error: error.message || 'News sources are unavailable.' });
  }
});

app.post('/api/summarize', async (request, response) => {
  const article = request.body?.article;
  if (!article || typeof article.title !== 'string' || typeof article.url !== 'string' || !/^https?:\/\//i.test(article.url)) {
    return response.status(400).json({ error: 'A valid retrieved article is required.' });
  }
  return proxyAi(response, '/summarize', { article: sanitizeArticle(article, 1200) });
});

app.post('/api/summarize-feed', async (request, response) => {
  const articles = request.body?.articles;
  if (!Array.isArray(articles) || articles.length === 0 || articles.length > 12) {
    return response.status(400).json({ error: 'Send between 1 and 12 retrieved articles to summarize.' });
  }
  const validArticles = articles.filter((article) =>
    article && typeof article.title === 'string' && typeof article.url === 'string' && /^https?:\/\//i.test(article.url));
  if (validArticles.length !== articles.length) {
    return response.status(400).json({ error: 'Every article must include a title and valid publisher URL.' });
  }
  return proxyAi(response, '/summarize-feed', { articles: validArticles.map((article) => sanitizeArticle(article, 800)) });
});

app.post('/api/chat', async (request, response) => {
  const { messages, articles } = request.body || {};
  if (!Array.isArray(messages) || !messages.length || !Array.isArray(articles) || !articles.length || articles.length > 12) {
    return response.status(400).json({ error: 'A question and 1 to 12 retrieved articles are required.' });
  }
  const conversation = messages.slice(-8).filter((message) =>
    message && ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
    .map((message) => ({ role: message.role, content: message.content.slice(0, 1500) }));
  if (!conversation.length || conversation.at(-1).role !== 'user') {
    return response.status(400).json({ error: 'Send a question about the current stories.' });
  }
  const validArticles = articles.filter((article) =>
    article && typeof article.title === 'string' && typeof article.url === 'string' && /^https?:\/\//i.test(article.url));
  if (validArticles.length !== articles.length) {
    return response.status(400).json({ error: 'Every article must include a title and valid publisher URL.' });
  }
  return proxyAi(response, '/chat', {
    messages: conversation,
    articles: validArticles.map((article) => sanitizeArticle(article, 800)),
  });
});

function sanitizeArticle(article, descriptionLimit) {
  return {
    title: article.title.slice(0, 500),
    url: article.url,
    source: String(article.source || '').slice(0, 160),
    publishedAt: String(article.publishedAt || '').slice(0, 50),
    description: String(article.description || '').slice(0, descriptionLimit),
    category: String(article.category || '').slice(0, 80),
  };
}

async function fetchAiService(path, payload, timeoutMs) {
  const aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://localhost:8788').replace(/\/$/, '');
  const options = { method: payload === undefined ? 'GET' : 'POST', signal: AbortSignal.timeout(timeoutMs) };
  if (payload !== undefined) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
  }
  try {
    const upstream = await fetch(`${aiServiceUrl}${path}`, options);
    const data = await upstream.json().catch(() => ({ error: 'The Flask AI service returned an invalid response.' }));
    return { reachable: true, status: upstream.status, data };
  } catch {
    return {
      reachable: false,
      status: 503,
      data: { error: `The Flask AI service is not reachable at ${aiServiceUrl}. Start it with npm run dev:ai. Ollama must also be reachable from Flask.` },
    };
  }
}

async function proxyAi(response, path, payload) {
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS || 90000) + 5000;
  const result = await fetchAiService(path, payload, timeoutMs);
  response.status(result.status).json(result.data);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`The Neural Report API listening on :${port}`);
});