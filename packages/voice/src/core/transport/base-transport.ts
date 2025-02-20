import type { FrameProcessor } from '../frame-processor';

/**
 * Base interface for all transports. A transport is responsible for
 * handling I/O operations, such as reading from a microphone or
 * writing to speakers.
 */
export interface Transport extends FrameProcessor {
  /**
   * Get the input processor that reads from the transport
   * For example, a microphone input or file reader
   */
  input(): FrameProcessor;

  /**
   * Get the output processor that writes to the transport
   * For example, speaker output or file writer
   */
  output(): FrameProcessor;

  /**
   * Get transport-specific configuration
   */
  getConfig(): TransportConfig;
}

/**
 * Base configuration interface for all transports
 */
export interface TransportConfig {
  /**
   * Whether input is enabled for this transport
   */
  inputEnabled: boolean;

  /**
   * Whether output is enabled for this transport
   */
  outputEnabled: boolean;

  /**
   * Sample rate for audio in Hz (e.g. 44100, 48000)
   */
  sampleRate?: number;

  /**
   * Number of audio channels (1 for mono, 2 for stereo)
   */
  channels?: number;

  /**
   * Bit depth for audio (e.g. 16, 32)
   */
  bitDepth?: number;
}

/**
 * Base class for implementing transports
 */
export abstract class BaseTransport implements Transport {
  protected readonly _config: TransportConfig;

  constructor(config: TransportConfig) {
    this._config = {
      inputEnabled: false, // Default to disabled
      outputEnabled: false, // Default to disabled
      sampleRate: 44100,
      channels: 1,
      bitDepth: 32,
      ...config,
    };
  }

  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly interruptionsAllowed: boolean;
  abstract readonly metricsEnabled: boolean;

  abstract canGenerateMetrics(): boolean;
  abstract setCoreMetricsData(data: any): void;
  abstract startTtfbMetrics(): Promise<void>;
  abstract stopTtfbMetrics(): Promise<void>;
  abstract startProcessingMetrics(): Promise<void>;
  abstract stopProcessingMetrics(): Promise<void>;
  abstract processFrame(frame: any, direction: any): Promise<void>;
  abstract queueFrame(frame: any, direction: any): Promise<void>;
  abstract pushFrame(frame: any, direction: any): Promise<void>;
  abstract link(processor: FrameProcessor): void;
  abstract addEventHandler(event: string, handler: any): void;
  abstract setObserver(observer: any): void;
  abstract start(): Promise<void>;
  abstract stop(): Promise<void>;
  abstract cleanup(): Promise<void>;
  abstract pauseProcessingFrames(): Promise<void>;
  abstract resumeProcessingFrames(): Promise<void>;

  abstract input(): FrameProcessor;
  abstract output(): FrameProcessor;

  getConfig(): TransportConfig {
    return this._config;
  }
}
