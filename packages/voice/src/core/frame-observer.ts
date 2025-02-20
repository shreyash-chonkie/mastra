import type { FrameDirection } from './frame-direction';
import type { FrameProcessor } from './frame-processor';
import type { BaseFrame } from './frames';

export interface FrameObserver {
  /**
   * Called when a frame is pushed between processors
   */
  onPushFrame(
    source: FrameProcessor,
    destination: FrameProcessor,
    frame: BaseFrame,
    direction: FrameDirection,
    timestamp: number,
  ): Promise<void>;
}
