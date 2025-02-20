import { describe, it, expect, vi, beforeEach } from 'vitest';

import { BaseFrameProcessor } from './base-frame-processor';
import { FrameDirection } from './frame-direction';
import type { BaseFrame } from './frames';

// Test implementation of BaseFrameProcessor
class TestProcessor extends BaseFrameProcessor {
  public processedFrames: Array<[BaseFrame, FrameDirection]> = [];

  constructor(name?: string) {
    super(name);
  }

  async processFrame(frame: BaseFrame, direction: FrameDirection): Promise<void> {
    this.processedFrames.push([frame, direction]);
    await super.processFrame(frame, direction);
  }
}

describe('BaseFrameProcessor', () => {
  let processor: TestProcessor;
  let nextProcessor: TestProcessor;
  let prevProcessor: TestProcessor;

  beforeEach(() => {
    processor = new TestProcessor('TestProcessor');
    nextProcessor = new TestProcessor('NextProcessor');
    prevProcessor = new TestProcessor('PrevProcessor');
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  it('should initialize with correct properties', () => {
    expect(processor.id).toMatch(/^processor_\d+$/);
    expect(processor.name).toBe('TestProcessor');
    expect(processor.interruptionsAllowed).toBe(false);
    expect(processor.metricsEnabled).toBe(false);
  });

  it('should link processors correctly', () => {
    processor.link(nextProcessor);
    expect(nextProcessor['_prev']).toBe(processor);
    expect(processor['_next']).toBe(nextProcessor);
  });

  it('should process frames in downstream direction', async () => {
    processor.link(nextProcessor);

    const frame: BaseFrame = {
      type: 'test',
      timestamp: Date.now(),
    };

    await processor.queueFrame(frame, FrameDirection.DOWNSTREAM);

    expect(processor.processedFrames).toHaveLength(1);
    expect(processor.processedFrames[0][0]).toBe(frame);
    expect(processor.processedFrames[0][1]).toBe(FrameDirection.DOWNSTREAM);

    expect(nextProcessor.processedFrames).toHaveLength(1);
    expect(nextProcessor.processedFrames[0][0]).toBe(frame);
    expect(nextProcessor.processedFrames[0][1]).toBe(FrameDirection.DOWNSTREAM);
  });

  it('should process frames in upstream direction', async () => {
    prevProcessor.link(processor);

    const frame: BaseFrame = {
      type: 'test',
      timestamp: Date.now(),
    };

    await processor.queueFrame(frame, FrameDirection.UPSTREAM);

    expect(processor.processedFrames).toHaveLength(1);
    expect(processor.processedFrames[0][0]).toBe(frame);
    expect(processor.processedFrames[0][1]).toBe(FrameDirection.UPSTREAM);

    expect(prevProcessor.processedFrames).toHaveLength(1);
    expect(prevProcessor.processedFrames[0][0]).toBe(frame);
    expect(prevProcessor.processedFrames[0][1]).toBe(FrameDirection.UPSTREAM);
  });

  it('should stop processing frames after being stopped', async () => {
    processor.link(nextProcessor);
    await processor.stop();

    const frame: BaseFrame = {
      type: 'test',
      timestamp: Date.now(),
    };

    await processor.queueFrame(frame, FrameDirection.DOWNSTREAM);

    expect(processor.processedFrames).toHaveLength(0);
    expect(nextProcessor.processedFrames).toHaveLength(0);
  });

  it('should clean up resources properly', async () => {
    processor.link(nextProcessor);

    await processor.cleanup();

    expect(processor['_next']).toBeNull();
    expect(processor['_inputQueue']).toHaveLength(0);
    expect(processor['_outputQueue']).toHaveLength(0);
  });

  it('should process multiple frames in order', async () => {
    processor.link(nextProcessor);

    const frames: BaseFrame[] = [
      { type: 'test1', timestamp: Date.now() },
      { type: 'test2', timestamp: Date.now() },
      { type: 'test3', timestamp: Date.now() },
    ];

    await Promise.all(frames.map(frame => processor.queueFrame(frame, FrameDirection.DOWNSTREAM)));

    expect(processor.processedFrames).toHaveLength(3);
    expect(nextProcessor.processedFrames).toHaveLength(3);

    frames.forEach((frame, index) => {
      expect(processor.processedFrames[index][0]).toBe(frame);
      expect(nextProcessor.processedFrames[index][0]).toBe(frame);
    });
  });
});
