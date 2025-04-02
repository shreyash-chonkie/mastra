// https://platform.openai.com/docs/guides/realtime-webrtc

import { GetAgentResponse, MastraClient } from '@mastra/client-js';
import { AnyZodObject, z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ExecuteToolInputFn<I> = (input: I, { connection }: { connection: Connection }) => void;

export interface Tool<I = unknown> {
  id: string;
  inputSchema: AnyZodObject;
  description: string;
  execute: ExecuteToolInputFn<I>;
}

export interface Connection {
  sendMessage: (message: unknown) => void;
  sendResponse: (instructions: string) => void;
  sendSessionUpdate: (session: {
    instructions?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | 'required';
  }) => void;
}

function fromBrowserTools(tools: Tool[]): unknown[] {
  return tools.map(tool => ({
    type: 'function',
    name: tool.id,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema),
  }));
}

function fromMastraAgents(agents: Record<string, GetAgentResponse>): unknown[] {
  return Object.keys(agents).map(agentId => {
    const agent = agents[agentId];
    return {
      type: 'function',
      name: agentId,
      description: agent.instructions,
      parameters: zodToJsonSchema(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
        }),
      ),
    };
  });
}

export async function connectToOpenAIRealtime({
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
}: {
  mastra: MastraClient;
  model: string;
  voice: string;
  browserTools: Tool[];
  instructions: string;
  initialMessage: string;
  onMessage?: (data: { type: string; data: unknown }) => void;
  onTextPart?: (data: string) => void;
  onReasoningPart?: (data: string) => void;
  onToolCallPart?: (data: { toolCallName: string; args: unknown }) => void;
  onToolResultPart?: (data: { toolCallName: string; args: unknown }) => void;
}) {
  const agents = await mastra.getAgents();

  const response = await createSession({ model, voice });

  const EPHEMERAL_KEY = response.client_secret.value;

  // Create a peer connection
  const pc = new RTCPeerConnection();

  // Set up to play remote audio from the model
  const audioEl = document.createElement('audio');
  audioEl.autoplay = true;
  pc.ontrack = e => (audioEl.srcObject = e.streams[0]);

  // Add local audio track for microphone input in the browser
  const ms = await navigator.mediaDevices.getUserMedia({
    audio: true,
  });
  pc.addTrack(ms.getTracks()[0]);

  // Set up data channel for sending and receiving events
  const dc = pc.createDataChannel('oai-events');
  dc.addEventListener('message', async e => {
    // Realtime server events appear here!
    const data = JSON.parse(e.data);
    onMessage?.(data);

    if (data.type === 'session.created') {
      // Send the initial session update
      const openaiTools = [...fromBrowserTools(browserTools), ...fromMastraAgents(agents)];

      sendSessionUpdate({
        instructions,
        tools: openaiTools,
        tool_choice: 'auto',
      });

      sendResponse(initialMessage);
    } else if (data.type === 'response.done' && data.response.output) {
      for (const output of data.response.output) {
        if (output.type === 'function_call') {
          console.log('output', output);
          if (agents[output.name]) {
            const agent = mastra.getAgent(output.name);
            const input = JSON.parse(output.arguments);
            const res = await agent.stream(input);

            let text = '';

            await res.processDataStream({
              onTextPart,
              onReasoningPart,
              onToolCallPart,
              onToolResultPart,
            });

            console.log(text);
            onMessage?.({ type: 'agent.done', data: text });
            sendResponse(`Render the information: ${text}`);

            return text;
          }

          const tool = browserTools.find(t => t.id === output.name);
          if (tool) {
            const input = JSON.parse(output.arguments);
            const result = await tool.execute(input, { connection });
            console.log(result);
            return result;
          }
        }
      }
    }
  });

  // Start the session using the Session Description Protocol (SDP)
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const sdpResponse = await sendAnswerSDP(model, offer, EPHEMERAL_KEY);

  const answer = {
    type: 'answer' as const,
    sdp: sdpResponse,
  };
  await pc.setRemoteDescription(answer);

  const sendMessage = (message: unknown) => {
    dc.send(JSON.stringify(message));
  };

  const sendSessionUpdate = (session: {
    instructions?: string;
    tools?: unknown[];
    tool_choice?: 'auto' | 'none' | 'required';
  }) => {
    // https://platform.openai.com/docs/guides/realtime-model-capabilities#session-lifecycle-events
    sendMessage({
      type: 'session.update',
      session,
    });
  };

  const sendResponse = (instructions: string) => {
    sendMessage({
      type: 'response.create',
      response: {
        instructions,
      },
    });
  };

  const connection = {
    sendMessage,
    sendResponse,
    sendSessionUpdate,
  };

  return connection;
}

async function createSession({
  model,
  voice,
}: {
  model: string;
  voice: string;
}): Promise<{ client_secret: { value: string } }> {
  const response = await fetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ model, voice }),
    headers: {
      'Content-Type': 'application/json',
    },
  });
  return response.json();
}

async function sendAnswerSDP(model: string, offer: RTCSessionDescriptionInit, clientSecret: string) {
  const response = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
    method: 'POST',
    body: offer.sdp,
    headers: {
      Authorization: `Bearer ${clientSecret}`,
      'Content-Type': 'application/sdp',
    },
  });
  return response.text();
}
