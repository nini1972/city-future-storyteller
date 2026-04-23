import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Image as ImageIcon, Sparkles, LayoutGrid, ArrowLeft } from 'lucide-react';
import { AudioRecorder } from './utils/audioRecorder';
import { AudioPlayer } from './utils/audioPlayer';
import { buildSystemPrompt } from './utils/systemPrompt';
import StylePicker from './components/StylePicker';
import Gallery from './components/Gallery';
import './index.css';

// ────────────────────────────────────────────────
// VIEWS: "picker" → "storyteller" | "gallery"
// ────────────────────────────────────────────────

function App() {
  const [view, setView] = useState('picker');            // 'picker' | 'storyteller' | 'gallery'
  const [sessionConfig, setSessionConfig] = useState(null);

  const handleBeginJourney = (config) => {
    setSessionConfig(config);
    setView('storyteller');
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title-gradient">City Futures Storyteller</h1>
        <p className="subtitle">Discover the multiverse of your city's tomorrow</p>

        {/* Nav — only after picker */}
        {view !== 'picker' && (
          <nav className="app-nav">
            <button
              className={`nav-btn ${view === 'storyteller' ? 'active' : ''}`}
              onClick={() => setView('storyteller')}
            >
              <Sparkles size={14} /> Story
            </button>
            <button
              className={`nav-btn ${view === 'gallery' ? 'active' : ''}`}
              onClick={() => setView('gallery')}
            >
              <LayoutGrid size={14} /> Gallery
            </button>
            <button
              className="nav-btn nav-btn-back"
              onClick={() => setView('picker')}
              title="Change style"
            >
              <ArrowLeft size={14} /> Restyle
            </button>
          </nav>
        )}
      </header>

      {view === 'picker' && <StylePicker onBegin={handleBeginJourney} />}
      {view === 'storyteller' && <StorytellerView config={sessionConfig} />}
      {view === 'gallery' && <Gallery />}
    </div>
  );
}

// ────────────────────────────────────────────────
// STORYTELLER VIEW (the original session UI)
// ────────────────────────────────────────────────

function StorytellerView({ config }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReady, setIsReady] = useState(false);   // true after server confirms 'configured'
  const [isRecording, setIsRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [visualContext, setVisualContext] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Connecting to Neural Grid…');

  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // AudioPlayer is NOT created here — it must be initialized after a user gesture
    // to avoid browser AudioContext autoplay suspension. See toggleRecording below.

    const ws = new WebSocket('ws://localhost:8080');
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      setStatusMsg('Initialising your world…');

      // Send the style config as a configure message before any audio
      const systemPrompt = config ? buildSystemPrompt(config) : undefined;
      ws.send(JSON.stringify({ type: 'configure', systemPrompt }));
    };

    ws.onclose = () => {
      setIsConnected(false);
      setIsReady(false);
      setStatusMsg('Disconnected from Nexus');
    };

    ws.onerror = (e) => console.error('WebSocket error:', e);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Server confirmed configuration
        if (data.type === 'configured') {
          setIsReady(true);
          setStatusMsg('Connected · Speak to begin');
          return;
        }

        // Custom visual context from Gemini tool call
        if (data.type === 'custom' && data.visual_context) {
          setVisualContext(data.visual_context);
          return;
        }

        // Standard Gemini audio response
        if (data.serverContent) {
          const modelTurn = data.serverContent.modelTurn;
          if (modelTurn?.parts) {
            modelTurn.parts.forEach((part) => {
              if (part.inlineData?.data && playerRef.current) {
                playerRef.current.addAudioChunk(part.inlineData.data);
              }
            });
          }
        }
      } catch (e) {
        console.error('Error parsing message', e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) ws.close();
      if (recorderRef.current) recorderRef.current.stop();
      if (playerRef.current) playerRef.current.stop();
    };
  }, []); // eslint-disable-line

  const toggleRecording = async () => {
    if (isRecording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setIsRecording(false);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ clientContent: { turnComplete: true } }));
      }
    } else {
      // Initialize AudioPlayer here — AFTER a user gesture — so AudioContext is not suspended.
      if (!playerRef.current) {
        playerRef.current = new AudioPlayer();
        playerRef.current.onPlaybackStatus = (playing) => setAgentSpeaking(playing);
      }
      // Initialize the audio context explicitly inside this user gesture
      playerRef.current.init();
      
      // Ensure the AudioContext is running (may still be suspended if init was early)
      if (playerRef.current.audioContext) {
        await playerRef.current.audioContext.resume();
      }

      recorderRef.current = new AudioRecorder((base64PCM) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{ mimeType: 'audio/pcm', data: base64PCM }],
            },
          }));
        }
      });
      await recorderRef.current.start();
      setIsRecording(true);
    }
  };

  // Derive config display labels
  const configLabel = config
    ? `${config.aesthetics.join(' + ')} · ${config.era} AD · ${config.tone}`
    : null;

  return (
    <main className="main-grid">
      {/* ── Controls Panel ── */}
      <section className="glass-panel controls-container">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Sparkles size={24} color="var(--accent-purple)" /> Intercom Focus
        </h2>

        {/* Status */}
        <div className="status" style={{ justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className={`status-dot ${isReady ? 'connected' : ''}`} />
          {statusMsg}
        </div>

        {/* Config badge */}
        {configLabel && (
          <div className="config-badge">
            {configLabel}
          </div>
        )}

        <button
          className={`mic-button ${isRecording ? 'active' : ''}`}
          onClick={toggleRecording}
          disabled={!isReady}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        >
          {isRecording ? <MicOff size={48} /> : <Mic size={48} />}
        </button>

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '1.5rem' }}>
          {isRecording ? 'Speak now to navigate the future…' : isReady ? 'Click to establish connection' : 'Preparing your world…'}
        </p>

        <AudioVisualizer active={agentSpeaking || isRecording} mode={isRecording ? 'input' : 'output'} />
      </section>

      {/* ── Visuals Panel ── */}
      <section className="glass-panel visuals-container">
        {visualContext ? (
          <>
            <img
              src={visualContext.imageUrl}
              alt="Generated City Scene"
              className="image-display"
            />
            <div className="prompt-overlay">
              <p style={{ fontSize: '0.9rem', color: '#fff', fontStyle: 'italic' }}>
                "{visualContext.prompt}"
              </p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <ImageIcon size={64} opacity={0.5} />
            <p>Visual streams will appear here as the story unfolds.</p>
          </div>
        )}
      </section>
    </main>
  );
}

// ────────────────────────────────────────────────
// AUDIO VISUALIZER
// ────────────────────────────────────────────────

const AudioVisualizer = ({ active, mode }) => {
  const bars = 15;
  const [heights, setHeights] = useState(Array(bars).fill(4));

  useEffect(() => {
    if (!active) { setHeights(Array(bars).fill(4)); return; }
    const interval = setInterval(() => {
      setHeights(Array.from({ length: bars }, () => Math.random() * 40 + 10));
    }, 100);
    return () => clearInterval(interval);
  }, [active]);

  const colorScheme = mode === 'input'
    ? 'linear-gradient(to top, var(--accent-teal), var(--accent-blue))'
    : 'linear-gradient(to top, var(--accent-blue), var(--accent-purple))';

  return (
    <div className="visualizer">
      {heights.map((h, i) => (
        <div
          key={i}
          className="bar"
          style={{ height: `${h}px`, background: active ? colorScheme : 'var(--glass-border)' }}
        />
      ))}
    </div>
  );
};

export default App;
