class AudioInputProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameCount = 0;
    this._buffer = new Float32Array(2048); // Larger buffer
    this._bufferIndex = 0;
    console.log('AudioInputProcessor initialized with 2048 sample buffer');
  }

  process(inputs, outputs, parameters) {
    try {
      const input = inputs[0];
      if (!input || input.length === 0) return true;

      const inputChannel = input[0];
      if (!inputChannel) return true;

      // Copy input data into our buffer
      for (let i = 0; i < inputChannel.length; i++) {
        this._buffer[this._bufferIndex++] = inputChannel[i];
      }

      // When buffer is full, send it
      if (this._bufferIndex >= this._buffer.length) {
        // Calculate audio stats
        const rms = Math.sqrt(this._buffer.reduce((sum, x) => sum + x * x, 0) / this._buffer.length);
        const peak = Math.max(...this._buffer.map(Math.abs));
        
        // Only send if we detect actual audio
        if (rms > 0.01) {
          this._frameCount++;
          
          // Normalize audio levels
          const gain = peak > 0.1 ? 0.7 / peak : 1.0;
          const normalizedBuffer = new Float32Array(this._buffer.length);
          for (let i = 0; i < this._buffer.length; i++) {
            normalizedBuffer[i] = this._buffer[i] * gain;
          }

          // Log stats periodically
          if (this._frameCount % 10 === 0) {
            console.log('Sending audio frame:', {
              frameCount: this._frameCount,
              rms,
              peak,
              gain,
              bufferSize: this._buffer.length
            });
          }

          this.port.postMessage({
            type: 'audio',
            timestamp: currentTime * 1000,
            data: normalizedBuffer,
            sampleRate: sampleRate,
            channels: 1,
            frameCount: this._frameCount
          });
        }

        // Reset buffer
        this._bufferIndex = 0;
      }

      return true;
    } catch (error) {
      console.error('Error in audio processor:', error);
      return true;
    }
  }
}

registerProcessor('audio-input-processor', AudioInputProcessor);
