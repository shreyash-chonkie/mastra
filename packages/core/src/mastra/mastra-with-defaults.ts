import type { Agent } from '../agent';
import type { Logger } from '../logger';
import { createLogger, LogLevel } from '../logger';
import type { MastraStorage } from '../storage';
import { DefaultProxyStorage } from '../storage/default-proxy-storage';
import type { MastraTTS } from '../tts';
import type { MastraVector } from '../vector';
import type { Workflow } from '../workflows';
import { Mastra as BaseMastra } from './mastra';
import type { Config } from './mastra';

export class Mastra<
  TAgents extends Record<string, Agent<any>> = Record<string, Agent<any>>,
  TWorkflows extends Record<string, Workflow> = Record<string, Workflow>,
  TVectors extends Record<string, MastraVector> = Record<string, MastraVector>,
  TTTS extends Record<string, MastraTTS> = Record<string, MastraTTS>,
> extends BaseMastra<TAgents, TWorkflows, TVectors, TTTS> {
  constructor(config?: Partial<Config<TAgents, TWorkflows, TVectors, TTTS>>) {
    let logger: Logger | undefined = undefined;
    let storage: MastraStorage | undefined = undefined;

    if (config?.logger == undefined) {
      const levleOnEnv = process.env.NODE_ENV === 'production' ? LogLevel.WARN : LogLevel.INFO;
      logger = createLogger({ name: 'Mastra', level: levleOnEnv });
    }

    if (!config?.storage) {
      storage = new DefaultProxyStorage({
        config: {
          url: `:memory:`,
        },
      });
    }

    super({
      logger: logger!,
      storage: storage!,
      ...config,
    });
  }
}
