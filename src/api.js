const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

async function requestApi(path, options, serviceName) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch {
    throw new Error('The Neural Report API is unreachable. Deploy the API separately and set VITE_API_BASE_URL to its public URL.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('The Neural Report API is not connected to this site. Deploy the API and set VITE_API_BASE_URL in the frontend deployment.');
    }
    throw new Error(payload.error || `${serviceName} is unavailable right now.`);
  }
  return payload;
}

export async function fetchNews({ query = '', category = 'Latest', sort = 'newest', page = 1 } = {}) {
  const params = new URLSearchParams({ query, category, sort, page: String(page) });
  return requestApi(`/api/news?${params}`, undefined, 'The news service');
}

export async function fetchAiStatus() {
  return requestApi('/api/health', undefined, 'AI status');
}

export async function summarizeArticle(article) {
  const payload = await requestApi('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article }),
  }, 'AI processing');
  return payload.summary;
}

export async function summarizeArticles(articles) {
  const result = { summaries: [], model: '', cached: true };
  for (let offset = 0; offset < articles.length; offset += 12) {
    const payload = await requestApi('/api/summarize-feed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articles: articles.slice(offset, offset + 12) }),
    }, 'AI processing');
    result.summaries.push(...payload.summaries);
    result.model = payload.model;
    result.cached = result.cached && payload.cached;
  }
  return result;
}

export async function chatWithNews(messages, articles) {
  return requestApi('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, articles }),
  }, 'AI chat');
}