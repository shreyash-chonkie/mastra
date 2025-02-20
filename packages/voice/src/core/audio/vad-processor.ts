import { FrameDirection } from '../frame-direction';
import type { BaseFrame, Frame } from '../frames';
import { BaseService } from '../service/base-service';
import type { ServiceConfig } from '../service/base-service';

export interface VADConfig extends ServiceConfig {
  // Energy threshold for voice detection (0-1)
  energyThreshold?: number;
  // Minimum duration of voice activity to trigger start (ms)
  minSpeechDuration?: number;
  // Duration of silence to trigger stop (ms)
  silenceDuration?: number;
  // Sample rate of audio
  sampleRate?: number;
}

export interface VADState {
  isActive: boolean;
  energy: number;
  timestamp: number;
}

/**
 * Voice Activity Detection processor that analyzes audio frames to detect speech
 */
export class VADProcessor extends BaseService {
  private config: Required<VADConfig>;
  private state: VADState;
  private lastVoiceTimestamp: number;
  private voiceBuffer: Float32Array[];
  private silenceStartTime: number;
  private isRunning: boolean = false;
  private lastStateEmitted: boolean | null = null;

  readonly id = 'vad-processor';
  readonly name = 'Voice Activity Detection';
  readonly interruptionsAllowed = true;
  readonly metricsEnabled = true;

  constructor(config?: Partial<VADConfig>) {
    const defaultConfig: Required<VADConfig> = {
      energyThreshold: 0.01,
      minSpeechDuration: 200,
      silenceDuration: 500,
      sampleRate: 48000,
      apiKey: '',
      endpoint: '',
      options: {},
    };

    super({ ...defaultConfig, ...config });

    this.config = { ...defaultConfig, ...config };
    this.state = {
      isActive: false,
      energy: 0,
      timestamp: 0,
    };

    this.lastVoiceTimestamp = 0;
    this.voiceBuffer = [];
    this.silenceStartTime = 0;
  }

  /**
   * Calculate RMS energy of an audio buffer
   */
  private calculateEnergy(buffer: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += buffer[i] * buffer[i];
    }
    return Math.sqrt(sum / buffer.length);
  }

  /**
   * Check if current frame contains voice activity
   */
  private detectVoice(frame: Frame & { type: 'audio' }): boolean {
    const energy = this.calculateEnergy(frame.data as Float32Array);
    const hasVoice = energy > this.config.energyThreshold;

    this.state.energy = energy;
    this.state.timestamp = frame.timestamp;

    if (hasVoice) {
      if (!this.state.isActive) {
        // Check if we've had enough continuous voice activity
        const timeSinceLastVoice = frame.timestamp - this.lastVoiceTimestamp;
        if (timeSinceLastVoice < this.config.minSpeechDuration) {
          this.voiceBuffer.push(frame.data as Float32Array);
        } else {
          // Clear old buffer if too much time has passed
          this.voiceBuffer = [frame.data as Float32Array];
        }

        if (
          this.voiceBuffer.length * ((frame.data as Float32Array).length / this.config.sampleRate) * 1000 >=
          this.config.minSpeechDuration
        ) {
          this.state.isActive = true;
          this.voiceBuffer = []; // Clear buffer once activated

          // Emit state change if needed
          if (this.lastStateEmitted !== true) {
            this.emit('vad_state_changed', this.state);
            this.lastStateEmitted = true;
          }
        }
      }
      this.lastVoiceTimestamp = frame.timestamp;
      this.silenceStartTime = 0;
    } else if (this.state.isActive) {
      // Track silence duration
      if (this.silenceStartTime === 0) {
        this.silenceStartTime = frame.timestamp;
      }

      // Check if silence has lasted long enough to stop
      if (frame.timestamp - this.silenceStartTime >= this.config.silenceDuration) {
        this.state.isActive = false;
        this.voiceBuffer = [];

        // Emit state change if needed
        if (this.lastStateEmitted !== false) {
          this.emit('vad_state_changed', this.state);
          this.lastStateEmitted = false;
        }
      }
    }

    return this.state.isActive;
  }

  async process(frame: BaseFrame): Promise<BaseFrame> {
    if (!this.isRunning || frame.type !== 'audio') {
      return this.next(frame);
    }

    const audioFrame = frame as Frame & { type: 'audio' };
    const hasVoice = this.detectVoice(audioFrame);

    // Emit energy updates even when state hasn't changed
    this.emit('vad_state_changed', this.state);

    // Only forward frames when voice is active
    if (hasVoice) {
      return this.next(frame);
    }

    // Return a dummy frame when no voice is detected
    return {
      type: 'audio',
      timestamp: frame.timestamp,
      data: new Float32Array(0),
      sampleRate: audioFrame.sampleRate,
      channels: audioFrame.channels,
    };
  }

  /**
   * Get current VAD state
   */
  getState(): VADState {
    return { ...this.state };
  }

  /**
   * Get current configuration
   */
  getConfig(): ServiceConfig {
    return this._config;
  }

  /**
   * Update VAD configuration
   */
  updateConfig(config: Partial<VADConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
    this._config = {
      ...this._config,
      ...config,
    };
  }

  /**
   * Start the VAD processor
   */
  async start(): Promise<void> {
    this.isRunning = true;
    this.lastStateEmitted = null;
    await super.start();
  }

  /**
   * Stop the VAD processor
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    this.state.isActive = false;
    this.voiceBuffer = [];
    this.lastStateEmitted = null;

    // Emit final inactive state
    this.emit('vad_state_changed', this.state);

    await super.stop();
  }

  /**
   * Clean up VAD resources
   */
  async cleanup(): Promise<void> {
    this.isRunning = false;
    this.state.isActive = false;
    this.voiceBuffer = [];
    this.lastVoiceTimestamp = 0;
    this.silenceStartTime = 0;
    this.lastStateEmitted = null;
    await super.cleanup();
  }
}
