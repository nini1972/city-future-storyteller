import express from 'express';
import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
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

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Test route
app.get('/', (req, res) => {
    res.send({ status: 'City Futures Storyteller Backend is Running!' });
});

wss.on('connection', (ws) => {
    console.log('Client connected to proxy WebSocket');
    
    // Create a new instance of the Gemini Live Client for this connection
    const geminiClient = new GeminiLiveClient(
        process.env.GEMINI_API_KEY, 
        (data) => {
            // Forward data from Gemini to the client
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(data));
            }
        }
    );

    // Initial connection to Gemini
    geminiClient.connect().catch(console.error);

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            // Forward specific real-time messages to the Gemini Live API
            if (parsed.realtimeInput || parsed.clientContent) {
                 geminiClient.send(parsed);
            }
        } catch (e) {
            console.error('Error parsing client message:', e);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        geminiClient.disconnect();
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
