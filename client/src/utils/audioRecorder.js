export class AudioRecorder {
    constructor(onData) {
        this.onData = onData;
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.source = null;
    }

    async start() {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000 // Required by Gemini Live API
        });

        await this.audioContext.audioWorklet.addModule('/pcm-processor.js');

        this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.processor = new AudioWorkletNode(this.audioContext, 'pcm-processor');

        this.processor.port.onmessage = (e) => {
            const pcmData = e.data; // Int16Array
            // Convert to base64
            const buffer = new ArrayBuffer(pcmData.length * 2);
            const view = new DataView(buffer);
            pcmData.forEach((sample, i) => {
                view.setInt16(i * 2, sample, true); // little-endian
            });
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            
            this.onData(base64);
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    stop() {
        if (this.processor) {
            this.processor.disconnect();
            this.source.disconnect();
            this.processor = null;
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }
}
