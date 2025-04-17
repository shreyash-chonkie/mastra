import { Agent } from '@mastra/core/agent';
import type { AgentConfig } from '@mastra/core/agent';
import { vi } from 'vitest';

export class MockAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);

    this.generate = vi.fn();
    this.stream = vi.fn();
    this.__updateInstructions = vi.fn();
    this.run = vi.fn().mockResolvedValue('Mock agent response');
  }

  run(_args: any) {
    return Promise.resolve('Mock agent response');
  }

  // generate(args: any) {
  //     return this.generate(args);
  // }

  // stream(args: any) {
  //     return this.stream(args);
  // }

  // __updateInstructions(args: any) {
  //     return this.__updateInstructions(args);
  // }
}
