export type BaseFrame = {
  type: string;
  timestamp: number;
  metadata?: Record<string, any>;
};

export type TTSSpeakFrame = BaseFrame & {
  type: 'tts_speak';
  text: string;
  voice_id?: string;
};

export type AudioFrame = BaseFrame & {
  type: 'audio';
  data: Float32Array | Int16Array;
  sampleRate: number;
  channels: number;
};

export type EndFrame = BaseFrame & {
  type: 'end';
};

export type Frame = TTSSpeakFrame | AudioFrame | EndFrame;
