import { VADProcessor, VADState } from '../../../src/core/audio/vad-processor';
import { FrameDirection } from '../../../src/core/frame-direction';
import type { BaseFrame, Frame } from '../../../src/core/frames';
import { Pipeline } from '../../../src/core/pipeline';
import { LocalAudioTransport } from '../../../src/transports/local/audio/local-audio-transport';

import './style.css';

interface StoredFrame {
  data: Float32Array;
  timestamp: number;
  sampleRate: number;
  channels: number;
}

let pipeline: Pipeline | null = null;
let transport: LocalAudioTransport | null = null;
let recordedFrames: StoredFrame[] = [];
let isRecording = false;
let startTime = 0;
let animationId: number;
let vadProcessor: VADProcessor | null = null;

// Create audio visualizer
function createVisualizer(currentTransport: LocalAudioTransport) {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 200;
  canvas.className = 'visualizer';
  document.querySelector('.container')!.appendChild(canvas);

  const canvasCtx = canvas.getContext('2d')!;
  const dataArray = new Float32Array(2048);

  function draw() {
    animationId = requestAnimationFrame(draw);

    // Clear canvas
    canvasCtx.fillStyle = '#f8f9fa';
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Get latest audio data
    const inputProcessor = currentTransport?.input();
    if (inputProcessor && (inputProcessor as any)._lastFrame) {
      const frame = (inputProcessor as any)._lastFrame as Frame & { type: 'audio' };

      // Copy data for visualization
      const len = Math.min(dataArray.length, frame.data.length);
      dataArray.set(frame.data.slice(0, len));

      // Draw waveform
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = isRecording ? '#dc3545' : '#28a745';
      canvasCtx.beginPath();

      const sliceWidth = canvas.width / len;
      let x = 0;

      for (let i = 0; i < len; i++) {
        const v = dataArray[i];
        const y = ((v + 1) * canvas.height) / 2;

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    }
  }

  draw();
}

// Update timer display
function updateTimer() {
  if (!isRecording) return;

  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);

  const displayMinutes = minutes.toString().padStart(2, '0');
  const displaySeconds = (seconds % 60).toString().padStart(2, '0');

  document.getElementById('timer')!.textContent = `${displayMinutes}:${displaySeconds}`;

  requestAnimationFrame(updateTimer);
}

// Update UI state
function updateUI(state: 'ready' | 'recording' | 'stopped' | 'replaying') {
  const recordBtn = document.getElementById('recordBtn') as HTMLButtonElement;
  const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
  const replayBtn = document.getElementById('replayBtn') as HTMLButtonElement;
  const status = document.getElementById('status')!;
  const timer = document.getElementById('timer')!;

  switch (state) {
    case 'ready':
      recordBtn.textContent = 'Start Recording';
      recordBtn.disabled = false;
      recordBtn.classList.remove('recording');
      stopBtn.disabled = true;
      replayBtn.disabled = true;
      status.textContent = 'Ready to record';
      timer.textContent = '00:00';
      break;

    case 'recording':
      recordBtn.textContent = 'Recording...';
      recordBtn.disabled = true;
      recordBtn.classList.add('recording');
      stopBtn.disabled = false;
      replayBtn.disabled = true;
      status.textContent = 'Recording...';
      break;

    case 'stopped':
      recordBtn.textContent = 'Start Recording';
      recordBtn.disabled = false;
      recordBtn.classList.remove('recording');
      stopBtn.disabled = true;
      replayBtn.disabled = recordedFrames.length === 0;
      status.textContent = `Recording stopped (${recordedFrames.length} frames)`;
      break;

    case 'replaying':
      recordBtn.disabled = true;
      stopBtn.disabled = true;
      replayBtn.disabled = true;
      status.textContent = 'Replaying recording...';
      break;
  }

  // Handle visualizer
  const visualizer = document.querySelector('.visualizer');
  if ((state === 'ready' || state === 'stopped') && visualizer) {
    visualizer.remove();
    cancelAnimationFrame(animationId);
  }
}

// Add VAD state display
const vadStatus = document.createElement('div');
vadStatus.id = 'vadStatus';
vadStatus.style.marginTop = '10px';
vadStatus.textContent = 'Voice Activity: Inactive';
document.body.appendChild(vadStatus);

// Add VAD settings
const vadSettings = document.createElement('div');
vadSettings.style.marginTop = '20px';
vadSettings.innerHTML = `
  <h3>VAD Settings</h3>
  <div>
    <label>Energy Threshold: </label>
    <input type="range" id="energyThreshold" min="0" max="0.1" step="0.001" value="0.01">
    <span id="energyThresholdValue">0.01</span>
  </div>
  <div>
    <label>Min Speech Duration (ms): </label>
    <input type="range" id="minSpeechDuration" min="100" max="1000" step="50" value="200">
    <span id="minSpeechDurationValue">200</span>
  </div>
  <div>
    <label>Silence Duration (ms): </label>
    <input type="range" id="silenceDuration" min="100" max="2000" step="50" value="500">
    <span id="silenceDurationValue">500</span>
  </div>
`;
document.body.appendChild(vadSettings);

// Add event listeners for VAD settings
['energyThreshold', 'minSpeechDuration', 'silenceDuration'].forEach(id => {
  const input = document.getElementById(id) as HTMLInputElement;
  const valueSpan = document.getElementById(`${id}Value`)!;
  input.oninput = () => {
    valueSpan.textContent = input.value;
    if (vadProcessor) {
      vadProcessor.updateConfig({
        [id]: parseFloat(input.value),
      });
    }
  };
});

// Initialize the audio pipeline
async function initializeAudio() {
  // Stop recording function
  async function stopRecording() {
    console.log('Stopping recording...');
    isRecording = false;

    // Stop the pipeline
    if (pipeline) {
      await pipeline.stop();
      await pipeline.cleanup();
    }

    // Calculate duration
    const duration = (Date.now() - startTime) / 1000;
    console.log('Final recording state:', {
      frames: recordedFrames.length,
      duration,
      sampleRate: recordedFrames[0]?.sampleRate ?? 48000,
      bufferSize: recordedFrames[0]?.data.length ?? 0,
    });

    // Reset references
    pipeline = null;
    transport = null;
    vadProcessor = null;

    // Update UI
    updateUI('stopped');
    console.log(`Recording stopped with ${recordedFrames.length} frames`);
  }

  // Record button click handler
  document.getElementById('recordBtn')!.onclick = async () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    try {
      // Reset state
      isRecording = true;
      recordedFrames = [];
      startTime = Date.now();

      // Create new transport for recording
      console.log('Creating recording transport...');
      const recordingTransport = new LocalAudioTransport({
        inputEnabled: true,
        outputEnabled: false,
        sampleRate: 48000,
        channels: 1,
        bufferSize: 2048,
      });

      // Create VAD processor
      vadProcessor = new VADProcessor({
        energyThreshold: parseFloat((document.getElementById('energyThreshold') as HTMLInputElement).value),
        minSpeechDuration: parseFloat((document.getElementById('minSpeechDuration') as HTMLInputElement).value),
        silenceDuration: parseFloat((document.getElementById('silenceDuration') as HTMLInputElement).value),
        sampleRate: 48000,
      });

      // Add VAD state handler
      vadProcessor.addEventHandler('vad_state_changed', (_event: string, state: VADState) => {
        const { isActive, energy } = state;
        vadStatus.textContent = `Voice Activity: ${isActive ? 'Active' : 'Inactive'} (Energy: ${energy.toFixed(4)})`;
        vadStatus.style.color = isActive ? 'green' : 'red';
      });

      // Create pipeline with VAD
      const recordingPipeline = new Pipeline({
        name: 'AudioRecorder',
        enableMetrics: true,
      });

      // Add processors to pipeline
      recordingPipeline.addProcessor(recordingTransport);
      recordingPipeline.addProcessor(vadProcessor);

      // Add frame handler to transport
      recordingTransport.addEventHandler('frame_processed', async (_event: string, frame: BaseFrame) => {
        if (!isRecording || frame.type !== 'audio') return;

        const audioFrame = frame as Frame & { type: 'audio' };
        if (!audioFrame.data || audioFrame.data.length === 0) {
          console.warn('Invalid audio frame:', audioFrame);
          return;
        }

        // Store frame with a deep copy of the data
        const storedFrame: StoredFrame = {
          data: new Float32Array(audioFrame.data),
          timestamp: audioFrame.timestamp,
          sampleRate: audioFrame.sampleRate,
          channels: audioFrame.channels,
        };

        recordedFrames.push(storedFrame);
        console.log('Frame stored:', {
          totalFrames: recordedFrames.length,
          frameSize: storedFrame.data.length,
          sampleRate: storedFrame.sampleRate,
          timestamp: storedFrame.timestamp,
        });
      });

      // Start pipeline
      await recordingPipeline.start();

      // Update global references
      transport = recordingTransport;
      pipeline = recordingPipeline;

      // Create visualizer
      createVisualizer(recordingTransport);

      // Update UI
      updateUI('recording');
      console.log('Started recording with VAD');
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Check console for details.');
      isRecording = false;
      updateUI('stopped');
    }
  };

  // Stop button
  document.getElementById('stopBtn')!.onclick = async () => {
    try {
      console.log('Stopping recording...');
      isRecording = false;

      // Log final state
      if (transport && pipeline) {
        const finalConfig = transport.getConfig();
        console.log('Final recording state:', {
          frames: recordedFrames.length,
          duration: (Date.now() - startTime) / 1000,
          sampleRate: finalConfig.sampleRate,
          bufferSize: finalConfig.bufferSize,
        });

        // Stop the pipeline
        await pipeline.stop();
        await pipeline.cleanup();

        // Clear references
        transport = null;
        pipeline = null;
      }

      console.log(`Recording stopped with ${recordedFrames.length} frames`);
      updateUI('stopped');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      alert('Failed to stop recording. Check console for details.');
    }
  };

  // Replay button
  document.getElementById('replayBtn')!.onclick = async () => {
    if (recordedFrames.length === 0) {
      alert('No recording to replay!');
      return;
    }

    try {
      console.log('Starting playback:', {
        totalFrames: recordedFrames.length,
        firstFrame: {
          dataLength: recordedFrames[0].data.length,
          sampleRate: recordedFrames[0].sampleRate,
          channels: recordedFrames[0].channels,
          first10Samples: Array.from(recordedFrames[0].data.slice(0, 10)),
        },
      });
      updateUI('replaying');

      // Create new transport for playback
      const playbackTransport = new LocalAudioTransport({
        inputEnabled: false,
        outputEnabled: true,
        sampleRate: 48000, // Use fixed sample rate
        channels: 1,
        bufferSize: 2048, // Use larger buffer for smoother playback
      });

      const playbackPipeline = new Pipeline({
        name: 'AudioPlayer',
        enableMetrics: true,
      });

      playbackPipeline.addProcessor(playbackTransport);
      await playbackPipeline.start();

      // Update global reference for visualizer
      transport = playbackTransport;
      pipeline = playbackPipeline;
      createVisualizer(playbackTransport);

      // Concatenate frames into a single buffer for smoother playback
      const totalSamples = recordedFrames.reduce((sum, frame) => sum + frame.data.length, 0);
      const audioBuffer = new Float32Array(totalSamples);
      let offset = 0;

      recordedFrames.forEach(frame => {
        audioBuffer.set(frame.data, offset);
        offset += frame.data.length;
      });

      // Create larger chunks for playback
      const chunkSize = 2048; // Larger chunks for smoother playback
      const chunks: Frame[] = [];

      for (let i = 0; i < audioBuffer.length; i += chunkSize) {
        const chunk = audioBuffer.slice(i, Math.min(i + chunkSize, audioBuffer.length));
        chunks.push({
          type: 'audio',
          data: chunk,
          timestamp: (i / 48000) * 1000, // Convert samples to ms
          sampleRate: 48000,
          channels: 1,
        });
      }

      console.log('Playback setup:', {
        originalFrames: recordedFrames.length,
        totalSamples,
        chunksCreated: chunks.length,
        chunkSize,
      });

      // Play back chunks with proper timing
      const chunkInterval = (chunkSize / 48000) * 1000; // ms per chunk
      console.log(`Playing chunks with ${chunkInterval}ms interval`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        await playbackTransport.output().processFrame(chunk, FrameDirection.DOWNSTREAM);
        await new Promise(resolve => setTimeout(resolve, chunkInterval));

        // Update progress
        const progress = Math.round(((i + 1) / chunks.length) * 100);
        document.getElementById('status')!.textContent = `Replaying recording... ${progress}%`;
      }

      await playbackPipeline.stop();
      await playbackPipeline.cleanup();

      // Clear references
      transport = null;
      pipeline = null;

      updateUI('stopped');
    } catch (error) {
      console.error('Failed to replay recording:', error);
      alert('Failed to replay recording. Check console for details.');
      updateUI('stopped');
    }
  };

  // Initialize UI
  updateUI('ready');
}

// Initialize when the page loads
initializeAudio().catch(console.error);
