import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 12000,
  customFields: {
    item: ['media:content', 'media:thumbnail', 'source'],
  },
});
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

const defaultFeeds = [
  { name: 'The Verge', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed/' },
  { name: 'NVIDIA Blog', url: 'https://blogs.nvidia.com/feed/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Google DeepMind', url: 'https://deepmind.google/blog/rss.xml' },
];

export function getNewsSources(environment = process.env) {
  if (!environment.NEWS_FEEDS) return defaultFeeds;
  return environment.NEWS_FEEDS.split(',').map((entry) => {
    const [name, ...urlParts] = entry.trim().split('|');
    return { name: name?.trim(), url: urlParts.join('|').trim() };
  }).filter((source) => source.name && /^https?:\/\//i.test(source.url));
}

function cleanText(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(value) {
  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function imageFrom(item) {
  const candidates = [
    item.enclosure?.url,
    item['media:content']?.$.url,
    item['media:thumbnail']?.$.url,
    item.image?.url,
  ];
  return candidates.map(safeUrl).find(Boolean) || null;
}

export function categorizeArticle(article) {
  const text = `${article.title} ${article.description}`.toLowerCase();
  if (/robot|humanoid|embodied|autonomous vehicle/.test(text)) return 'Robotics';
  if (/gpu|chip|semiconductor|accelerator|hardware|nvidia|amd/.test(text)) return 'Hardware';
  if (/research|study|paper|arxiv|scientist|benchmark|neural network/.test(text)) return 'Research';
  if (/api|developer|coding|code|programming|open source|framework|github/.test(text)) return 'Developer';
  if (/model|llm|language model|gpt-|gemini|claude|llama|mistral/.test(text)) return 'AI Models';
  if (/company|funding|acquisition|business|launch|partnership|revenue|startup/.test(text)) return 'Companies';
  return 'AI Models';
}

export function normalizeArticle(item, fallbackSource = 'Publisher') {
  const title = cleanText(item.title);
  const url = safeUrl(item.link || item.guid || item.id);
  if (!title || !url) return null;

  const description = cleanText(item.contentSnippet || item.summary || item.content || item.description || '');
  const feedSource = item.source;
  const sourceLabel = cleanText(
    typeof feedSource === 'string'
      ? feedSource
      : feedSource?._ || feedSource?.title || feedSource?.['#text'] || fallbackSource,
  ) || fallbackSource;
  const dateValue = item.isoDate || item.pubDate || item.published || item.updated;
  const parsedDate = dateValue ? new Date(dateValue) : null;
  const publishedAt = parsedDate && !Number.isNaN(parsedDate.valueOf()) ? parsedDate.toISOString() : null;
  const article = {
    id: url,
    title,
    source: sourceLabel,
    sourceUrl: safeUrl(feedSource?.$?.url) || url,
    publishedAt,
    url,
    description: description.slice(0, 360),
    image: imageFrom(item),
  };
  article.category = categorizeArticle(article);
  return article;
}

export function deduplicateArticles(articles) {
  const seen = new Set();
  return articles.filter((article) => {
    const key = article.url.toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function cached(key, producer) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.time < CACHE_TTL) return { value: entry.value, cacheHit: true };
  const value = await producer();
  cache.set(key, { value, time: Date.now() });
  return { value, cacheHit: false };
}

async function readFeed(source) {
  return cached(`feed:${source.url}`, async () => {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);
    const xml = await response.text();
    const feed = await parser.parseString(xml);
    return (feed.items || []).map((item) => normalizeArticle(item, source.name)).filter(Boolean);
  });
}

async function fetchSearchResults(query) {
  const searchUrl = new URL('https://news.google.com/rss/search');
  searchUrl.search = new URLSearchParams({ q: query, hl: 'en-US', gl: 'US', ceid: 'US:en' }).toString();
  return cached(`search:${query.toLowerCase()}`, async () => {
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`News search returned HTTP ${response.status}`);
    const feed = await parser.parseString(await response.text());
    return (feed.items || []).map((item) => normalizeArticle(item, 'Google News')).filter(Boolean);
  });
}

function matchesQuery(article, query) {
  if (!query) return true;
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${article.title} ${article.description} ${article.source}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

function score(article, query) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const title = article.title.toLowerCase();
  const details = `${article.description} ${article.source}`.toLowerCase();
  return terms.reduce((total, term) => total + (title.includes(term) ? 3 : 0) + (details.includes(term) ? 1 : 0), 0);
}

export async function searchNews({ query = '', category = 'Latest', sort = 'newest' } = {}) {
  const normalizedQuery = query.trim();
  const sources = getNewsSources();
  const tasks = sources.map(async (source) => {
    const result = await readFeed(source);
    return { articles: result.value, cacheHit: result.cacheHit };
  });
  if (normalizedQuery) {
    tasks.push(fetchSearchResults(normalizedQuery).then((result) => ({ articles: result.value, cacheHit: result.cacheHit })));
  }

  const responses = await Promise.allSettled(tasks);
  const articles = [];
  const errors = [];
  let cacheHit = true;
  responses.forEach((response, index) => {
    if (response.status === 'fulfilled') {
      articles.push(...response.value.articles);
      cacheHit = cacheHit && response.value.cacheHit;
    } else {
      const sourceName = index < sources.length ? sources[index].name : 'News search';
      errors.push({ source: sourceName, message: response.reason?.message || 'Feed unavailable' });
    }
  });

  let results = deduplicateArticles(articles).filter((article) => matchesQuery(article, normalizedQuery));
  if (category && category !== 'Latest') results = results.filter((article) => article.category === category);
  if (sort === 'relevance' && normalizedQuery) {
    results.sort((left, right) => score(right, normalizedQuery) - score(left, normalizedQuery));
  } else {
    results.sort((left, right) => (Date.parse(right.publishedAt || '') || 0) - (Date.parse(left.publishedAt || '') || 0));
  }
  return { articles: results, errors, cacheHit };
}

export function clearNewsCache() {
  cache.clear();
}