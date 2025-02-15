import {
  MastraSpeech,
  type TTSGenerateOptions,
  type TTSStreamOptions,
  type STTGenerateOptions,
  type STTStreamOptions,
} from '@mastra/core/speech';
import OpenAIClient from 'openai';

export class OpenAI extends MastraSpeech {
  client: OpenAIClient;
  tts: 'tts-1' | 'tts-1-hd';
  sst: 'whisper-1';
  constructor({ apiKey, tts, sst }: { apiKey: string; tts: 'tts-1' | 'tts-1-hd'; sst: 'whisper-1' }) {
    super();

    this.client = new OpenAIClient({ apiKey });
    this.tts = tts;
    this.sst = sst;
  }

  async voices() {
    return [
      { voice_id: 'alloy' },
      { voice_id: 'echo' },
      { voice_id: 'fable' },
      { voice_id: 'onyx' },
      { voice_id: 'nova' },
      { voice_id: 'shimmer' },
    ];
  }

  async generateSpeech(text: string, options: TTSGenerateOptions): Promise<Buffer> {
    const response = await this.client.audio.speech.create({
      model: this.tts,
      voice: (options.voice || 'alloy') as any,
      input: text,
      speed: options.speed || 1.0,
    });

    // Get the full buffer
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  }

  async streamSpeech(text: string, options: TTSStreamOptions): Promise<ReadableStream> {
    const response = await this.client.audio.speech.create({
      model: this.tts,
      voice: (options.voice || 'alloy') as any,
      input: text,
      speed: options.speed || 1.0,
      response_format: 'mp3',
    });

    if (!response.body) {
      throw new Error('No stream found.');
    }

    return response.body;
  }

  async generateText(options: STTGenerateOptions): Promise<string> {
    const response = await this.client.audio.transcriptions.create({
      model: this.sst,
      file: options.audio as any,
      language: options.language,
      response_format: 'text',
    });

    return response;
  }

  async generateTranslation(options: STTGenerateOptions): Promise<string> {
    const response = await this.client.audio.translations.create({
      model: this.sst,
      file: options.audio as any,
    });

    return response.text;
  }

  async streamText(options: STTStreamOptions): Promise<void> {
    const response = await this.client.audio.transcriptions.create({
      model: this.sst,
      file: options.audio as any,
      language: options.language,
      response_format: 'text',
    });

    if (options.onText) {
      options.onText(response);
    }
  }
}
