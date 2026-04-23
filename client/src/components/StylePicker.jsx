import React, { useState } from 'react';
import './StylePicker.css';

const AESTHETICS = [
  { key: 'solarpunk',   icon: '🌿', label: 'Solarpunk',       sub: 'Green utopia', accent: '#14b8a6' },
  { key: 'cyberpunk',   icon: '🌆', label: 'Cyberpunk',       sub: 'Neon dystopia', accent: '#f59e0b' },
  { key: 'bio',         icon: '🧬', label: 'Bio-Integrated',  sub: 'Living city',   accent: '#22c55e' },
  { key: 'steampunk',   icon: '⚙️', label: 'Steampunk',       sub: 'Brass & steam', accent: '#b45309' },
  { key: 'space',       icon: '🌕', label: 'Space Colony',    sub: 'Beyond Earth',  accent: '#6366f1' },
  { key: 'apocalyptic', icon: '🏚️', label: 'Post-Apocalyptic', sub: 'After the fall', accent: '#ef4444' },
];

const ERAS = [2050, 2100, 2200, 2500, 3000];
const TONES = ['optimistic', 'dramatic', 'mysterious'];

export default function StylePicker({ onBegin }) {
  const [selectedAesthetics, setSelectedAesthetics] = useState([]);
  const [era, setEra] = useState(2100);
  const [tone, setTone] = useState('dramatic');

  const toggleAesthetic = (key) => {
    setSelectedAesthetics((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const eraIndex = ERAS.indexOf(era);
  const sliderPct = (eraIndex / (ERAS.length - 1)) * 100;

  const handleEraChange = (e) => {
    const idx = Math.round(Number(e.target.value));
    setEra(ERAS[idx]);
  };

  const handleBegin = () => {
    onBegin({ aesthetics: selectedAesthetics, era, tone });
  };

  return (
    <div className="picker-view">
      <div className="picker-header">
        <h2>Design Your Future</h2>
        <p>Choose the shape of tomorrow before we begin your journey.</p>
      </div>

      {/* ── Aesthetic Cards ── */}
      <div className="picker-section">
        <div className="picker-section-label">Choose Your Aesthetic(s)</div>
        <div className="aesthetic-grid">
          {AESTHETICS.map(({ key, icon, label, sub, accent }) => (
            <div
              key={key}
              className={`aesthetic-card ${selectedAesthetics.includes(key) ? 'selected' : ''}`}
              style={{ '--card-accent': accent, '--card-glow': accent }}
              onClick={() => toggleAesthetic(key)}
              role="checkbox"
              aria-checked={selectedAesthetics.includes(key)}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && toggleAesthetic(key)}
            >
              {selectedAesthetics.includes(key) && (
                <span className="selected-check">✓</span>
              )}
              <span className="card-icon">{icon}</span>
              <div className="card-label">{label}</div>
              <div className="card-sub">{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Time Era Slider ── */}
      <div className="picker-section">
        <div className="picker-section-label">Time Era</div>
        <div className="era-slider-row">
          <span className="era-value">{era} AD</span>
          <input
            type="range"
            className="era-input"
            min={0}
            max={ERAS.length - 1}
            step={1}
            value={eraIndex}
            onChange={handleEraChange}
            style={{ '--slider-pct': `${sliderPct}%` }}
            aria-label="Time era"
          />
        </div>
      </div>

      {/* ── Narrative Tone ── */}
      <div className="picker-section">
        <div className="picker-section-label">Narrative Tone</div>
        <div className="tone-pills">
          {TONES.map((t) => (
            <button
              key={t}
              className={`tone-pill ${tone === t ? 'selected' : ''}`}
              onClick={() => setTone(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── CTA ── */}
      <button
        className="begin-btn"
        disabled={selectedAesthetics.length === 0}
        onClick={handleBegin}
      >
        Begin Journey →
      </button>
      {selectedAesthetics.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', opacity: 0.5, marginTop: '-1.5rem' }}>
          Select at least one aesthetic to continue
        </p>
      )}
    </div>
  );
}
