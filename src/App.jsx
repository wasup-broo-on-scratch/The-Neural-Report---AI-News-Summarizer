import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUpRight, Check, ChevronDown, Clock3, Cpu, ExternalLink, House,
  FlaskConical, Layers3, LoaderCircle, Menu, Moon, Newspaper, Radio, RefreshCw,
  Search, SlidersHorizontal, Sparkles, Sun, X,
} from 'lucide-react';
import { fetchNews, summarizeArticle } from './api.js';

const categories = [
  { name: 'Home', icon: House },
  { name: 'Latest', icon: Newspaper },
  { name: 'AI Models', icon: Layers3 },
  { name: 'Research', icon: FlaskConical },
  { name: 'Companies', icon: Radio },
  { name: 'Robotics', icon: Cpu },
  { name: 'Developer', icon: SlidersHorizontal },
  { name: 'Hardware', icon: Cpu },
];

function formatDate(date) {
  if (!date) return 'Date unavailable';
  const value = new Date(date);
  if (Number.isNaN(value.valueOf())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(value);
}

function relativeDate(date) {
  if (!date) return 'Recently';
  const hours = Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / 3600000));
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : formatDate(date);
}

function ArticleCard({ article, onBrief, featured = false }) {
  return (
    <article className={`article-card${featured ? ' article-card--featured' : ''}`}>
      {article.image && (
        <a className="article-image" href={article.url} target="_blank" rel="noreferrer" aria-label={`Open ${article.title} at ${article.source}`}>
          <img src={article.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.closest('.article-image')?.remove(); }} />
          <span className="image-source">{article.source}</span>
        </a>
      )}
      <div className="article-content">
        <div className="article-meta">
          <span className="category-label">{article.category}</span>
          <span className="meta-dot" />
          <a href={article.sourceUrl || article.url} target="_blank" rel="noreferrer" className="publisher-link">{article.source}</a>
          <span className="meta-dot" />
          <time dateTime={article.publishedAt || undefined}>{relativeDate(article.publishedAt)}</time>
        </div>
        <h2><a href={article.url} target="_blank" rel="noreferrer">{article.title}<ArrowUpRight size={16} aria-hidden="true" /></a></h2>
        {article.description && <p className="article-excerpt">{article.description}</p>}
        <div className="article-actions">
          <button className="text-action" onClick={() => onBrief(article)} aria-label={`Open brief for ${article.title}`}>
            <Sparkles size={14} /> Story brief
          </button>
          <a className="original-link" href={article.url} target="_blank" rel="noreferrer">
            Original story <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </article>
  );
}

function SkeletonList() {
  return <div className="skeleton-list" aria-label="Loading current stories" aria-busy="true">
    {[0, 1, 2, 3].map((item) => <div className="skeleton-story" key={item}><div className="skeleton-line skeleton-meta" /><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-copy" /></div>)}
  </div>;
}

function StoryBrief({ article, onClose }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestRef = useRef(false);

  async function generate() {
    if (requestRef.current) return;
    requestRef.current = true;
    setLoading(true);
    setError('');
    try {
      setSummary(await summarizeArticle(article));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      requestRef.current = false;
    }
  }

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return <div className="drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="story-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="drawer-top"><span className="eyebrow">THE NEURAL REPORT <span>/</span> STORY BRIEF</span><button className="icon-button" onClick={onClose} aria-label="Close brief"><X size={19} /></button></div>
      {article.image && <img className="drawer-image" src={article.image} alt="" />}
      <div className="drawer-meta"><span className="category-label">{article.category}</span><span>{article.source}</span></div>
      <h2 id="drawer-title">{article.title}</h2>
      <p className="drawer-description">{article.description || 'The publisher did not provide an excerpt for this story.'}</p>
      <div className="source-line"><Clock3 size={14} /> {formatDate(article.publishedAt)} <span>·</span> Source: <a href={article.sourceUrl || article.url} target="_blank" rel="noreferrer">{article.source}</a></div>
      {!summary && <div className="summary-prompt">
        <div className="ai-label"><Sparkles size={14} /> OPTIONAL AI PROCESSING</div>
        <p>Generate a short brief from this retrieved headline and publisher-provided excerpt. The original article remains the authoritative source.</p>
        <button className="button button--lime" onClick={generate} disabled={loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={15} />}
          {loading ? 'Working…' : 'Generate AI brief'}
        </button>
        {error && <p className="inline-error" role="alert">{error}</p>}
      </div>}
      {summary && <section className="generated-summary">
        <div className="ai-label"><Sparkles size={14} /> AI-GENERATED SUMMARY <span>· {summary.model}</span></div>
        <p>{summary.summary}</p>
        <h3>Key points</h3>
        <ul>{summary.keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>
        <h3>Why it matters</h3>
        <p>{summary.whyItMatters}</p>
        <h3>Topics & entities</h3>
        <p className="ai-taxonomy"><strong>{summary.category}</strong>{[...summary.topics, ...summary.entities].length > 0 && ` · ${[...summary.topics, ...summary.entities].join(' · ')}`}</p>
      </section>}
      <a className="button button--outline original-button" href={article.url} target="_blank" rel="noreferrer">Read at {article.source}<ArrowUpRight size={15} /></a>
      <p className="authority-note">Reporting and full context belong to the original publisher.</p>
    </aside>
  </div>;
}

export default function App() {
  const [category, setCategory] = useState('Home');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [articles, setArticles] = useState([]);
  const [errors, setErrors] = useState([]);
  const [sections, setSections] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('neural-theme') === 'light');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchNews({ query, category, sort, page: 1 }).then((result) => {
      if (!active) return;
      setArticles(result.articles);
      setErrors(result.errors || []);
      setSections(result.sections || []);
      setHasMore(result.hasMore);
      setPage(1);
    }).catch((requestError) => {
      if (active) { setArticles([]); setErrors([]); setError(requestError.message); }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, category, sort, refreshToken]);

  function submitSearch(event) {
    event.preventDefault();
    setQuery(queryInput.trim());
    setCategory('Latest');
    setMobileNavOpen(false);
  }

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await fetchNews({ query, category, sort, page: nextPage });
      setArticles((current) => [...current, ...result.articles]);
      setErrors(result.errors || []);
      setSections(result.sections || []);
      setHasMore(result.hasMore);
      setPage(nextPage);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingMore(false);
    }
  }

  function chooseCategory(name) {
    setCategory(name);
    setQuery('');
    setQueryInput('');
    setMobileNavOpen(false);
  }

  function toggleTheme() {
    const nextMode = !lightMode;
    setLightMode(nextMode);
    localStorage.setItem('neural-theme', nextMode ? 'light' : 'dark');
  }

  const title = query ? `Search: ${query}` : category === 'Home' || category === 'Latest' ? 'Latest AI News' : category;
  const featured = !query && category === 'Home' && articles.length ? articles[0] : null;

  return <div className={lightMode ? 'app theme-light' : 'app'}>
    <header className="site-header">
      <a className="wordmark" href="#top" onClick={() => chooseCategory('Home')} aria-label="The Neural Report home">
        <span className="wordmark-mark"><span /><span /><span /><span /></span>
        <span className="wordmark-text">THE NEURAL<br />REPORT</span>
      </a>
      <div className="header-center"><span className="edition-label">INDEPENDENT AI COVERAGE</span><span className="edition-date">GLOBAL EDITION <i /> UPDATED FROM LIVE SOURCES</span></div>
      <div className="header-tools">
        <button className="icon-button header-refresh" aria-label="Refresh news" title="Refresh news" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={17} /></button>
        <button className="icon-button theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${lightMode ? 'dark' : 'light'} mode`} title={`Switch to ${lightMode ? 'dark' : 'light'} mode`}>{lightMode ? <Moon size={17} /> : <Sun size={17} />}</button>
        <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen((open) => !open)} aria-label="Toggle navigation">{mobileNavOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </header>

    <nav className={`category-nav${mobileNavOpen ? ' category-nav--open' : ''}`} aria-label="News categories">
      <div className="nav-inner">
        {categories.map(({ name, icon: Icon }) => <button key={name} className={`nav-item${category === name && !query ? ' nav-item--active' : ''}`} onClick={() => chooseCategory(name)}><Icon size={15} strokeWidth={1.7} />{name}</button>)}
        <button className="nav-search-shortcut" onClick={() => document.querySelector('#news-search')?.focus()}><Search size={15} /> Search</button>
      </div>
    </nav>

    <main id="top">
      <section className="masthead" aria-label="Publication introduction">
        <div className="masthead-copy"><span className="eyebrow"><span className="live-dot" /> REAL REPORTING. ONE CLEAR SIGNAL.</span><h1>AI, in <em>context.</em></h1><p>Current reporting from the publishers moving artificial intelligence forward.</p></div>
        <form className="search-form" onSubmit={submitSearch} role="search">
          <Search size={19} />
          <input id="news-search" type="search" value={queryInput} onChange={(event) => setQueryInput(event.target.value)} placeholder="Search companies, models, research…" aria-label="Search current AI news" />
          <button type="submit" aria-label="Search"><span>SEARCH</span><ArrowUpRight size={16} /></button>
        </form>
      </section>

      {featured && !loading && <section className="featured-band">
        <div className="featured-kicker"><span className="eyebrow">TODAY'S SIGNAL</span><span className="kicker-rule" /></div>
        <div className="featured-story">
          <div className="featured-main">
            <div className="article-meta"><span className="category-label">{featured.category}</span><span className="meta-dot" /><a className="publisher-link" href={featured.sourceUrl || featured.url} target="_blank" rel="noreferrer">{featured.source}</a><span className="meta-dot" /><time>{formatDate(featured.publishedAt)}</time></div>
            <h2><a href={featured.url} target="_blank" rel="noreferrer">{featured.title}<ArrowUpRight size={18} /></a></h2>
            <p>{featured.description || 'Open the original report for details from the publisher.'}</p>
            <button className="feature-brief" onClick={() => setSelected(featured)}>Explore story brief <ArrowDown size={14} /></button>
          </div>
          <div className={`featured-art${featured.image ? ' featured-art--image' : ''}`}>
            {featured.image ? <img src={featured.image} alt="" onError={(event) => event.currentTarget.remove()} /> : <><div className="art-grid" /><span className="art-index">FIELD<br />REPORT<br /><strong>01</strong></span><span className="art-caption">{featured.source}<br />{formatDate(featured.publishedAt)}</span></>}
          </div>
        </div>
      </section>}

      {category === 'Home' && !query && !loading && sections.length > 0 && <section className="desk-section" aria-labelledby="desk-heading">
        <div className="desk-heading"><div><span className="eyebrow">REPORTING BY DESK</span><h2 id="desk-heading">Across the field</h2></div><span className="desk-note">LIVE PUBLISHER COVERAGE</span></div>
        <div className="desk-grid">{sections.map((section) => <div className="desk-column" key={section.name}>
          <button className="desk-title" onClick={() => chooseCategory(section.name)}>{section.name}<ArrowUpRight size={14} /></button>
          {section.articles.map((article) => <a className="desk-story" key={article.id} href={article.url} target="_blank" rel="noreferrer"><span>{article.source} <i /> {relativeDate(article.publishedAt)}</span><strong>{article.title}</strong></a>)}
        </div>)}</div>
      </section>}

      <section className="feed-section" aria-labelledby="feed-title">
        <div className="section-heading">
          <div><span className="eyebrow">THE DAILY FEED <span className="section-count">/ CURRENT COVERAGE</span></span><h2 id="feed-title">{title}</h2></div>
          <div className="feed-controls">
            {query && <button className="clear-search" onClick={() => { setQuery(''); setQueryInput(''); }}>Clear search <X size={13} /></button>}
            <label className="sort-control"><span>SORT</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort news"><option value="newest">Newest</option><option value="relevance">Relevance</option></select><ChevronDown size={13} /></label>
          </div>
        </div>

        {errors.length > 0 && <div className="source-notice" role="status"><Radio size={15} /><span>{errors.length} source{errors.length === 1 ? '' : 's'} could not be reached. Showing available reports.</span><button onClick={() => setRefreshToken((value) => value + 1)}>Retry</button></div>}
        {error && <div className="error-state" role="alert"><div className="state-icon"><Radio size={20} /></div><h3>We couldn't reach the news sources.</h3><p>{error}</p><button className="button button--outline" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={15} /> Try again</button></div>}
        {loading && <SkeletonList />}
        {!loading && !error && articles.length === 0 && <div className="empty-state"><div className="state-icon"><Search size={20} /></div><h3>No matching reports found.</h3><p>Try a broader topic or check back as publishers update their feeds.</p><button className="text-action" onClick={() => chooseCategory('Latest')}>Browse latest coverage <ArrowUpRight size={14} /></button></div>}
        {!loading && !error && articles.length > 0 && <>
          <div className="article-list">
            {articles.map((article) => <ArticleCard key={article.id} article={article} onBrief={setSelected} />)}
          </div>
          {hasMore && <div className="load-more-wrap"><button className="button button--outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="spin" size={15} /> : <ArrowDown size={15} />}{loadingMore ? 'Loading reports…' : 'Load more reports'}</button></div>}
          {!hasMore && <div className="end-note"><span /> YOU'RE UP TO DATE <span /></div>}
        </>}
      </section>
    </main>

    <footer className="site-footer"><a className="footer-wordmark" href="#top">THE NEURAL REPORT</a><span>Aggregated from independent publishers. Original reporting belongs to its source.</span><span className="footer-status"><Check size={13} /> LIVE SOURCES</span></footer>
    {selected && <StoryBrief article={selected} onClose={() => setSelected(null)} />}
  </div>;
}