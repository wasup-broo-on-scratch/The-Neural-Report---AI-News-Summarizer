import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { searchNews } from './news.js';
import { summarizeWithOllama } from './ollama.js';

const app = express();
const port = Number(process.env.PORT || 8787);
const pageSize = 12;

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()) : true,
}));
app.use(express.json({ limit: '32kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, model: process.env.OLLAMA_MODEL || 'qwen3:30b' });
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
  try {
    const summary = await summarizeWithOllama({
      title: article.title.slice(0, 500),
      url: article.url,
      source: String(article.source || '').slice(0, 160),
      publishedAt: String(article.publishedAt || '').slice(0, 50),
      description: String(article.description || '').slice(0, 1200),
      category: String(article.category || '').slice(0, 80),
    });
    response.json({ summary });
  } catch (error) {
    const unavailable = error.cause?.code === 'ECONNREFUSED' || error.name === 'TimeoutError' || error.name === 'AbortError';
    response.status(unavailable ? 503 : 502).json({
      error: unavailable ? 'Ollama is unavailable. News browsing still works without AI summaries.' : error.message,
    });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`The Neural Report API listening on :${port}`);
});