import { Agent } from '@mastra/core/agent';
import { MastraTTS } from '@mastra/core/tts';
import { join } from 'path';
import { Readable, PassThrough } from 'stream';

import { writeFile, readFile } from 'fs/promises';

// Add STT support

interface AudioConfig {
  format: 'wav' | 'mp3';
  sampleRate: number;
  channels: number;
}

interface VoiceCallState {
  resourceId: string;
  threadId: string;
  startTime: Date;
  isActive: boolean;
  audioStream: PassThrough;
  audioConfig: AudioConfig;
  isProcessing: boolean;
  outputPath?: string;
}

export class VoiceAgent {
  agent: Agent;
  private activeCall?: VoiceCallState;
  private tts?: MastraTTS;
  private defaultAudioConfig: AudioConfig = {
    format: 'wav',
    sampleRate: 16000,
    channels: 1,
  };
  voice: any;
  private outputPath?: string;

  constructor({
    agent,
    tts,
    audioConfig,
    voice,
    outputPath,
  }: {
    voice: string;
    agent: Agent;
    tts?: MastraTTS;
    audioConfig?: Partial<AudioConfig>;
    outputPath?: string;
  }) {
    this.voice = voice;
    this.agent = agent;
    this.tts = tts;
    this.outputPath = outputPath;
    this.defaultAudioConfig = {
      ...this.defaultAudioConfig,
      ...audioConfig,
    };
  }

  async startCall({
    resourceId,
    initialMessage,
    audioConfig,
    outputPath,
  }: {
    initialMessage: string;
    resourceId: string;
    audioConfig?: Partial<AudioConfig>;
    outputPath?: string;
  }) {
    if (this.activeCall) {
      throw new Error('Call already in progress');
    }

    // Create audio stream for the call
    const audioStream = new PassThrough();

    // Create call state
    const callState: VoiceCallState = {
      resourceId,
      threadId: `voice-${resourceId}`,
      startTime: new Date(),
      isActive: true,
      audioStream,
      isProcessing: false,
      outputPath: outputPath || this.outputPath, // Use constructor outputPath as fallback
      audioConfig: {
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
      },
    };

    // Store call state
    this.activeCall = callState;

    // If TTS is available, convert initial message to speech
    if (this.tts && initialMessage) {
      try {
        const audioResponse = await this.tts.generate({
          text: initialMessage,
          voice: this.voice,
        });

        if (this.activeCall?.audioStream) {
          this.activeCall.audioStream.write(audioResponse.audioResult);
        } else {
          console.warn('No active call stream to write to');
        }

        // Write initial message to conversation file if outputPath is specified
        if (this.activeCall?.outputPath) {
          const filepath = join(this.activeCall.outputPath, 'conversation.wav');
          await writeFile(filepath, audioResponse.audioResult);
        }
      } catch (error) {
        // Don't end the call on TTS error, just continue without audio
        console.error('Failed to generate speech:', error);
      }
    }

    return {
      ...callState,
      agentResponse: initialMessage,
    };
  }

  async endCall() {
    if (this.activeCall) {
      // End the audio stream properly
      this.activeCall.audioStream.end();

      // Update call state
      this.activeCall.isActive = false;

      // Clear the active call
      const endedCall = this.activeCall;
      this.activeCall = undefined;

      return endedCall;
    }
  }

  async handleUserAudio(audioChunk: Buffer) {
    if (!this.activeCall?.isActive) {
      throw new Error('No active call');
    }

    if (this.activeCall.isProcessing) {
      // Optionally buffer or handle concurrent audio
      return;
    }

    try {
      this.activeCall.isProcessing = true;

      // Process audio through speech-to-text (implementation needed)
      const text = await this.speechToText(audioChunk);

      // Generate agent response
      const response = await this.agent.generate(text, {
        threadId: this.activeCall.threadId,
        resourceId: this.activeCall.resourceId,
      });

      // Convert response to speech and add to stream
      if (this.tts) {
        const audioResponse = await this.tts.generate({
          text: response.text,
          voice: this.voice,
        });
        this.activeCall.audioStream.write(audioResponse.audioResult);

        // Append to conversation file if outputPath is specified
        if (this.activeCall.outputPath) {
          const filepath = join(this.activeCall.outputPath, 'conversation.wav');
          const existingAudio = await readFile(filepath).catch(() => Buffer.alloc(0));
          await writeFile(filepath, Buffer.concat([existingAudio, audioResponse.audioResult]));
        }
      }

      return {
        userText: text,
        agentResponse: response.text,
      };
    } finally {
      this.activeCall.isProcessing = false;
    }
  }

  async sendText(
    text: string,
    options?: { voice?: string },
  ): Promise<{
    userText: string;
    agentResponse: string;
    done: boolean;
    threadId: string;
    timestamp: Date;
  }> {
    if (!this.activeCall) {
      throw new Error('No active call');
    }

    try {
      this.activeCall.isProcessing = true;

      // First convert user's text to speech with provided voice or default
      if (this.tts) {
        const userAudioResponse = await this.tts.generate({
          text: text,
          voice: options?.voice || this.voice,
        });
        this.activeCall.audioStream.write(userAudioResponse.audioResult);

        // Append user's speech to conversation file
        if (this.activeCall.outputPath || this.outputPath) {
          const filepath = join(this.activeCall.outputPath || this.outputPath!, 'conversation.wav');
          console.log('Writing user message to:', filepath);
          const existingAudio = await readFile(filepath).catch(() => Buffer.alloc(0));
          await writeFile(filepath, Buffer.concat([existingAudio, userAudioResponse.audioResult]));
        }
      }

      // Generate agent response with conversation context
      const response = await this.agent.generate(text, {
        threadId: this.activeCall.threadId,
        resourceId: this.activeCall.resourceId,
      });

      // Convert agent's response to speech and add to stream (always use agent's voice)
      if (this.tts) {
        const agentAudioResponse = await this.tts.generate({
          text: response.text,
          voice: this.voice, // Agent always uses its configured voice
        });
        this.activeCall.audioStream.write(agentAudioResponse.audioResult);

        // Append agent's response to conversation file
        if (this.activeCall.outputPath || this.outputPath) {
          const filepath = join(this.activeCall.outputPath || this.outputPath!, 'conversation.wav');
          console.log('Writing agent response to:', filepath);
          const existingAudio = await readFile(filepath).catch(() => Buffer.alloc(0));
          await writeFile(filepath, Buffer.concat([existingAudio, agentAudioResponse.audioResult]));
        }
      }

      return {
        userText: text,
        agentResponse: response.text,
        done: false,
        threadId: this.activeCall.threadId,
        timestamp: new Date(),
      };
    } finally {
      this.activeCall.isProcessing = false;
    }
  }

  private createWavHeader(dataLength: number, sampleRate = 16000, channels = 1, bitsPerSample = 16): Buffer {
    const headerLength = 44; // Standard WAV header length
    const header = Buffer.alloc(headerLength);

    // RIFF chunk descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(dataLength + 36, 4); // File size - 8
    header.write('WAVE', 8);

    // fmt sub-chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16); // fmt chunk size
    header.writeUInt16LE(1, 20); // Audio format (1 = PCM)
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE((sampleRate * channels * bitsPerSample) / 8, 28); // Byte rate
    header.writeUInt16LE((channels * bitsPerSample) / 8, 32); // Block align
    header.writeUInt16LE(bitsPerSample, 34);

    // data sub-chunk
    header.write('data', 36);
    header.writeUInt32LE(dataLength, 40);

    return header;
  }

  private async speechToText(audioChunk: Buffer): Promise<string> {
    if (!this.tts) {
      throw new Error('No TTS service configured');
    }

    try {
      console.log('Audio chunk size:', audioChunk.length);
      console.log('Audio chunk first bytes:', audioChunk.slice(0, 16));
      console.log('Audio config:', this.activeCall?.audioConfig);

      // Create WAV header
      const header = this.createWavHeader(
        audioChunk.length,
        this.activeCall?.audioConfig.sampleRate || 16000,
        this.activeCall?.audioConfig.channels || 1,
      );

      // Combine header and audio data
      const wavFile = Buffer.concat([header, audioChunk]);

      // Create a Blob with WAV MIME type and proper filename
      const blob = new Blob([wavFile], {
        type: 'audio/wav',
      });

      console.log('Created blob:', {
        size: blob.size,
        type: blob.type,
      });

      const result = await this.tts.transcribe({ audio: blob });
      return result.textResult;
    } catch (error) {
      console.error('Speech-to-text failed:', error);
      throw new Error('Failed to convert speech to text');
    }
  }

  getAudioStream(): PassThrough | undefined {
    return this.activeCall?.audioStream;
  }

  isProcessing(): boolean {
    return this.activeCall?.isProcessing || false;
  }
}
