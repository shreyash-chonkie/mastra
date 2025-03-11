import type { ToolsInput } from '@mastra/core/agent';
import { MastraVoice } from '@mastra/core/voice';
import { RealtimeClient, type Realtime } from 'openai-realtime-api';
import { isReadableStream, transformTools } from './utils';

const DEFAULT_URL = `wss://api.openai.com/v1/realtime`;
const DEFAULT_VOICE = 'alloy';
const DEFAULT_MODEL = 'gpt-4o-mini-realtime-preview-2024-12-17';

type EventCallback = (...args: any[]) => void;
type EventMap = {
  speak: EventCallback[];
  silence: EventCallback[];
  listen: EventCallback[];
  error: EventCallback[];
  [key: string]: EventCallback[];
};

type TTools = ToolsInput;

const VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse'];

export class OpenAIRealtimeApiVoice extends MastraVoice {
  private url: string;
  private voice: string;
  private model: string;
  private client: RealtimeClient;
  private state: 'leave' | 'huddle';
  private events: EventMap;
  tools?: TTools;

  constructor({
    chatModel,
  }: {
    chatModel?: {
      model?: string;
      apiKey?: string;
      tools?: TTools;
      options?: {
        sessionConfig?: Realtime.SessionConfig;
        url?: string;
        dangerouslyAllowAPIKeyInBrowser?: boolean;
        debug?: boolean;
        tools?: TTools;
      };
    };
  } = {}) {
    super();
    this.url = DEFAULT_URL;
    this.voice = DEFAULT_VOICE;
    this.model = chatModel?.model ? chatModel.model : DEFAULT_MODEL;
    this.client = new RealtimeClient({
      apiKey: chatModel?.apiKey || process.env.OPENAI_API_KEY,
      // ...chatModel?.options,
      sessionConfig: {
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 1000,
          silence_duration_ms: 1000,
        },
      },
    });

    this.state = 'leave';
    this.events = {} as EventMap;
    this.setupEventListeners();

    if (chatModel?.tools) {
      this.equip(chatModel.tools);
    }
  }

  getSpeakers(): Promise<Array<{ voiceId: string; [key: string]: any }>> {
    return Promise.resolve(VOICES.map(v => ({ voiceId: v })));
  }

  leave() {
    this.client.disconnect();
    this.state = 'leave';
  }

  equip(tools?: TTools) {
    return transformTools(tools);
  }

  async speak(
    input: string | NodeJS.ReadableStream,
    options?: { speaker?: string; [key: string]: any },
  ): Promise<void> {
    if (typeof input !== 'string') {
      this.emit('error', new Error('Input must be a string'));
      return;
    }

    this.client.realtime.send('conversation.item.create', {
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: input }],
      },
    });

    this.client.realtime.send('response.create', {
      response: {
        instructions: `Repeat the user's message and only the user's message`,
      },
    });
  }

  updateSession(sessionConfig: { [key: string]: any }): void {
    this.client.updateSession(sessionConfig);
  }

  async listen(audioData: NodeJS.ReadableStream, options?: { [key: string]: any }): Promise<void> {
    console.log('listen', audioData instanceof Int16Array);
    if (audioData instanceof Int16Array) {
      const audio = this.int16ArrayToBase64(audioData);

      this.client.realtime.send('conversation.item.create', {
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_audio', audio: audio }],
        },
      });

      this.client.realtime.send('response.create', {
        response: {
          modalities: ['text'],
          instructions: `ONLY repeat the input and DO NOT say anything else`,
        },
      });
    } else if (isReadableStream(audioData)) {
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  async huddle() {
    await this.client.connect();
    await this.client.waitForSessionCreated();
    this.state = 'huddle';
  }

  async relay(audioData: NodeJS.ReadableStream): Promise<void> {
    if (!this.state || this.state !== 'huddle') {
      console.warn('Cannot relay audio when not huddle. Call huddle() first.');
      return;
    }

    if (isReadableStream(audioData)) {
      const stream = audioData as NodeJS.ReadableStream;
      stream.on('data', chunk => {
        try {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const int16Array = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 2);
          this.client.appendInputAudio(int16Array);
        } catch (err) {
          this.emit('error', err);
        }
      });
    } else {
      this.emit('error', new Error('Unsupported audio data format'));
    }
  }

  /**
   * Register an event listener
   * @param event Event name ('speak', 'silence', 'listen', 'error')
   * @param callback Callback function to be called when the event is triggered
   */
  on(event: string, callback: EventCallback): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  /**
   * Remove an event listener
   * @param event Event name
   * @param callback Callback function to remove
   */
  off(event: string, callback: EventCallback): void {
    if (!this.events[event]) return;

    const index = this.events[event].indexOf(callback);
    if (index !== -1) {
      this.events[event].splice(index, 1);
    }
  }

  /**
   * Emit an event with arguments
   * @param event Event name
   * @param args Arguments to pass to the callbacks
   */
  private emit(event: string, ...args: any[]): void {
    if (!this.events[event]) return;

    for (const callback of this.events[event]) {
      callback(...args);
    }
  }

  private setupEventListeners(): void {
    this.client.on('error', error => {
      this.emit('error', error);
    });

    this.client.on('conversation.created', conversation => {
      this.emit('openAIRealtime:conversation.created', conversation);
    });

    this.client.on('conversation.item.created', item => {
      this.emit('openAIRealtime:conversation.item.created', item);
    });

    this.client.on('conversation.updated', ({ item, delta }) => {
      this.emit('openAIRealtime:conversation.updated', { item, delta });
    });

    this.client.on('conversation.item.completed', ({ item }) => {
      console.log('conversation.item.completed', item);
      if (
        item.formatted.audio &&
        item.formatted.audio.length > 0 &&
        item.type === 'message' &&
        item.role === 'assistant' &&
        item.formatted
      ) {
        this.emit('speaking', { audio: item.formatted.audio });
      }

      if (item.formatted.transcript) {
        this.emit('listening', { text: item.formatted.transcript });
      }
    });
  }

  private int16ArrayToBase64(int16Array: Int16Array): string {
    const buffer = new ArrayBuffer(int16Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < int16Array.length; i++) {
      view.setInt16(i * 2, int16Array[i], true);
    }
    const uint8Array = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
}
