import { createWriteStream } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { describe, it, expect, beforeAll } from 'vitest';

import { pipeline } from 'stream/promises';

import { OpenAI } from './index.js';

const speech = new OpenAI({
  sst: 'whisper-1',
  tts: 'tts-1',
  apiKey: process.env.OPENAI_API_KEY!,
});

describe('OpenAI Integration Tests', () => {
  describe('voices', () => {
    it('should return list of available voices', async () => {
      const voices = await speech.voices();
      expect(voices).toHaveLength(6);
      expect(voices).toContainEqual({ voice_id: 'alloy' });
      expect(voices).toContainEqual({ voice_id: 'nova' });
    });
  });

  describe('text-to-speech', () => {
    it('should generate speech and return Buffer', async () => {
      const buffer = await speech.generateSpeech('Hello world', {
        voice: 'alloy',
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });

    it('should stream speech to file', async () => {
      const outputPath = path.join(process.cwd(), 'test-outputs/stream-test.mp3');
      const fileStream = createWriteStream(outputPath);

      const response = await speech.streamSpeech('Test streaming', {
        voice: 'alloy',
      });

      await pipeline(response as unknown as Readable, fileStream);

      // File should exist and have content
      const stats = await import('fs').then(fs => fs.promises.stat(outputPath));
      expect(stats.size).toBeGreaterThan(0);
    }, 50000);

    it('should handle custom speed parameter', async () => {
      const buffer = await speech.generateSpeech('Testing speed', {
        voice: 'alloy',
        speed: 1.5,
      });

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });

  describe('speech-to-text', () => {
    let audioBuffer: Buffer;
    let audioFile: File;

    beforeAll(async () => {
      // Create a small audio file for testing
      audioBuffer = await speech.generateSpeech('This is a test audio', { voice: 'alloy' });
      audioFile = new File([audioBuffer], 'test.mp3', { type: 'audio/mp3' });
    });

    it('should transcribe audio to text', async () => {
      const text = await speech.generateText({
        audio: audioFile,
      });

      expect(text).toContain('test');
    });

    it('should translate audio to english', async () => {
      const text = await speech.generateTranslation({
        audio: audioFile,
      });

      expect(text).toContain('test');
    });

    it('should stream text transcription', async () => {
      let transcribedText = '';

      await speech.streamText({
        audio: audioFile,
        onText: text => {
          transcribedText = text;
        },
      });

      expect(transcribedText).toContain('test');
    });

    it('should handle language parameter', async () => {
      const text = await speech.generateText({
        audio: audioFile,
        language: 'fr',
      });

      console.log(text);

      expect(text).toContain('test');
    });
  });

  describe('error handling', () => {
    it('should handle invalid voice names', async () => {
      await expect(
        speech.generateSpeech('Test', {
          voice: 'invalid_voice',
        }),
      ).rejects.toThrow();
    });

    it('should handle empty text', async () => {
      await expect(
        speech.generateSpeech('', {
          voice: 'alloy',
        }),
      ).rejects.toThrow();
    });

    it('should handle invalid audio data', async () => {
      const invalidAudio = Buffer.from('invalid audio data');
      await expect(
        speech.generateText({
          audio: invalidAudio,
        }),
      ).rejects.toThrow();
    });
  });
});
