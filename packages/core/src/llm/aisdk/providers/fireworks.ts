import { createFireworks } from '@ai-sdk/fireworks';

import { AISDK } from '../aisdk';

export class Fireworks extends AISDK {
  constructor({ name, apiKey = process.env.FIREWORKS_API_KEY || '' }: { name: string; apiKey?: string }) {
    const fireworksModel = createFireworks({ apiKey });
    super({ model: fireworksModel(name) });
  }
}
