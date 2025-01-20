import { ElevenLabsTTS } from '@mastra/tts';
import { writeFileSync } from 'fs';
import path from 'path';
import player from 'play-sound';

const audioPlayer = player({});

export async function generateAndPlayAudio(tts: ElevenLabsTTS, text: string, voiceId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const { audioResult } = await tts.generate({
        text,
        voice: voiceId,
      });

      const outputPath = path.join(process.cwd(), 'audio/output.mp3');

      console.log({ outputPath, text, voiceId });

      writeFileSync(outputPath, audioResult);

      // Play the audio file and wait for completion
      audioPlayer.play(outputPath, err => {
        if (err) {
          console.error('Error playing audio:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}
