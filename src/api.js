const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

export async function fetchNews({ query = '', category = 'Latest', sort = 'newest', page = 1 } = {}) {
  const params = new URLSearchParams({ query, category, sort, page: String(page) });
  const response = await fetch(`${API_BASE}/api/news?${params}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'The news service could not be reached.');
  return payload;
}

export async function summarizeArticle(article) {
  const response = await fetch(`${API_BASE}/api/summarize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ article }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'AI processing is unavailable right now.');
  return payload.summary;
}