import { MastraVector, Step, Workflow } from '@mastra/core';
import { ElevenLabsTTS } from '@mastra/tts';
import path from 'path';
import { readPdfText } from 'pdf-text-reader';
import { z } from 'zod';

import { generateAndPlayAudio } from '../tts';
import { insertDocument } from '../vectors';

const extractText = new Step({
  id: 'extract-text',
  description: 'Extracts text from a PDF file',
  inputSchema: z.object({
    filename: z.string().describe('The PDF file to process'),
  }),
  execute: async ({ context: { filename }, mastra }) => {
    console.log('---------------------------');
    console.log('Extracting text from PDF file:', filename);
    const pdfPath = path.join(process.cwd(), 'documents', filename);
    const text = await readPdfText({ url: pdfPath });

    const vectorStore = mastra?.vectors?.pgVector as MastraVector;
    await insertDocument(text, vectorStore);
  },
});

const analyzePdfContent = new Step({
  id: 'analyze-content',
  description: 'Analyzes the PDF content and creates summary',
  outputSchema: z.object({
    podcastScript: z.string(),
  }),
  execute: async ({ mastra }) => {
    console.log('---------------------------');
    const agent = mastra?.agents?.whitePaperAgent;

    const analysisPrompt = `Use the graphRagTool to query the vector store and create an engaging podcast episode about this research paper.

    Create a podcast script that includes:
    - An engaging intro ("Welcome to WhiteSpace, the podcast that breaks down complex research papers...")
    - A brief overview of the paper's topic and why it matters
    - Key findings explained in a conversational tone
    - Real-world implications and applications
    - A compelling outro with key takeaways
    - Have two podcast hosts (Dane and Shane) discuss the findings of the paper.
    - Have witty banter between the two hosts.

    Notes: 
    - The podcast script should be in the following format:
    - HOST_A: Welcome to WhiteSpace! I'm your host Alex.
    - HOST_B: And I'm Taylor. Today we're diving into an fascinating paper about...
    - HOST_A: Let me break down the main findings...

    Keep the tone friendly and accessible, as if explaining to an interested non-expert. 
    Use natural, conversational language throughout. When technical terms are necessary, explain them clearly.
    Aim for a 3-5 minute podcast length.
    Do not include any text not related to the podcast script.
    `;

    const result = await agent?.generate(analysisPrompt);

    return {
      podcastScript: result?.text ?? '',
    };
  },
});

const addPdfAudio = new Step({
  id: 'add-pdf-audio',
  description: 'Creates multi-voice podcast audio',
  inputSchema: z.object({
    podcastScript: z.string().describe('The podcast script'),
  }),
  execute: async ({ context: { podcastScript }, mastra }) => {
    console.log('---------------------------');
    console.log(podcastScript);

    const segments = podcastScript
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [speaker, ...textParts] = line.split(':');
        return {
          speaker: speaker.trim(),
          text: textParts.join(':').trim(),
        };
      });

    const tts = new ElevenLabsTTS({
      model: {
        name: 'eleven_multilingual_v2',
        apiKey: process.env.ELEVENLABS_API_KEY!,
      },
    });

    console.log(process.env.ELEVENLABS_API_KEY);

    const voices = await tts.voices();

    try {
      for (const { speaker, text } of segments) {
        const voiceName = speaker === 'DANE' ? 'Daniel' : 'Bill';
        console.log('Using voice:', voiceName);
        const voiceId = voices?.find(voice => voice.name === voiceName)?.voice_id;

        if (!voiceId) {
          console.error(`Voice not found for ${voiceName}`);
          continue;
        }

        await generateAndPlayAudio(tts, text, voiceId);
        console.log('Segment complete');
      }
    } catch (error) {
      console.error('Error in audio playback:', error);
      throw error;
    }
  },
});

const whitePaperWorkflow = new Workflow({
  name: 'whitePaperWorkflow',
  triggerSchema: z.object({
    filename: z.string().describe('The PDF file to summarize'),
  }),
})
  .step(extractText, {
    variables: {
      filename: {
        step: 'trigger',
        path: 'filename',
      },
    },
  })
  .then(analyzePdfContent)
  .then(addPdfAudio, {
    variables: {
      podcastScript: {
        step: analyzePdfContent,
        path: 'podcastScript',
      },
    },
  });

whitePaperWorkflow.commit();

export { whitePaperWorkflow };
