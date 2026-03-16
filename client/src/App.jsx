import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Image as ImageIcon, Sparkles } from 'lucide-react';
import { AudioRecorder } from './utils/audioRecorder';
import { AudioPlayer } from './utils/audioPlayer';
import './index.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [visualContext, setVisualContext] = useState(null);
  
  const wsRef = useRef(null);
  const recorderRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    playerRef.current = new AudioPlayer();
    playerRef.current.onPlaybackStatus = (playing) => {
        setAgentSpeaking(playing);
    };

    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
        // Connect to the local Express proxy server
        ws = new WebSocket('ws://localhost:8080');
        wsRef.current = ws;
        
        ws.onopen = () => {
            console.log("WebSocket Connected");
            setIsConnected(true);
        };
        
        ws.onclose = () => {
            console.log("WebSocket Disconnected");
            setIsConnected(false);
            // Optional: Reconnect logic could go here
            // reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };
        
        ws.onerror = (e) => console.error("WebSocket error:", e);

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                // Handle custom tool messages from backend
                if (data.type === 'custom' && data.visual_context) {
                    setVisualContext(data.visual_context);
                    return;
                }

                // Handle standard Gemini serverContent response
                if (data.serverContent) {
                     const modelTurn = data.serverContent.modelTurn;
                     if (modelTurn && modelTurn.parts) {
                         modelTurn.parts.forEach(part => {
                             if (part.inlineData && part.inlineData.data) {
                                 // Received audio chunk, play it
                                 if (playerRef.current) {
                                     playerRef.current.addAudioChunk(part.inlineData.data);
                                 }
                             }
                         });
                     }
                }
            } catch (e) {
                console.error("Error parsing message", e);
            }
        };
    };

    connectWebSocket();

    return () => {
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        if (recorderRef.current) recorderRef.current.stop();
        if (playerRef.current) playerRef.current.stop();
    };
  }, []);

  const toggleRecording = async () => {
      if (isRecording) {
          recorderRef.current?.stop();
          recorderRef.current = null;
          setIsRecording(false);
          
          // Let Gemini know the turn is complete
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
             wsRef.current.send(JSON.stringify({
                 clientContent: {
                     turnComplete: true
                 }
             }));
          }
      } else {
          recorderRef.current = new AudioRecorder((base64PCM) => {
              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                      realtimeInput: {
                          mediaChunks: [{
                              mimeType: "audio/pcm",
                              data: base64PCM
                          }]
                      }
                  }));
              }
          });
          await recorderRef.current.start();
          setIsRecording(true);
      }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title-gradient">City Futures Storyteller</h1>
        <p className="subtitle">Discover the multiverse of your city's tomorrow</p>
        <div className="status">
            <div className={`status-dot ${isConnected ? 'connected' : ''}`}></div>
            {isConnected ? 'Connected to Neural Grid' : 'Disconnected from Nexus'}
        </div>
      </header>

      <main className="main-grid">
        <section className="glass-panel controls-container">
           <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
              <Sparkles size={24} color="var(--accent-purple)"/> Intercom Focus
           </h2>
           
           <button 
              className={`mic-button ${isRecording ? 'active' : ''}`}
              onClick={toggleRecording}
              disabled={!isConnected}
           >
               {isRecording ? <MicOff size={48} /> : <Mic size={48} />}
           </button>

           <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '2rem' }}>
               {isRecording ? "Speak now to navigate the future..." : "Click to establish connection"}
           </p>

           <AudioVisualizer active={agentSpeaking || isRecording} mode={isRecording ? 'input' : 'output'} />
        </section>

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
    </div>
  );
}

const AudioVisualizer = ({ active, mode }) => {
    // A simple CSS height-based visualizer
    const bars = 15;
    const [heights, setHeights] = useState(Array(bars).fill(10));

    useEffect(() => {
        if (!active) {
            setHeights(Array(bars).fill(4));
            return;
        }
        
        const interval = setInterval(() => {
            setHeights(Array.from({ length: bars }, () => 
                Math.random() * 40 + 10
            ));
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
