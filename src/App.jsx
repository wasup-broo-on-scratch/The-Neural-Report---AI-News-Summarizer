import { useEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUpRight, BookOpen, Check, ChevronDown, Clock3, Cpu, ExternalLink, House,
  FlaskConical, Layers3, LoaderCircle, Menu, MessageCircle, Moon, Newspaper, Radio, RefreshCw,
  Search, Send, SlidersHorizontal, Sparkles, Sun, X,
} from 'lucide-react';
import { chatWithNews, fetchAiStatus, fetchNews, summarizeArticle, summarizeArticles } from './api.js';

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

function ArticleCard({ article, onOpen, featured = false }) {
  return (
    <article className={`article-card${featured ? ' article-card--featured' : ''}`}>
      {article.image && (
        <button className="article-image" onClick={() => onOpen(article)} aria-label={`Read ${article.title} in The Neural Report`}>
          <img src={article.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.closest('.article-image')?.remove(); }} />
          <span className="image-source">{article.source}</span>
        </button>
      )}
      <div className="article-content">
        <div className="article-meta">
          <span className="category-label">{article.category}</span>
          <span className="meta-dot" />
          <a href={article.sourceUrl || article.url} target="_blank" rel="noreferrer" className="publisher-link">{article.source}</a>
          <span className="meta-dot" />
          <time dateTime={article.publishedAt || undefined}>{relativeDate(article.publishedAt)}</time>
        </div>
        <h2><button className="article-title-button" onClick={() => onOpen(article)}>{article.title}<BookOpen size={15} aria-hidden="true" /></button></h2>
        {article.description && <p className="article-excerpt">{article.description}</p>}
        <div className="article-actions">
          <button className="text-action" onClick={() => onOpen(article)} aria-label={`Read ${article.title} in The Neural Report`}>
            <BookOpen size={14} /> Read in report
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

function ArticleView({ article, initialSummary, onClose }) {
  const [summary, setSummary] = useState(initialSummary || null);
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
      <div className="drawer-top"><span className="eyebrow">THE NEURAL REPORT <span>/</span> ARTICLE VIEW</span><button className="icon-button" onClick={onClose} aria-label="Close article view"><X size={19} /></button></div>
      {article.image && <img className="drawer-image" src={article.image} alt="" />}
      <div className="drawer-meta"><span className="category-label">{article.category}</span><span>{article.source}</span></div>
      <h2 id="drawer-title">{article.title}</h2>
      <span className="excerpt-label">PUBLISHER-PROVIDED EXCERPT</span>
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
        {summary.whyItMatters && <><h3>Why it matters</h3><p>{summary.whyItMatters}</p></>}
        {summary.category && <><h3>Topics & entities</h3><p className="ai-taxonomy"><strong>{summary.category}</strong>{[...(summary.topics || []), ...(summary.entities || [])].length > 0 && ` · ${[...(summary.topics || []), ...(summary.entities || [])].join(' · ')}`}</p></>}
      </section>}
      <a className="button button--outline original-button" href={article.url} target="_blank" rel="noreferrer">Read at {article.source}<ArrowUpRight size={15} /></a>
      <p className="authority-note">Reporting and full context belong to the original publisher.</p>
    </aside>
  </div>;
}

function NewsChat({ articles, aiStatus, onClose, onRefreshStatus }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);
  const contextArticles = articles.slice(0, 12);

  useEffect(() => {
    function onKeyDown(event) { if (event.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  async function sendMessage(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question || sending || !contextArticles.length) return;
    const nextMessages = [...messages, { role: 'user', content: question }];
    setMessages(nextMessages);
    setDraft('');
    setError('');
    setSending(true);
    try {
      const result = await chatWithNews(nextMessages.slice(-8), contextArticles);
      setMessages((current) => [...current, { role: 'assistant', content: result.answer, sources: result.sources, model: result.model }]);
    } catch (requestError) {
      setError(requestError.message);
      onRefreshStatus();
    } finally {
      setSending(false);
    }
  }

  const statusLabel = !aiStatus ? 'CHECKING' : aiStatus.ollama?.modelAvailable ? 'MODEL READY' : aiStatus.ollama?.reachable ? 'MODEL MISSING' : 'OLLAMA OFFLINE';
  const statusClass = !aiStatus ? 'checking' : aiStatus.ollama?.modelAvailable ? 'ready' : 'offline';

  return <div className="drawer-scrim chat-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="chat-drawer" role="dialog" aria-modal="true" aria-labelledby="chat-title">
      <div className="chat-header"><div><span className="eyebrow">THE NEURAL REPORT <span>/</span> NEWS DESK</span><h2 id="chat-title">Ask about the news</h2></div><button className="icon-button" onClick={onClose} aria-label="Close news chat"><X size={19} /></button></div>
      <div className="chat-context"><span className={`ai-status ai-status--${statusClass}`}><i />{statusLabel}</span><span>{contextArticles.length} of {articles.length} loaded stories in context</span></div>
      <div className="chat-transcript" aria-live="polite">
        {messages.length === 0 && <div className="chat-welcome"><MessageCircle size={19} /><h3>What are you following?</h3><p>Ask about the current publisher reports. Replies use only these headlines and excerpts, with links to supporting sources.</p><div className="chat-suggestions"><button onClick={() => setDraft('What are the main themes in these stories?')}>What are the main themes?</button><button onClick={() => setDraft('What do these reports say about AI models?')}>What’s changing in AI models?</button></div></div>}
        {messages.map((message, index) => <div className={`chat-message chat-message--${message.role}`} key={`${message.role}-${index}`}>
          <span className="chat-speaker">{message.role === 'user' ? 'YOU' : `NEWS DESK${message.model ? ` · ${message.model}` : ''}`}</span>
          <p>{message.content}</p>
          {message.role === 'assistant' && message.sources?.length > 0 && <div className="chat-citations"><span>REPORTING</span>{message.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source}: {source.title}<ArrowUpRight size={12} /></a>)}</div>}
        </div>)}
        {sending && <div className="chat-thinking"><LoaderCircle className="spin" size={15} /> Checking the retrieved reports…</div>}
        <div ref={bottomRef} />
      </div>
      {error && <div className="chat-error" role="alert"><strong>Chat is unavailable.</strong><p>{error}</p></div>}
      {contextArticles.length === 0 && <p className="chat-empty">Load current news before starting a conversation.</p>}
      <form className="chat-composer" onSubmit={sendMessage}>
        <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} placeholder="Ask about the stories in this feed…" aria-label="Ask about current news" disabled={!contextArticles.length || sending} rows={2} />
        <button className="button button--lime chat-send" type="submit" disabled={!draft.trim() || !contextArticles.length || sending} aria-label="Send message"><Send size={16} /></button>
      </form>
      <p className="chat-disclaimer">Answers are AI-generated from retrieved publisher metadata, not full article text. Verify details with the linked sources.</p>
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
  const [digest, setDigest] = useState(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('neural-theme') === 'light');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    fetchAiStatus().then((status) => { if (active) setAiStatus(status); }).catch(() => {
      if (active) setAiStatus({ ollama: { reachable: false, modelAvailable: false } });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setDigest(null);
    setDigestError('');
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
      setDigest(null);
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

  async function summarizeCurrentArticles() {
    if (!articles.length || digestLoading) return;
    setDigestLoading(true);
    setDigestError('');
    setDigest(null);
    try {
      setDigest(await summarizeArticles(articles));
    } catch (requestError) {
      setDigestError(requestError.message);
    } finally {
      setDigestLoading(false);
    }
  }

  function chooseCategory(name) {
    setCategory(name);
    setQuery('');
    setQueryInput('');
    setMobileNavOpen(false);
  }

  function openArticle(article, summary = null) {
    setSelected(article);
    setSelectedSummary(summary);
  }

  function closeArticle() {
    setSelected(null);
    setSelectedSummary(null);
  }

  async function refreshAiStatus() {
    try {
      setAiStatus(await fetchAiStatus());
    } catch {
      setAiStatus({ ollama: { reachable: false, modelAvailable: false } });
    }
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
        <button className="chat-launch" onClick={() => { setChatOpen(true); refreshAiStatus(); }} aria-label="Chat with AI about current news"><MessageCircle size={16} /><span>Ask AI</span><i className={`ai-status-dot ai-status-dot--${aiStatus?.ollama?.modelAvailable ? 'ready' : !aiStatus ? 'checking' : 'offline'}`} /></button>
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
            <h2><button className="featured-title-button" onClick={() => openArticle(featured)}>{featured.title}<BookOpen size={18} /></button></h2>
            <p>{featured.description || 'Open the original report for details from the publisher.'}</p>
            <button className="feature-brief" onClick={() => openArticle(featured)}>Read this story here <BookOpen size={14} /></button>
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
          {section.articles.map((article) => <button className="desk-story" key={article.id} onClick={() => openArticle(article)}><span>{article.source} <i /> {relativeDate(article.publishedAt)}</span><strong>{article.title}</strong></button>)}
        </div>)}</div>
      </section>}

      <section className="feed-section" aria-labelledby="feed-title">
        <div className="section-heading">
          <div><span className="eyebrow">THE DAILY FEED <span className="section-count">/ CURRENT COVERAGE</span></span><h2 id="feed-title">{title}</h2></div>
          <div className="feed-controls">
            {query && <button className="clear-search" onClick={() => { setQuery(''); setQueryInput(''); }}>Clear search <X size={13} /></button>}
            <button className="button button--lime digest-button" onClick={summarizeCurrentArticles} disabled={loading || articles.length === 0 || digestLoading}>
              {digestLoading ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}
              {digestLoading ? 'Summarizing…' : 'Summarize Articles With AI'}
            </button>
            <label className="sort-control"><span>SORT</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort news"><option value="newest">Newest</option><option value="relevance">Relevance</option></select><ChevronDown size={13} /></label>
          </div>
        </div>

        {errors.length > 0 && <div className="source-notice" role="status"><Radio size={15} /><span>{errors.length} source{errors.length === 1 ? '' : 's'} could not be reached. Showing available reports.</span><button onClick={() => setRefreshToken((value) => value + 1)}>Retry</button></div>}
        {error && <div className="error-state" role="alert"><div className="state-icon"><Radio size={20} /></div><h3>We couldn't reach the news sources.</h3><p>{error}</p><button className="button button--outline" onClick={() => setRefreshToken((value) => value + 1)}><RefreshCw size={15} /> Try again</button></div>}
        {digestError && <div className="ai-error" role="alert"><Sparkles size={16} /><div><strong>AI summaries are unavailable.</strong><p>{digestError}</p><small>{digestError.includes('VITE_API_BASE_URL') || digestError.includes('API is unreachable') ? <>Deploy the Express API separately and set <code>VITE_API_BASE_URL</code> in Cloudflare Pages to that API's public URL.</> : <>The API is connected, but Ollama is not. Run Ollama where the API can reach it, set <code>OLLAMA_URL</code> on the API host, and install the configured model. Cloudflare Pages itself cannot run Ollama.</>}</small></div><button className="icon-button" onClick={() => setDigestError('')} aria-label="Dismiss AI error"><X size={16} /></button></div>}
        {digest && <section className="digest-panel" aria-label="AI-generated article summaries">
          <div className="digest-heading"><div><span className="ai-label"><Sparkles size={14} /> AI-GENERATED ARTICLE SUMMARIES <span>· {digest.model}</span></span><p>Based only on retrieved publisher headlines and excerpts. Visit each original source for full reporting.</p></div><button className="icon-button" onClick={() => setDigest(null)} aria-label="Close AI summaries"><X size={17} /></button></div>
          <div className="digest-list">{digest.summaries.map(({ article, summary, keyPoints }) => <article className="digest-story" key={article.id}>
            <div className="digest-story-meta"><span className="category-label">{article.category}</span><span className="meta-dot" /><span>{article.source}</span><span className="meta-dot" /><time>{formatDate(article.publishedAt)}</time></div>
            <h3><button className="digest-title-button" onClick={() => openArticle(article, { summary, keyPoints, model: digest.model })}>{article.title}<BookOpen size={14} /></button></h3>
            <p>{summary}</p>
            {keyPoints.length > 0 && <ul>{keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>}
            <a className="original-link" href={article.url} target="_blank" rel="noreferrer">Original story <ExternalLink size={13} /></a>
          </article>)}</div>
        </section>}
        {loading && <SkeletonList />}
        {!loading && !error && articles.length === 0 && <div className="empty-state"><div className="state-icon"><Search size={20} /></div><h3>No matching reports found.</h3><p>Try a broader topic or check back as publishers update their feeds.</p><button className="text-action" onClick={() => chooseCategory('Latest')}>Browse latest coverage <ArrowUpRight size={14} /></button></div>}
        {!loading && !error && articles.length > 0 && <>
          <div className="article-list">
            {articles.map((article) => <ArticleCard key={article.id} article={article} onOpen={openArticle} />)}
          </div>
          {hasMore && <div className="load-more-wrap"><button className="button button--outline" onClick={loadMore} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="spin" size={15} /> : <ArrowDown size={15} />}{loadingMore ? 'Loading reports…' : 'Load more reports'}</button></div>}
          {!hasMore && <div className="end-note"><span /> YOU'RE UP TO DATE <span /></div>}
        </>}
      </section>
    </main>

    <footer className="site-footer"><a className="footer-wordmark" href="#top">THE NEURAL REPORT</a><span>Aggregated from independent publishers. Original reporting belongs to its source.</span><span className="footer-status"><Check size={13} /> LIVE SOURCES</span></footer>
    {selected && <ArticleView key={selected.id} article={selected} initialSummary={selectedSummary} onClose={closeArticle} />}
    {chatOpen && <NewsChat articles={articles} aiStatus={aiStatus} onClose={() => setChatOpen(false)} onRefreshStatus={refreshAiStatus} />}
  </div>;
}