import test from 'node:test';
import assert from 'node:assert/strict';
import { categorizeArticle, deduplicateArticles, getNewsSources, normalizeArticle } from './news.js';

test('normalizes an RSS item while retaining the original publisher URL', () => {
  const article = normalizeArticle({
    title: 'New model research',
    link: 'https://publisher.example/story',
    contentSnippet: '<p>Researchers report a new benchmark.</p>',
    pubDate: '2025-01-01T12:00:00Z',
  }, 'Example Journal');

  assert.equal(article.url, 'https://publisher.example/story');
  assert.equal(article.source, 'Example Journal');
  assert.equal(article.description, 'Researchers report a new benchmark.');
  assert.equal(article.category, 'Research');
});

test('normalizes Google News publisher tags with RSS text and attributes', () => {
  const article = normalizeArticle({
    title: 'A current AI story',
    link: 'https://news.google.com/rss/articles/example',
    source: { _: 'Example Publisher', $: { url: 'https://publisher.example' } },
  }, 'Google News');

  assert.equal(article.source, 'Example Publisher');
  assert.equal(article.sourceUrl, 'https://publisher.example/');
});

test('drops malformed records and deduplicates tracking variants', () => {
  const malformed = normalizeArticle({ title: 'No usable URL', link: 'javascript:alert(1)' });
  assert.equal(malformed, null);
  const articles = [
    { url: 'https://publisher.example/story?utm_source=feed' },
    { url: 'https://publisher.example/story' },
  ];
  assert.equal(deduplicateArticles(articles).length, 1);
});

test('accepts configured RSS sources without requiring an API key', () => {
  const sources = getNewsSources({ NEWS_FEEDS: 'Research Desk|https://research.example/rss,Invalid|file:///etc/passwd' });
  assert.deepEqual(sources, [{ name: 'Research Desk', url: 'https://research.example/rss' }]);
});

test('routes hardware and robotics stories into the requested sections', () => {
  assert.equal(categorizeArticle({ title: 'New AI chip', description: '' }), 'Hardware');
  assert.equal(categorizeArticle({ title: 'Humanoid robot demo', description: '' }), 'Robotics');
});