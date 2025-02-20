import { describe, it, expect, beforeEach, vi } from 'vitest';

import { BaseFrameProcessor } from './base-frame-processor';
import { FrameDirection } from './frame-direction';
import type { FrameObserver } from './frame-observer';
import type { FrameProcessor } from './frame-processor';
import type { BaseFrame } from './frames';
import { Pipeline } from './pipeline';

class TestProcessor extends BaseFrameProcessor {
  public processedFrames: Array<[BaseFrame, FrameDirection]> = [];

  constructor(name?: string) {
    super(name);
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    this.processedFrames.push([frame, direction]);
    await super.processFrame(frame, direction);
  }

  canGenerateMetrics(): boolean {
    return true;
  }
}

class TestObserver implements FrameObserver {
  public observations: Array<{
    source: FrameProcessor;
    destination: FrameProcessor;
    frame: BaseFrame;
    direction: FrameDirection;
    timestamp: number;
  }> = [];

  async onPushFrame(
    source: FrameProcessor,
    destination: FrameProcessor,
    frame: BaseFrame,
    direction: FrameDirection,
    timestamp: number,
  ): Promise<void> {
    this.observations.push({ source, destination, frame, direction, timestamp });
  }
}

describe('Pipeline', () => {
  let pipeline: Pipeline;
  let processor1: TestProcessor;
  let processor2: TestProcessor;
  let observer: TestObserver;

  beforeEach(() => {
    pipeline = new Pipeline({
      name: 'TestPipeline',
      enableMetrics: true,
      allowInterruptions: true,
    });
    processor1 = new TestProcessor('Processor1');
    processor2 = new TestProcessor('Processor2');
    observer = new TestObserver();
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should initialize with correct options', () => {
    expect(pipeline.name).toBe('TestPipeline');
    expect(pipeline.metricsEnabled).toBe(true);
    expect(pipeline.interruptionsAllowed).toBe(true);
  });

  it('should link processors correctly', () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    expect(processor1['_next']).toBe(processor2);
    expect(processor2['_prev']).toBe(processor1);
  });

  it('should process frames downstream', async () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    const frame: BaseFrame = {
      type: 'test',
      timestamp: Date.now(),
    };

    await pipeline.processFrame(frame, FrameDirection.DOWNSTREAM);

    expect(processor1.processedFrames).toHaveLength(1);
    expect(processor1.processedFrames[0][0]).toBe(frame);
    expect(processor1.processedFrames[0][1]).toBe(FrameDirection.DOWNSTREAM);

    expect(processor2.processedFrames).toHaveLength(1);
    expect(processor2.processedFrames[0][0]).toBe(frame);
    expect(processor2.processedFrames[0][1]).toBe(FrameDirection.DOWNSTREAM);
  });

  it('should process frames upstream', async () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    const frame: BaseFrame = {
      type: 'test',
      timestamp: Date.now(),
    };

    await pipeline.processFrame(frame, FrameDirection.UPSTREAM);

    expect(processor2.processedFrames).toHaveLength(1);
    expect(processor2.processedFrames[0][0]).toBe(frame);
    expect(processor2.processedFrames[0][1]).toBe(FrameDirection.UPSTREAM);

    expect(processor1.processedFrames).toHaveLength(1);
    expect(processor1.processedFrames[0][0]).toBe(frame);
    expect(processor1.processedFrames[0][1]).toBe(FrameDirection.UPSTREAM);
  });

  it('should propagate observers to processors', () => {
    pipeline.setObserver(observer);
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    expect(processor1['_observer']).toBe(observer);
    expect(processor2['_observer']).toBe(observer);
  });

  it('should manage processor lifecycle', async () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    await pipeline.start();
    expect(processor1['_isStopped']).toBe(false);
    expect(processor2['_isStopped']).toBe(false);

    await pipeline.stop();
    expect(processor1['_isStopped']).toBe(true);
    expect(processor2['_isStopped']).toBe(true);

    await pipeline.cleanup();
    expect(pipeline['_processors']).toHaveLength(0);
  });

  it('should pause and resume all processors', async () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    await pipeline.pauseProcessingFrames();
    expect(processor1['_isPaused']).toBe(true);
    expect(processor2['_isPaused']).toBe(true);

    await pipeline.resumeProcessingFrames();
    expect(processor1['_isPaused']).toBe(false);
    expect(processor2['_isPaused']).toBe(false);
  });

  it('should track metrics for processors', () => {
    pipeline.addProcessor(processor1);
    pipeline.addProcessor(processor2);

    const metricsProcessors = pipeline.getProcessorsWithMetrics();
    expect(metricsProcessors).toHaveLength(2);
    expect(metricsProcessors).toContain(processor1);
    expect(metricsProcessors).toContain(processor2);
  });
});
