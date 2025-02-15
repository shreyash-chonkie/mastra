import { MastraSpeech as BaseSpeech } from './index';

export class MastraSpeech extends BaseSpeech {
  constructor() {
    super();
    console.warn('Please import "MastraSpeech" from "@mastra/core/speech" instead of "@mastra/core"');
  }
}
