import { CoreMessage } from 'ai';
import { JSONSchema7 } from 'json-schema';
import { ZodSchema } from 'zod';

import { MastraPrimitives } from '../action';
import { MastraBase } from '../base';
import { RegisteredLogger } from '../logger';

import { GenerateTextInputOptions, LLMStreamOptions, LLMTextObjectOptions } from './types';

export class MastraLLM extends MastraBase {
  #mastra?: MastraPrimitives;

  constructor({ name }: { name: string }) {
    super({
      component: RegisteredLogger.LLM,
      name,
    });
  }

  convertToMessages(messages: string | string[] | CoreMessage[]): CoreMessage[] {
    if (Array.isArray(messages)) {
      return messages.map(m => {
        if (typeof m === 'string') {
          return {
            role: 'user',
            content: m,
          };
        }
        return m;
      });
    }

    return [
      {
        role: 'user',
        content: messages,
      },
    ];
  }

  generate<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z> = {},
  ) {}

  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.#mastra = p;
  }

  __text(input: GenerateTextInputOptions) {}

  __textObject<T>(input: LLMTextObjectOptions<T>) {}

  __streamObject<T>(input: LLMTextObjectOptions<T>) {}

  stream<Z extends ZodSchema | JSONSchema7 | undefined = undefined>(
    messages: string | string[] | CoreMessage[],
    options: LLMStreamOptions<Z> = {},
  ) {}
}
