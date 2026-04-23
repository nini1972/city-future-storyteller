import React, { useState, useEffect, useCallback } from 'react';
import './Gallery.css';

const SERVER_BASE = 'http://localhost:8080';

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function extractKeyword(prompt) {
  const knownCities = [
    'Bruges', 'Antwerp', 'Brussels', 'Tokyo', 'Berlin', 'Copenhagen',
    'Reykjavik', 'Lisbon', 'New York', 'Moscow', 'Antilles', 'Lunar', 'Moon',
  ];
  for (const city of knownCities) {
    if (prompt.toLowerCase().includes(city.toLowerCase())) return city;
  }
  return null;
}

export default function Gallery() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('newest');
  const [lightboxIdx, setLightboxIdx] = useState(null);

  useEffect(() => {
    fetch(`${SERVER_BASE}/api/history`)
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false); })
      .catch(() => { setError('Could not load gallery. Is the server running?'); setLoading(false); });
  }, []);

  // Keyboard nav for lightbox
  const handleKey = useCallback((e) => {
    if (lightboxIdx === null) return;
    if (e.key === 'ArrowRight') setLightboxIdx((i) => Math.min(i + 1, filtered.length - 1));
    if (e.key === 'ArrowLeft') setLightboxIdx((i) => Math.max(i - 1, 0));
    if (e.key === 'Escape') setLightboxIdx(null);
  }, [lightboxIdx]); // eslint-disable-line

  useEffect(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const filtered = items
    .filter((item) =>
      search === '' || item.prompt.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      sort === 'newest' ? b.timestamp - a.timestamp : a.timestamp - b.timestamp
    );

  const lightboxItem = lightboxIdx !== null ? filtered[lightboxIdx] : null;

  return (
    <div className="gallery-view">
      {/* Toolbar */}
      <div className="gallery-toolbar">
        <input
          className="gallery-search"
          type="text"
          placeholder="Search scenes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search gallery"
        />
        <select
          className="gallery-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        <span className="gallery-count">{filtered.length} scenes</span>
      </div>

      {/* Grid */}
      {loading && <p className="gallery-empty">Loading gallery…</p>}
      {error && <p className="gallery-empty">{error}</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="gallery-empty">No scenes match your search.</p>
      )}

      <div className="gallery-grid">
        {filtered.map((item, idx) => {
          const keyword = extractKeyword(item.prompt);
          return (
            <div
              key={item.timestamp}
              className="gallery-card"
              onClick={() => setLightboxIdx(idx)}
              role="button"
              tabIndex={0}
              aria-label={`Open scene: ${item.prompt.slice(0, 60)}`}
              onKeyDown={(e) => e.key === 'Enter' && setLightboxIdx(idx)}
            >
              <img
                src={`${SERVER_BASE}/history/${item.filename}`}
                alt={item.prompt}
                loading="lazy"
              />
              <div className="gallery-card-overlay">
                <p className="gallery-card-prompt">"{item.prompt}"</p>
                <p className="gallery-card-meta">
                  {keyword && `${keyword} · `}{formatDate(item.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightboxItem && (
        <div
          className="lightbox-overlay"
          onClick={(e) => e.target === e.currentTarget && setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Image lightbox"
        >
          <div className="lightbox-inner">
            <img
              className="lightbox-image"
              src={`${SERVER_BASE}/history/${lightboxItem.filename}`}
              alt={lightboxItem.prompt}
            />
            <p className="lightbox-caption">"{lightboxItem.prompt}"</p>
            <div className="lightbox-actions">
              <div className="lightbox-nav">
                <button
                  className="lb-btn"
                  onClick={() => setLightboxIdx((i) => i - 1)}
                  disabled={lightboxIdx === 0}
                >
                  ← Prev
                </button>
                <button
                  className="lb-btn"
                  onClick={() => setLightboxIdx((i) => i + 1)}
                  disabled={lightboxIdx === filtered.length - 1}
                >
                  Next →
                </button>
              </div>
              <span className="lightbox-counter">
                {lightboxIdx + 1} / {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <a
                  className="lb-btn download"
                  href={`${SERVER_BASE}/history/${lightboxItem.filename}`}
                  download={lightboxItem.filename}
                  target="_blank"
                  rel="noreferrer"
                >
                  ↓ Download
                </a>
                <button className="lb-btn close" onClick={() => setLightboxIdx(null)}>
                  ✕ Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
