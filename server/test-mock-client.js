import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', () => {
    console.log('Mock client connected to local proxy.');
    
    // Generate valid dummy PCM data (silence)
    const buf = Buffer.alloc(32000); 
    const b64 = buf.toString('base64');
    
    let active = true;
    const int = setInterval(() => {
        if (!active) {
            clearInterval(int);
            return;
        }
        ws.send(JSON.stringify({
            realtimeInput: {
                mediaChunks: [{
                    mimeType: 'audio/pcm',
                    data: b64
                }]
            }
        }));
    }, 500);

    setTimeout(() => {
        active = false;
        ws.send(JSON.stringify({clientContent: {turnComplete: true}}));
        console.log('Sent turnComplete');
    }, 3000);
});

ws.on('message', m => {
    const data = JSON.parse(m.toString());
    if (data.toolCall) {
        console.log('Mock client received toolCall confirmation!');
        setTimeout(() => process.exit(0), 1000);
    }
});

ws.on('close', () => console.log('Mock client closed.'));
ws.on('error', e => console.error(e));
