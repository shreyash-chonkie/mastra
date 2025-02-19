import { MastraTTS } from '@mastra/core/tts';
import OpenAI from 'openai';
import { PassThrough, Readable } from 'stream';

interface OpenAITTSConfig {
  name: 'tts-1' | 'tts-1-hd';
  apiKey?: string;
}

export class OpenAITTS extends MastraTTS {
  client: OpenAI;
  constructor({ model }: { model: OpenAITTSConfig }) {
    super({
      model: {
        provider: 'OPENAI',
        ...model,
      },
    });

    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || this.model.apiKey });
  }

  async voices() {
    const res = this.traced(
      () => [
        { voice_id: 'alloy' },
        { voice_id: 'echo' },
        { voice_id: 'fable' },
        { voice_id: 'onyx' },
        { voice_id: 'nova' },
        { voice_id: 'shimmer' },
      ],
      'tts.openai.voices',
    )();

    return res;
  }

  async generate({ text, voice }: { text: string; voice?: string }) {
    const audioBuffer = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: this.model.name,
        voice: voice || 'alloy',
        input: text,
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      return buffer;
    }, 'tts.openai.generate')();

    return {
      audioResult: audioBuffer,
    };
  }

  async stream({ voice, text, speed }: { voice: string; text: string; speed?: number }) {
    const audio = await this.traced(async () => {
      const response = await this.client.audio.speech.create({
        model: this.model.name || 'tts-1',
        voice: voice as any,
        input: text,
        speed: speed || 1.0,
      });

      return response.body as unknown as PassThrough;
    }, 'tts.openai.stream')();

    return {
      audioResult: audio,
    };
  }

  async transcribe({ audio }: { audio: Blob }) {
    const text = await this.traced(async () => {
      console.log('Received audio blob:', {
        size: audio.size,
        type: audio.type,
      });

      // Convert Blob to File
      const file = new File([audio], 'audio.wav', { type: audio.type });

      console.log('Created file:', {
        name: file.name,
        size: file.size,
        type: file.type,
      });

      const response = await this.client.audio.transcriptions.create({
        model: 'whisper-1',
        file: file as any,
      });

      return response.text;
    }, 'tts.openai.transcribe')();

    return {
      textResult: text,
    };
  }
}
