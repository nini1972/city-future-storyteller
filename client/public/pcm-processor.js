class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Int16Array(2048);
        this.bufferIndex = 0;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input.length > 0) {
            const channel = input[0];
            for (let i = 0; i < channel.length; i++) {
                // Convert float [-1.0, 1.0] to int16
                let s = Math.max(-1, Math.min(1, channel[i]));
                this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;

                if (this.bufferIndex >= this.buffer.length) {
                    this.port.postMessage(this.buffer);
                    this.buffer = new Int16Array(2048);
                    this.bufferIndex = 0;
                }
            }
        }
        return true;
    }
}

registerProcessor('pcm-processor', PCMProcessor);
