'use client';

import {
  useExternalStoreRuntime,
  ThreadMessageLike,
  AppendMessage,
  AssistantRuntimeProvider,
} from '@assistant-ui/react';
import { MastraClient } from '@mastra/client-js';
import { useState, ReactNode, useEffect, useMemo, useCallback } from 'react';

import { ChatProps } from '@/types';

const convertMessage = (message: ThreadMessageLike): ThreadMessageLike => {
  return message;
};

export function MastraRuntimeProvider({
  children,
  agentId,
  initialMessages,
  agentName,
  memory,
  threadId,
  baseUrl,
  type = 'agent',
  refreshThreadList,
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);

  console.log(messages);

  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);

  useEffect(() => {
    if (messages.length === 0 || currentThreadId !== threadId) {
      if (initialMessages && threadId && memory) {
        setMessages(initialMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory, messages]);

  const mastra = new MastraClient({
    baseUrl: baseUrl || '',
  });

  const onNew = async (message: AppendMessage) => {
    console.log('ON NEW', message);
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
      let response;

      if (type === 'network') {
        const network = mastra.getNetwork(agentId);
        response = await network.stream({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
          runId: agentId,
          ...(memory ? { threadId, resourceId: agentId } : {}),
          onStepFinish: step => {
            console.log('Step finished', JSON.parse(step));
          },
        });
      } else {
        const agent = mastra.getAgent(agentId);
        response = await agent.stream({
          messages: [
            {
              role: 'user',
              content: input,
            },
          ],
          runId: agentId,
          ...(memory ? { threadId, resourceId: agentId } : {}),
        });
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let assistantMessage = '';
      let assistantMessageAdded = false;
      let errorMessage = '';

      if (!reader) {
        throw new Error('No reader found');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          console.log(chunk, 'CHUNK');
          buffer += chunk;
          buffer = '';
        }
      } finally {
        reader.releaseLock();
        setIsRunning(false);
        refreshThreadList?.();
      }
    } catch (error) {
      console.error('Error occured in MastraRuntimeProvider', error);
      setIsRunning(false);
    }
  };

  const runtime = useExternalStoreRuntime<any>({
    isRunning,
    messages,
    convertMessage,
    onNew,
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
