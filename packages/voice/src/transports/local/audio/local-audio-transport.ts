import { BaseFrameProcessor } from '../../../core/base-frame-processor';
import { FrameDirection } from '../../../core/frame-direction';
import type { BaseFrame, AudioFrame } from '../../../core/frames';
import { BaseTransport, type TransportConfig } from '../../../core/transport/base-transport';

export interface LocalAudioTransportConfig extends TransportConfig {
  /**
   * Whether to enable microphone input
   */
  inputEnabled: boolean;

  /**
   * Whether to enable speaker output
   */
  outputEnabled: boolean;

  /**
   * Sample rate in Hz (default: 44100)
   */
  sampleRate?: number;

  /**
   * Number of channels (default: 1)
   */
  channels?: number;

  /**
   * Buffer size in samples (default: 2048)
   */
  bufferSize?: number;
}

/**
 * Input processor that captures audio from the microphone
 */
class AudioInputProcessor extends BaseFrameProcessor {
  private _audioContext: AudioContext | null = null;
  private _mediaStream: MediaStream | null = null;
  private _sourceNode: MediaStreamAudioSourceNode | null = null;
  private _workletNode: AudioWorkletNode | null = null;
  _lastFrame: AudioFrame | null = null; // For visualization
  private readonly _config: LocalAudioTransportConfig;

  constructor(config: LocalAudioTransportConfig) {
    super('AudioInput');
    // Initialize config with defaults
    this._config = {
      inputEnabled: false,
      outputEnabled: false,
      sampleRate: 48000,
      channels: 1,
      bufferSize: 1024,
      ...config,
    };
  }

  get config(): LocalAudioTransportConfig {
    return this._config;
  }

  async start(): Promise<void> {
    if (!this.config.inputEnabled) return;

    try {
      console.log('Starting audio input with config:', this.config);

      // Create audio context
      this._audioContext = new AudioContext({
        sampleRate: this.config.sampleRate ?? 48000,
        latencyHint: 'interactive',
      });

      console.log('Audio context created with sample rate:', this._audioContext.sampleRate);

      // Load audio worklet
      console.log('Loading audio worklet...');
      await this._audioContext.audioWorklet.addModule('./audio-processor.js');
      console.log('Audio worklet loaded successfully');

      // Request microphone access
      console.log('Requesting microphone access...');
      this._mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: this.config.channels ?? 1,
          sampleRate: this.config.sampleRate ?? 48000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      console.log('Microphone access granted');

      // Create nodes
      this._sourceNode = this._audioContext.createMediaStreamSource(this._mediaStream);
      this._workletNode = new AudioWorkletNode(this._audioContext, 'audio-input-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0, // We don't need output since we're just recording
        channelCount: this.config.channels ?? 1,
        processorOptions: {
          bufferSize: this.config.bufferSize ?? 1024,
        },
      });

      // Handle audio data from worklet
      this._workletNode.port.onmessage = async event => {
        const { type, timestamp, data, sampleRate, channels, frameCount } = event.data;

        if (frameCount % 10 === 0) {
          console.log('Transport received frame:', {
            frameCount,
            dataLength: data.length,
            sampleRate,
            channels,
          });
        }

        // Create frame with exact buffer copy
        const frame: AudioFrame = {
          type: 'audio',
          timestamp,
          data: data instanceof Float32Array ? data : new Float32Array(data),
          sampleRate,
          channels,
        };

        // Store last frame for visualization
        this._lastFrame = frame;

        // Process frame
        await this.processFrame(frame, FrameDirection.DOWNSTREAM);
      };

      // Connect nodes
      this._sourceNode.connect(this._workletNode);
      console.log('Audio nodes connected');
    } catch (error) {
      console.error('Failed to start audio input:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this._workletNode) {
      this._workletNode.disconnect();
      this._workletNode = null;
    }
    if (this._sourceNode) {
      this._sourceNode.disconnect();
      this._sourceNode = null;
    }
    if (this._mediaStream) {
      this._mediaStream.getTracks().forEach(track => track.stop());
      this._mediaStream = null;
    }
    if (this._audioContext) {
      await this._audioContext.close();
      this._audioContext = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (frame.type === 'audio') {
      const audioFrame = frame as AudioFrame;
      console.log('Processing frame in input processor:', {
        dataLength: audioFrame.data.length,
        sampleRate: audioFrame.sampleRate,
        channels: audioFrame.channels,
      });

      // Emit frame processed event
      await this.emitEvent('frame_processed', frame);
    }

    // Forward frame
    await super.processFrame(frame, direction);
  }
}

/**
 * Output processor that plays audio through speakers
 */
class AudioOutputProcessor extends BaseFrameProcessor {
  private _audioContext: AudioContext | null = null;
  private _gainNode: GainNode | null = null;
  private readonly _config: LocalAudioTransportConfig;

  constructor(config: LocalAudioTransportConfig) {
    super('AudioOutput');
    // Initialize config with defaults
    this._config = {
      inputEnabled: false,
      outputEnabled: false,
      sampleRate: 48000,
      channels: 1,
      bufferSize: 1024,
      ...config,
    };
  }

  get config(): LocalAudioTransportConfig {
    return this._config;
  }

  async start(): Promise<void> {
    if (!this.config.outputEnabled) return;

    this._audioContext = new AudioContext({
      sampleRate: this.config.sampleRate ?? 48000,
      latencyHint: 'interactive',
    });

    // Create gain node for volume control
    this._gainNode = this._audioContext.createGain();
    this._gainNode.gain.value = 0.5; // Reduce volume to help with feedback
    this._gainNode.connect(this._audioContext.destination);
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (!this.config.outputEnabled || !this._audioContext || !this._gainNode) return;

    if (frame.type === 'audio') {
      const audioFrame = frame as AudioFrame;

      // Create buffer with the exact frame size
      const buffer = this._audioContext.createBuffer(
        audioFrame.channels,
        audioFrame.data.length,
        audioFrame.sampleRate,
      );

      // Copy data to buffer
      buffer.copyToChannel(audioFrame.data, 0);

      // Create and configure source
      const source = this._audioContext.createBufferSource();
      source.buffer = buffer;

      // Use a new gain node for each chunk to avoid interference
      const chunkGain = this._audioContext.createGain();
      chunkGain.gain.value = 1.0; // Start at full volume

      // Connect the chain
      source.connect(chunkGain);
      chunkGain.connect(this._gainNode);

      // Schedule the playback
      const startTime = this._audioContext.currentTime;
      source.start(startTime);

      // Fade in/out to reduce pops
      const fadeTime = 0.002; // 2ms fade
      chunkGain.gain.setValueAtTime(0, startTime);
      chunkGain.gain.linearRampToValueAtTime(1, startTime + fadeTime);
      chunkGain.gain.setValueAtTime(1, startTime + (buffer.duration - fadeTime));
      chunkGain.gain.linearRampToValueAtTime(0, startTime + buffer.duration);

      // Cleanup
      setTimeout(
        () => {
          chunkGain.disconnect();
        },
        (buffer.duration + 0.1) * 1000,
      );
    }

    await super.processFrame(frame, direction);
  }

  async stop(): Promise<void> {
    if (this._gainNode) {
      this._gainNode.disconnect();
      this._gainNode = null;
    }
    if (this._audioContext) {
      await this._audioContext.close();
      this._audioContext = null;
    }
  }

  async cleanup(): Promise<void> {
    await this.stop();
  }

  setVolume(value: number) {
    if (this._gainNode) {
      this._gainNode.gain.value = Math.max(0, Math.min(1, value));
    }
  }
}

/**
 * Transport that handles local audio I/O using the Web Audio API
 */
export class LocalAudioTransport extends BaseTransport {
  private readonly _inputProcessor: AudioInputProcessor;
  private readonly _outputProcessor: AudioOutputProcessor;
  private readonly _localConfig: LocalAudioTransportConfig;

  readonly id: string;
  readonly name: string = 'LocalAudioTransport';
  readonly interruptionsAllowed: boolean = true;
  readonly metricsEnabled: boolean = true;

  constructor(config: LocalAudioTransportConfig) {
    super(config);
    this.id = `local_audio_${Date.now()}`;
    // Store the full config
    this._localConfig = {
      inputEnabled: false,
      outputEnabled: false,
      sampleRate: 48000,
      channels: 1,
      bufferSize: 1024,
      ...config,
    };
    this._inputProcessor = new AudioInputProcessor(this._localConfig);
    this._outputProcessor = new AudioOutputProcessor(this._localConfig);
  }

  input(): AudioInputProcessor {
    return this._inputProcessor;
  }

  output(): AudioOutputProcessor {
    return this._outputProcessor;
  }

  async start(): Promise<void> {
    await this._inputProcessor.start();
    await this._outputProcessor.start();
  }

  async stop(): Promise<void> {
    await this._inputProcessor.stop();
    await this._outputProcessor.stop();
  }

  async cleanup(): Promise<void> {
    await this._inputProcessor.cleanup();
    await this._outputProcessor.cleanup();
  }

  // Override getConfig to return the correct type
  getConfig(): LocalAudioTransportConfig {
    return this._localConfig;
  }

  // Forward other FrameProcessor methods to input processor
  canGenerateMetrics(): boolean {
    return this._inputProcessor.canGenerateMetrics();
  }

  setCoreMetricsData(data: any): void {
    this._inputProcessor.setCoreMetricsData(data);
  }

  async startTtfbMetrics(): Promise<void> {
    await this._inputProcessor.startTtfbMetrics();
  }

  async stopTtfbMetrics(): Promise<void> {
    await this._inputProcessor.stopTtfbMetrics();
  }

  async startProcessingMetrics(): Promise<void> {
    await this._inputProcessor.startProcessingMetrics();
  }

  async stopProcessingMetrics(): Promise<void> {
    await this._inputProcessor.stopProcessingMetrics();
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    // Process the frame in the transport first
    if (frame.type === 'audio') {
      const audioFrame = frame as AudioFrame;

      // Analyze audio content
      const hasAudio = audioFrame.data.some(sample => Math.abs(sample) > 0.01);
      console.log('Processing audio frame in transport:', {
        hasAudio,
        dataLength: audioFrame.data.length,
        firstSample: audioFrame.data[0],
        lastSample: audioFrame.data[audioFrame.data.length - 1],
      });

      // Emit frame processed event from transport
      await this.emitEvent('frame_processed', frame);
    }

    // Forward to input processor for further processing
    await this._inputProcessor.processFrame(frame, direction);
  }

  async queueFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    await this._inputProcessor.queueFrame(frame, direction);
  }

  async pushFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    await this._inputProcessor.pushFrame(frame, direction);
  }

  link(processor: BaseFrameProcessor): void {
    this._inputProcessor.link(processor);
  }

  addEventHandler(event: string, handler: any): void {
    this._inputProcessor.addEventHandler(event, handler);
  }

  setObserver(observer: any): void {
    this._inputProcessor.setObserver(observer);
    this._outputProcessor.setObserver(observer);
  }

  async pauseProcessingFrames(): Promise<void> {
    await this._inputProcessor.pauseProcessingFrames();
    await this._outputProcessor.pauseProcessingFrames();
  }

  async resumeProcessingFrames(): Promise<void> {
    await this._inputProcessor.resumeProcessingFrames();
    await this._outputProcessor.resumeProcessingFrames();
  }
}
