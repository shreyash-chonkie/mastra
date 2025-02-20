import { FrameDirection } from './frame-direction';
import type { FrameObserver } from './frame-observer';
import type { FrameProcessor, EventHandler } from './frame-processor';
import type { BaseFrame } from './frames';
import { FrameProcessorMetrics, type MetricsData } from './metrics/frame-processor-metrics';

export abstract class BaseFrameProcessor implements FrameProcessor {
  private static nextId = 0;
  private readonly _id: string;
  private readonly _name: string;
  protected _next: FrameProcessor | null = null;
  protected _prev: FrameProcessor | null = null;
  protected _interruptionsAllowed = false;
  protected _metricsEnabled = false;
  protected _inputQueue: Array<[BaseFrame, FrameDirection]> = [];
  protected _outputQueue: Array<[BaseFrame, FrameDirection]> = [];
  protected _isProcessing = false;
  protected _isStopped = false;
  protected _isPaused = false;
  protected _eventHandlers: Map<string, EventHandler[]> = new Map();
  protected _observer: FrameObserver | null = null;
  protected _metrics: FrameProcessorMetrics;

  constructor(name?: string) {
    this._id = `processor_${BaseFrameProcessor.nextId++}`;
    this._name = name || `${this.constructor.name}#${this._id}`;
    this._metrics = new FrameProcessorMetrics();
    this._metrics.setProcessorName(this._name);
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get interruptionsAllowed(): boolean {
    return this._interruptionsAllowed;
  }

  get metricsEnabled(): boolean {
    return this._metricsEnabled;
  }

  canGenerateMetrics(): boolean {
    return false;
  }

  setCoreMetricsData(data: MetricsData): void {
    this._metrics.setProcessorName(this._name);
  }

  async startTtfbMetrics(): Promise<void> {
    if (this.canGenerateMetrics() && this.metricsEnabled) {
      this._metrics.startTtfbMetrics();
    }
  }

  async stopTtfbMetrics(): Promise<void> {
    if (this.canGenerateMetrics() && this.metricsEnabled) {
      const metrics = this._metrics.stopTtfbMetrics();
      await this.pushMetricsFrame(metrics);
    }
  }

  async startProcessingMetrics(): Promise<void> {
    if (this.canGenerateMetrics() && this.metricsEnabled) {
      this._metrics.startProcessingMetrics();
    }
  }

  async stopProcessingMetrics(): Promise<void> {
    if (this.canGenerateMetrics() && this.metricsEnabled) {
      const metrics = this._metrics.stopProcessingMetrics();
      await this.pushMetricsFrame(metrics);
    }
  }

  link(processor: FrameProcessor): void {
    this._next = processor;
    if (processor instanceof BaseFrameProcessor) {
      processor._prev = this;
    }
    console.debug(`Linking ${this.name} -> ${processor.name}`);
  }

  addEventHandler(event: string, handler: EventHandler): void {
    const handlers = this._eventHandlers.get(event) || [];
    handlers.push(handler);
    this._eventHandlers.set(event, handlers);
  }

  setObserver(observer: FrameObserver): void {
    this._observer = observer;
  }

  async queueFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (this._isStopped) return;

    this._inputQueue.push([frame, direction]);
    await this.processNextFrame();
  }

  async pushFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    if (this._isStopped) return;

    this._outputQueue.push([frame, direction]);
    await this.processNextOutput();
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    // Base implementation just forwards the frame
    await this.pushFrame(frame, direction);
  }

  async start(): Promise<void> {
    this._isStopped = false;
    this._isProcessing = false;
    this._isPaused = false;
    await this.processNextFrame();
    await this.processNextOutput();
  }

  async stop(): Promise<void> {
    this._isStopped = true;
  }

  async cleanup(): Promise<void> {
    await this.stop();
    this._inputQueue = [];
    this._outputQueue = [];
    this._next = null;
    this._prev = null;
    this._eventHandlers.clear();
    this._observer = null;
  }

  async pauseProcessingFrames(): Promise<void> {
    this._isPaused = true;
  }

  async resumeProcessingFrames(): Promise<void> {
    this._isPaused = false;
    await this.processNextFrame();
  }

  protected async processNextFrame(): Promise<void> {
    if (this._isProcessing || this._isStopped || this._isPaused || this._inputQueue.length === 0) {
      return;
    }

    this._isProcessing = true;
    try {
      const [frame, direction] = this._inputQueue.shift()!;
      await this.processFrame(frame, direction);
    } finally {
      this._isProcessing = false;
    }

    // Process next frame if available
    await this.processNextFrame();
  }

  protected async processNextOutput(): Promise<void> {
    if (this._isStopped || this._outputQueue.length === 0) {
      return;
    }

    const [frame, direction] = this._outputQueue.shift()!;
    const timestamp = Date.now();

    if (direction === FrameDirection.DOWNSTREAM && this._next) {
      console.debug(`Pushing ${frame.type} from ${this.name} to ${this._next.name}`);
      if (this._observer) {
        await this._observer.onPushFrame(this, this._next, frame, direction, timestamp);
      }
      await this._next.queueFrame(frame, direction);
    } else if (direction === FrameDirection.UPSTREAM && this._prev) {
      console.debug(`Pushing ${frame.type} upstream from ${this.name} to ${this._prev.name}`);
      if (this._observer) {
        await this._observer.onPushFrame(this, this._prev, frame, direction, timestamp);
      }
      await this._prev.queueFrame(frame, direction);
    }

    // Process next output if available
    await this.processNextOutput();
  }

  protected async pushMetricsFrame(metrics: MetricsData): Promise<void> {
    if (Object.keys(metrics).length > 0) {
      const frame: BaseFrame = {
        type: 'metrics',
        timestamp: Date.now(),
        metadata: metrics,
      };
      await this.pushFrame(frame, FrameDirection.DOWNSTREAM);
    }
  }

  protected async emitEvent(event: string, ...args: any[]): Promise<void> {
    const handlers = this._eventHandlers.get(event) || [];
    for (const handler of handlers) {
      await Promise.resolve(handler(this, ...args));
    }
  }
}
