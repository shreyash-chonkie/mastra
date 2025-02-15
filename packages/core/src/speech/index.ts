import { MastraBase } from '../base';
import { InstrumentClass } from '../telemetry';

// TTS specific types
export interface TTSGenerateOptions {
  voice?: string;
  language?: string;
  speed?: number;
}

export interface TTSStreamOptions extends TTSGenerateOptions {
  onChunk?: (chunk: ArrayBuffer) => void;
}

// STT specific types
export interface STTGenerateOptions {
  audio: File | Blob | Buffer | string | ReadableStream | ArrayBuffer;
  language?: string;
  model?: string;
}

export interface STTStreamOptions extends STTGenerateOptions {
  onText?: (text: string) => void;
}

@InstrumentClass({
  prefix: 'speech',
  excludeMethods: ['__setTools', '__setLogger', '__setTelemetry', '#log'],
})
export abstract class MastraSpeech extends MastraBase {
  constructor() {
    super({
      component: 'SPEECH',
    });
  }

  async voices(): Promise<{ voice_id: string }[]> {
    // Implementation will depend on the provider
    throw new Error('Method not implemented');
  }

  // TTS Methods
  async generateSpeech(text: string, options: TTSGenerateOptions): Promise<ArrayBuffer> {
    // Implementation will depend on the provider
    throw new Error('Method not implemented');
  }

  async streamSpeech(text: string, options: TTSStreamOptions): Promise<ReadableStream> {
    // Implementation will depend on the provider
    throw new Error('Method not implemented');
  }

  // STT Methods
  async generateText(options: STTGenerateOptions): Promise<string> {
    // Implementation will depend on the provider
    throw new Error('Method not implemented');
  }

  async streamText(options: STTStreamOptions): Promise<void> {
    // Implementation will depend on the provider
    throw new Error('Method not implemented');
  }
}
