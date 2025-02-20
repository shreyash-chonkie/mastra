import { FrameDirection } from './frame-direction';
import type { FrameObserver } from './frame-observer';
import type { BaseFrame } from './frames';
import type { MetricsData } from './metrics/frame-processor-metrics';

export type EventHandler = (processor: FrameProcessor, ...args: any[]) => Promise<void> | void;

export interface FrameProcessor {
  /**
   * Unique identifier for the processor
   */
  readonly id: string;

  /**
   * Name of the processor
   */
  readonly name: string;

  /**
   * Whether interruptions are allowed for this processor
   */
  readonly interruptionsAllowed: boolean;

  /**
   * Whether metrics are enabled for this processor
   */
  readonly metricsEnabled: boolean;

  /**
   * Whether this processor can generate metrics
   */
  canGenerateMetrics(): boolean;

  /**
   * Set core metrics data
   */
  setCoreMetricsData(data: MetricsData): void;

  /**
   * Start time-to-first-byte metrics
   */
  startTtfbMetrics(): Promise<void>;

  /**
   * Stop time-to-first-byte metrics
   */
  stopTtfbMetrics(): Promise<void>;

  /**
   * Start processing metrics
   */
  startProcessingMetrics(): Promise<void>;

  /**
   * Stop processing metrics
   */
  stopProcessingMetrics(): Promise<void>;

  /**
   * Process an incoming frame
   */
  processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void>;

  /**
   * Queue a frame for processing
   */
  queueFrame(frame: BaseFrame, direction: FrameDirection): Promise<void>;

  /**
   * Push a frame to the next processor in the pipeline
   */
  pushFrame(frame: BaseFrame, direction: FrameDirection): Promise<void>;

  /**
   * Link this processor to another processor
   */
  link(processor: FrameProcessor): void;

  /**
   * Add an event handler
   */
  addEventHandler(event: string, handler: EventHandler): void;

  /**
   * Set the frame observer
   */
  setObserver(observer: FrameObserver): void;

  /**
   * Start the processor
   */
  start(): Promise<void>;

  /**
   * Stop the processor
   */
  stop(): Promise<void>;

  /**
   * Clean up resources
   */
  cleanup(): Promise<void>;

  /**
   * Pause processing frames
   */
  pauseProcessingFrames(): Promise<void>;

  /**
   * Resume processing frames
   */
  resumeProcessingFrames(): Promise<void>;
}
