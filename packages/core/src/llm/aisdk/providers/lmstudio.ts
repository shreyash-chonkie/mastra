import { AISDK } from '../aisdk';

import { openaiCompat } from './openai-compat';

export class LMStudio extends AISDK {
  constructor({ name, baseURL }: { name: string; baseURL: string }) {
    super({ model: openaiCompat({ modelName: name, baseURL }) });
  }
}
