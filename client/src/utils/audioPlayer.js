export class AudioPlayer {
    constructor() {
        this.audioContext = null;
        this.nextTime = 0;
        this.isPlaying = false;
        this.onPlaybackStatus = null; // Callback to sync UI
    }

    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000 // Gemini returns 24kHz audio
            });
            this.nextTime = this.audioContext.currentTime;
        }
    }

    addAudioChunk(base64Audio) {
        if (!this.audioContext) this.init();
        
        // Base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Gemini returns 16-bit PCM little-endian
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
        buffer.getChannelData(0).set(floatData);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        const startTime = Math.max(this.nextTime, this.audioContext.currentTime);
        source.start(startTime);
        
        // Set playing state
        if (!this.isPlaying && this.onPlaybackStatus) {
            this.isPlaying = true;
            this.onPlaybackStatus(true);
        }

        source.onended = () => {
             // Heuristic: if current time catches up to nextTime, we stopped playing
             if (this.audioContext.currentTime >= this.nextTime - 0.1) {
                 this.isPlaying = false;
                 if (this.onPlaybackStatus) this.onPlaybackStatus(false);
             }
        }

        this.nextTime = startTime + buffer.duration;
    }

    stop() {
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
            this.isPlaying = false;
            if (this.onPlaybackStatus) this.onPlaybackStatus(false);
        }
    }
}
