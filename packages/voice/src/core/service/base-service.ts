import type { FrameProcessor } from '../frame-processor';
import type { BaseFrame } from '../frames';

type EventHandler = (event: string, data: any) => void;

/**
 * Base interface for all services. A service is responsible for
 * processing frames, such as text-to-speech or speech-to-text.
 */
export interface Service extends FrameProcessor {
  /**
   * Process a frame and return the result
   * This is a higher-level abstraction over processFrame
   */
  process(frame: BaseFrame): Promise<BaseFrame>;

  /**
   * Get service-specific configuration
   */
  getConfig(): ServiceConfig;

  /**
   * Add an event handler
   */
  addEventHandler(event: string, handler: EventHandler): void;

  /**
   * Emit an event
   */
  emit(event: string, data: any): void;

  /**
   * Start the service
   */
  start(): Promise<void>;

  /**
   * Stop the service
   */
  stop(): Promise<void>;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;
}

/**
 * Base configuration interface for all services
 */
export type ServiceConfig = {
  /**
   * API key for the service if required
   */
  apiKey?: string;

  /**
   * API endpoint for the service if required
   */
  endpoint?: string;

  /**
   * Service-specific options
   */
  options?: Record<string, any>;
};

/**
 * Base class for implementing services
 */
export abstract class BaseService implements Service {
  protected readonly _config: ServiceConfig;
  private eventHandlers: Map<string, EventHandler[]>;
  private nextProcessor: FrameProcessor | null = null;

  constructor(config?: ServiceConfig) {
    this._config = config || {
      apiKey: '',
      endpoint: '',
      options: {},
    };
    this.eventHandlers = new Map();
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
  abstract setObserver(observer: any): void;
  abstract pauseProcessingFrames(): Promise<void>;
  abstract resumeProcessingFrames(): Promise<void>;

  abstract process(frame: BaseFrame): Promise<BaseFrame>;

  getConfig(): ServiceConfig {
    return this._config;
  }

  /**
   * Add an event handler
   */
  addEventHandler(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Emit an event
   */
  protected emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(event, data));
  }

  /**
   * Link to next processor in chain
   */
  protected async next(frame: BaseFrame): Promise<BaseFrame> {
    if (this.nextProcessor) {
      return this.nextProcessor.processFrame(frame, 'downstream');
    }
    return frame;
  }

  /**
   * Link this processor to the next one in the chain
   */
  link(processor: FrameProcessor): void {
    this.nextProcessor = processor;
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    // Base implementation - can be overridden
    this.emit('started', { id: this.id });
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    // Base implementation - can be overridden
    this.emit('stopped', { id: this.id });
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Base implementation - can be overridden
    this.eventHandlers.clear();
    this.nextProcessor = null;
  }

  /**
   * Process a frame in a specific direction
   */
  async processFrame(frame: BaseFrame, direction: 'upstream' | 'downstream'): Promise<BaseFrame> {
    if (direction === 'downstream') {
      return this.process(frame);
    }
    return frame;
  }
}
