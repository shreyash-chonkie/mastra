import { BaseFrameProcessor } from './base-frame-processor';
import { FrameDirection } from './frame-direction';
import type { FrameObserver } from './frame-observer';
import type { FrameProcessor } from './frame-processor';
import type { BaseFrame } from './frames';
import type { MetricsData } from './metrics/frame-processor-metrics';
import type { Service } from './service/base-service';
import type { Transport } from './transport/base-transport';

export interface PipelineOptions {
  name?: string;
  enableMetrics?: boolean;
  enableUsageMetrics?: boolean;
  allowInterruptions?: boolean;
  reportOnlyInitialTtfb?: boolean;
}

/**
 * A Pipeline is a special type of FrameProcessor that can contain and manage
 * other processors. It handles frame flow between processors and manages the
 * lifecycle of all contained processors.
 *
 * A pipeline can contain both transports and services:
 * - Transports handle I/O operations (e.g. audio input/output)
 * - Services handle frame processing (e.g. text-to-speech)
 */
export class Pipeline extends BaseFrameProcessor {
  private readonly _processors: Array<Transport | Service> = [];
  private readonly _enableUsageMetrics: boolean;
  private readonly _reportOnlyInitialTtfb: boolean;
  protected _observer: FrameObserver | null = null;

  constructor(options: PipelineOptions = {}) {
    super(options.name);
    this._metricsEnabled = options.enableMetrics ?? false;
    this._enableUsageMetrics = options.enableUsageMetrics ?? false;
    this._interruptionsAllowed = options.allowInterruptions ?? false;
    this._reportOnlyInitialTtfb = options.reportOnlyInitialTtfb ?? false;
  }

  /**
   * Add a processor (transport or service) to the pipeline
   */
  addProcessor(processor: Transport | Service): void {
    if (this._processors.length > 0) {
      // Link to previous processor
      const lastProcessor = this._processors[this._processors.length - 1];
      if (lastProcessor) {
        // If last processor is a transport, use its output
        if ('input' in lastProcessor && 'output' in lastProcessor) {
          lastProcessor.output().link(processor);
        } else {
          lastProcessor.link(processor);
        }
      }
    }

    this._processors.push(processor);

    // Configure processor
    if (processor instanceof BaseFrameProcessor && this._observer) {
      processor.setObserver(this._observer);
    }
  }

  /**
   * Set the observer for the pipeline and all processors
   */
  setObserver(observer: FrameObserver): void {
    this._observer = observer;
    for (const processor of this._processors) {
      if (processor instanceof BaseFrameProcessor) {
        processor.setObserver(observer);
      }
    }
  }

  /**
   * Get all processors that can generate metrics
   */
  getProcessorsWithMetrics(): FrameProcessor[] {
    return this._processors.filter(p => p.canGenerateMetrics());
  }

  /**
   * Set core metrics data for all processors
   */
  setCoreMetricsData(data: MetricsData): void {
    for (const processor of this._processors) {
      processor.setCoreMetricsData(data);
    }
  }

  /**
   * Process a frame through the pipeline
   */
  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (this._processors.length === 0) {
      return;
    }

    // Start metrics if enabled
    if (this.metricsEnabled) {
      await this.startProcessingMetrics();
      await this.startTtfbMetrics();
    }

    try {
      if (direction === FrameDirection.DOWNSTREAM) {
        // Send to first processor
        const firstProcessor = this._processors[0];
        if (firstProcessor) {
          // If first processor is a transport, use its input
          if ('input' in firstProcessor && 'output' in firstProcessor) {
            await firstProcessor.input().queueFrame(frame, direction);
          } else {
            await firstProcessor.queueFrame(frame, direction);
          }
        }
      } else {
        // Send to last processor
        const lastProcessor = this._processors[this._processors.length - 1];
        if (lastProcessor) {
          // If last processor is a transport, use its output
          if ('input' in lastProcessor && 'output' in lastProcessor) {
            await lastProcessor.output().queueFrame(frame, direction);
          } else {
            await lastProcessor.queueFrame(frame, direction);
          }
        }
      }
    } finally {
      // Stop metrics if enabled
      if (this.metricsEnabled) {
        await this.stopProcessingMetrics();
        await this.stopTtfbMetrics();
      }
    }
  }

  /**
   * Start all processors in the pipeline
   */
  async start(): Promise<void> {
    for (const processor of this._processors) {
      await processor.start();
    }
  }

  /**
   * Stop all processors in the pipeline
   */
  async stop(): Promise<void> {
    for (const processor of this._processors) {
      await processor.stop();
    }
  }

  /**
   * Clean up all processors in the pipeline
   */
  async cleanup(): Promise<void> {
    for (const processor of this._processors) {
      await processor.cleanup();
    }
    this._processors.length = 0;
  }

  /**
   * Pause processing frames in all processors
   */
  async pauseProcessingFrames(): Promise<void> {
    for (const processor of this._processors) {
      await processor.pauseProcessingFrames();
    }
  }

  /**
   * Resume processing frames in all processors
   */
  async resumeProcessingFrames(): Promise<void> {
    for (const processor of this._processors) {
      await processor.resumeProcessingFrames();
    }
  }
}
