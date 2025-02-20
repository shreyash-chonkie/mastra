import { BaseFrameProcessor } from '../base-frame-processor';
import { FrameDirection } from '../frame-direction';
import type { BaseFrame } from '../frames';

export interface AudioFrame extends BaseFrame {
  type: 'audio';
  data: Float32Array;
  sampleRate: number;
  channels: number;
  metadata?: {
    timestamp?: number;
    format?: string;
    codec?: string;
    bitDepth?: number;
    [key: string]: any;
  };
}

export abstract class BaseAudioProcessor extends BaseFrameProcessor {
  protected _sampleRate: number;
  protected _channels: number;
  protected _bitDepth: number;

  constructor(options: { name: string; sampleRate?: number; channels?: number; bitDepth?: number }) {
    super(options.name);
    this._sampleRate = options.sampleRate ?? 44100;
    this._channels = options.channels ?? 1;
    this._bitDepth = options.bitDepth ?? 32;
  }

  /**
   * Check if a frame is an audio frame
   */
  protected isAudioFrame(frame: BaseFrame): frame is AudioFrame {
    return frame.type === 'audio';
  }

  /**
   * Process an audio frame
   */
  protected abstract processAudioFrame(frame: AudioFrame): Promise<void>;

  /**
   * Convert raw audio data to AudioFrame
   */
  protected createAudioFrame(data: Float32Array, metadata?: AudioFrame['metadata']): AudioFrame {
    return {
      type: 'audio',
      timestamp: Date.now(),
      data,
      sampleRate: this._sampleRate,
      channels: this._channels,
      metadata: {
        ...metadata,
        bitDepth: this._bitDepth,
      },
    };
  }

  /**
   * Process incoming frames
   */
  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (this.isAudioFrame(frame)) {
      await this.processAudioFrame(frame);
    }
    await super.processFrame(frame, direction);
  }

  /**
   * Get current audio configuration
   */
  getAudioConfig(): {
    sampleRate: number;
    channels: number;
    bitDepth: number;
  } {
    return {
      sampleRate: this._sampleRate,
      channels: this._channels,
      bitDepth: this._bitDepth,
    };
  }
}
