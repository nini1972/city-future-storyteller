import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GeminiLiveClient } from './geminiLiveClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/history', express.static(path.join(__dirname, 'public', 'history')));

// REST: gallery history endpoint
app.get('/api/history', (req, res) => {
    const logPath = path.join(__dirname, 'public', 'history', 'history.json');
    if (!fs.existsSync(logPath)) return res.json([]);
    try {
        const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read history' });
    }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Test route
app.get('/', (req, res) => {
    res.send({ status: 'City Futures Storyteller Backend is Running!' });
});

// REST: memory endpoint for Option 5
app.get('/api/memory/:city', (req, res) => {
    const logPath = path.join(__dirname, 'public', 'history', 'history.json');
    if (!fs.existsSync(logPath)) return res.json({ memory: [] });
    try {
        const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        const cityMemories = data
            .filter(d => d.city === req.params.city)
            .map(d => d.prompt);
        // Only return the last 5 to not blow up the prompt context
        res.json({ memory: cityMemories.slice(-5) });
    } catch (e) {
        res.status(500).json({ error: 'Failed to read memory' });
    }
});

wss.on('connection', (ws) => {
    console.log('Client connected to proxy WebSocket');

    let pendingSystemPrompt = null;
    let geminiClient = null;

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);

            // Handle configure message (sent before audio starts)
            if (parsed.type === 'configure') {
                pendingSystemPrompt = parsed.systemPrompt || null;
                const city = parsed.city || null;
                console.log(`Received configure message for city: ${city}. System prompt set.`);

                // Now create and connect Gemini with the custom prompt
                geminiClient = new GeminiLiveClient(
                    process.env.GEMINI_API_KEY,
                    (data) => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify(data));
                        }
                    }
                );
                geminiClient.connect(pendingSystemPrompt, city).catch(console.error);
                ws.send(JSON.stringify({ type: 'configured', status: 'ok' }));
                return;
            }

            // Forward audio/content messages to Gemini
            if (parsed.realtimeInput || parsed.clientContent) {
                if (geminiClient) geminiClient.send(parsed);
            }
        } catch (e) {
            console.error('Error parsing client message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (geminiClient) geminiClient.disconnect();
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
