import { connectToOpenAIRealtime, Tool } from '@/lib/realtime';
import { useState } from 'react';
import { MastraClient } from '@mastra/client-js';

const mastra = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

export function useRealtimeState() {
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [model, setModel] = useState('gpt-4o-realtime-preview-2024-12-17');
  const [voice, setVoice] = useState('verse');
  const [error, setError] = useState<string | null>(null);

  return {
    connectionState,
    setConnectionState,
    error,
    setError,
    model,
    setModel,
    voice,
    setVoice,
  };
}

export function useRealtimeSession() {
  const { connectionState, setConnectionState, setError, model, voice } = useRealtimeState();

  const createSession = async ({
    initialMessage,
    instructions,
    browserTools,
    onMessage,
    onTextPart,
    onReasoningPart,
    onToolCallPart,
    onToolResultPart
  }: {
    instructions: string;
    initialMessage: string;
    browserTools: Tool<any>[];
    onMessage?: (data: { type: string; data: unknown }) => void;
    onTextPart?: (data: string) => void;
    onReasoningPart?: (data: string) => void;
    onToolCallPart?: (data: { toolCallName: string; args: unknown }) => void;
    onToolResultPart?: (data: { toolCallName: string; args: unknown }) => void;
  }) => {
    try {
      setConnectionState('pending');

      await connectToOpenAIRealtime({
        mastra,
        model,
        voice,
        browserTools,
        instructions,
        initialMessage,
        onMessage,
        onTextPart,
        onReasoningPart,
        onToolCallPart,
        onToolResultPart
      });

      setConnectionState('connected');
    } catch (error) {
      console.error(error);
      setError((error as Error).message);
      setConnectionState('error');
    }
  };

  return {
    connectionState,
    createSession,
  };
}
