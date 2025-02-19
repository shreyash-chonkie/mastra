import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { OpenAITTS } from '@mastra/speech-openai';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path, { join } from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { mkdtemp, readFile, rm, readdir, mkdir } from 'fs/promises';
import { access, stat } from 'fs/promises';

import { VoiceAgent } from './';

// Load environment variables from .env file
config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required for tests');
}

describe('Voice Agent', () => {
  let agent: Agent;
  let tts: OpenAITTS;
  let voiceAgent: VoiceAgent;
  let tempDir: string;
  const resourceId = 'test-123';

  beforeEach(async () => {
    // Create test-output directory if it doesn't exist
    const testOutputDir = path.join(__dirname, '../test-output');
    if (!existsSync(testOutputDir)) {
      await mkdir(testOutputDir);
    }
    tempDir = path.join(testOutputDir, `test-${Date.now()}`);
    await mkdir(tempDir);

    // Create fresh instances for each test
    agent = new Agent({
      name: 'Test Agent',
      instructions: 'You are a test agent.',
      model: openai('gpt-3.5-turbo'),
    });

    tts = new OpenAITTS({
      model: {
        name: 'tts-1',
        apiKey: process.env.OPENAI_API_KEY,
      },
    });

    voiceAgent = new VoiceAgent({
      agent,
      tts,
      voice: 'alloy',
      audioConfig: {
        format: 'wav',
        sampleRate: 16000,
        channels: 1,
      },
    });
  });

  afterEach(async () => {
    // Clean up any active calls
    await voiceAgent.endCall();
  });

  it('should start a call successfully', async () => {
    const result = await voiceAgent.startCall({
      resourceId,
      initialMessage: 'Hello!',
    });

    expect(result).toBeDefined();
    expect(result.resourceId).toBe(resourceId);
    expect(result.threadId).toContain(resourceId);
    expect(result.isActive).toBe(true);
    expect(result.agentResponse).toBe('Hello!');
  });

  it('should handle text conversation', async () => {
    // Start the call
    await voiceAgent.startCall({
      resourceId,
      initialMessage: 'Hello!',
    });

    // Send a message
    const response = await voiceAgent.sendText("What's the weather like?");

    expect(response).toBeDefined();
    expect(response.userText).toBe("What's the weather like?");
    expect(response.agentResponse).toBeDefined();
    expect(response.hasAudio).toBe(true);
    expect(response.timestamp).toBeInstanceOf(Date);
  }, 50000);

  it('should prevent concurrent processing', async () => {
    // Start the call
    await voiceAgent.startCall({
      resourceId,
      initialMessage: 'Hello!',
    });

    // Simulate concurrent requests
    const request1 = voiceAgent.sendText('First message');
    const request2 = voiceAgent.sendText('Second message');

    await expect(Promise.all([request1, request2])).rejects.toThrow('Already processing a response');
  });

  it('should end call and cleanup resources', async () => {
    // Start a call
    await voiceAgent.startCall({
      resourceId,
      initialMessage: 'Hello!',
    });

    // End the call
    const endedCall = await voiceAgent.endCall();

    expect(endedCall).toBeDefined();
    expect(endedCall?.isActive).toBe(false);

    // Verify call is ended
    await expect(voiceAgent.sendText('Hello?')).rejects.toThrow('No active call');
  });

  it('should handle multiple calls sequentially', async () => {
    // Start first call
    const call1 = await voiceAgent.startCall({
      resourceId: 'call-1',
      initialMessage: 'First call',
    });

    // Start second call (should end first call)
    const call2 = await voiceAgent.startCall({
      resourceId: 'call-2',
      initialMessage: 'Second call',
    });

    expect(call1.threadId).not.toBe(call2.threadId);
    expect(call2.isActive).toBe(true);

    // Verify we can send messages to the new call
    const response = await voiceAgent.sendText('Hello');
    expect(response.agentResponse).toBeDefined();
  });

  it('should write audio response to file', async () => {
    const call = await voiceAgent.startCall({
      resourceId,
      initialMessage: 'Hello, how can I help you?',
      outputPath: tempDir,
    });

    const mockAudio = Buffer.from('test audio data');
    await voiceAgent.handleUserAudio(mockAudio);

    // Check if files were created in the temp directory
    const files = await readdir(tempDir);
    expect(files.length).toBeGreaterThan(0);
    expect(files[0]).toMatch(/\d+_response\.wav$/);

    // Verify file contents
    const fileContent = await readFile(join(tempDir, files[0]));
    expect(fileContent.length).toBeGreaterThan(0);
  });

  it.only('should handle a full conversation with different voices', async () => {
    const tempDir = join(__dirname, 'test-output');
    await mkdir(tempDir, { recursive: true });

    const voiceAgent = new VoiceAgent({
      agent: agent,
      tts: tts,
      voice: 'alloy',
      outputPath: tempDir, // Add this back
    });

    // Start call with initial greeting
    await voiceAgent.startCall({
      resourceId: 'test-123',
      initialMessage: 'Hi, I am your AI assistant. How can I help you today?',
      outputPath: tempDir,
    });

    // Wait for initial message to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // First message from user (using echo voice)
    const response1 = await voiceAgent.sendText('How are you?', { voice: 'echo' });
    console.log('Agent response 1:', response1.agentResponse);

    // Wait for response to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Second message from user (using alloy voice)
    const response2 = await voiceAgent.sendText('Tell me a joke', { voice: 'alloy' });
    console.log('Agent response 2:', response2.agentResponse);

    // Wait for response to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the conversation file exists
    const conversationFile = join(tempDir, 'conversation.wav');
    const exists = await access(conversationFile)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);

    // Verify file has content
    const stats = await stat(conversationFile);
    console.log('Conversation file size:', stats.size);
    expect(stats.size).toBeGreaterThan(0);

    // End the conversation
    await voiceAgent.endCall();
  }, 50000);

  it('should handle a complete conversation with audio', async () => {
    // Start a conversation with initial greeting
    const initialMessage = "Hi, I'm your AI assistant. How can I help you today?";
    const call = await voiceAgent.startCall({
      resourceId,
      initialMessage,
      outputPath: tempDir,
    });

    // Wait for initial message to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    await voiceAgent.sendText('How are you?', { voice: 'echo' });

    // Wait for response to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    // End the conversation
    await voiceAgent.endCall();
  }, 50000);
});
