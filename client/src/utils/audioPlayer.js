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
        
        // CRITICAL: Resume context if suspended by browser autoplay policy
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => this._scheduleChunk(base64Audio));
            return;
        }
        this._scheduleChunk(base64Audio);
    }

    _scheduleChunk(base64Audio) {
        // Base64 to ArrayBuffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Gemini returns 16-bit PCM little-endian at 24kHz
        const pcmData = new Int16Array(bytes.buffer);
        const floatData = new Float32Array(pcmData.length);
        for (let i = 0; i < pcmData.length; i++) {
            floatData[i] = pcmData[i] / 32768.0;
        }

        const buffer = this.audioContext.createBuffer(1, floatData.length, 24000);
        buffer.getChannelData(0).set(floatData);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;

        // GainNode ensures volume is at 1.0 and audio reaches the output
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        const startTime = Math.max(this.nextTime, this.audioContext.currentTime);
        source.start(startTime);
        
        if (!this.isPlaying && this.onPlaybackStatus) {
            this.isPlaying = true;
            this.onPlaybackStatus(true);
        }

        source.onended = () => {
             if (this.audioContext && this.audioContext.currentTime >= this.nextTime - 0.1) {
                 this.isPlaying = false;
                 if (this.onPlaybackStatus) this.onPlaybackStatus(false);
             }
        };

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
