import { AudioFrame } from '../frames';

import { VADProcessor, VADState } from './vad-processor';

describe('VADProcessor', () => {
  let vadProcessor: VADProcessor;
  let stateChanges: VADState[];

  beforeEach(() => {
    vadProcessor = new VADProcessor({
      energyThreshold: 0.01,
      minSpeechDuration: 200,
      silenceDuration: 500,
      sampleRate: 48000,
    });
    stateChanges = [];
    vadProcessor.addEventHandler('vad_state_changed', (_, state) => {
      stateChanges.push(state as VADState);
    });
  });

  const createAudioFrame = (data: number[], timestamp: number): AudioFrame => ({
    type: 'audio',
    timestamp,
    data: new Float32Array(data),
    sampleRate: 48000,
    channels: 1,
  });

  it('should detect voice activity when energy exceeds threshold', async () => {
    // Create frames with high energy (voice)
    const voiceFrame = createAudioFrame(Array(1024).fill(0.1), 0);
    await vadProcessor.processFrame(voiceFrame, 'downstream');

    // Should not activate immediately due to minSpeechDuration
    expect(stateChanges[0].isActive).toBeFalsy();

    // Send more frames to exceed minSpeechDuration
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.1), 100), 'downstream');
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.1), 200), 'downstream');

    // Should now be active
    expect(stateChanges[stateChanges.length - 1].isActive).toBeTruthy();
  });

  it('should detect silence after voice activity', async () => {
    // First activate voice detection
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.1), 0), 'downstream');
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.1), 100), 'downstream');
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.1), 200), 'downstream');

    // Then send silence frames
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.001), 300), 'downstream');
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.001), 600), 'downstream');
    await vadProcessor.processFrame(createAudioFrame(Array(1024).fill(0.001), 900), 'downstream');

    // Should deactivate after silenceDuration
    expect(stateChanges[stateChanges.length - 1].isActive).toBeFalsy();
  });

  it('should update config correctly', () => {
    vadProcessor.updateConfig({
      energyThreshold: 0.02,
      minSpeechDuration: 300,
    });

    const config = (vadProcessor as any).config;
    expect(config.energyThreshold).toBe(0.02);
    expect(config.minSpeechDuration).toBe(300);
    expect(config.silenceDuration).toBe(500); // Unchanged
  });
});
