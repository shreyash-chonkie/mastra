export interface MetricsData {
  ttfb?: number; // Time to first byte
  processingTime?: number; // Total processing time
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export class FrameProcessorMetrics {
  private processorName: string = '';
  private startTime: number = 0;
  private ttfbTime: number = 0;
  private processingTime: number = 0;
  private tokenUsage: { prompt: number; completion: number; total: number } = {
    prompt: 0,
    completion: 0,
    total: 0,
  };

  setProcessorName(name: string): void {
    this.processorName = name;
  }

  startTtfbMetrics(): void {
    this.startTime = Date.now();
  }

  stopTtfbMetrics(): MetricsData {
    if (this.startTime === 0) return {};
    this.ttfbTime = Date.now() - this.startTime;
    return { ttfb: this.ttfbTime };
  }

  startProcessingMetrics(): void {
    this.startTime = Date.now();
  }

  stopProcessingMetrics(): MetricsData {
    if (this.startTime === 0) return {};
    this.processingTime = Date.now() - this.startTime;
    return { processingTime: this.processingTime };
  }

  updateTokenUsage(prompt: number, completion: number): MetricsData {
    this.tokenUsage.prompt += prompt;
    this.tokenUsage.completion += completion;
    this.tokenUsage.total = this.tokenUsage.prompt + this.tokenUsage.completion;
    return { tokenUsage: { ...this.tokenUsage } };
  }

  getMetrics(): MetricsData {
    return {
      ttfb: this.ttfbTime,
      processingTime: this.processingTime,
      tokenUsage: { ...this.tokenUsage },
    };
  }
}
