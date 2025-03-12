'use client';

import {
  AppendMessage,
  AssistantRuntimeProvider,
  SpeechSynthesisAdapter,
  ThreadMessageLike,
  useExternalStoreRuntime,
} from '@assistant-ui/react';
import { MastraClient } from '@mastra/client-js';
import { ReactNode, useEffect, useState } from 'react';

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
  refreshThreadList,
}: Readonly<{
  children: ReactNode;
}> &
  ChatProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [messages, setMessages] = useState<ThreadMessageLike[]>([]);
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);
  const [speechAdapter, setSpeechAdapter] = useState<SpeechSynthesisAdapter | null>(null);

  const mastra = new MastraClient({
    baseUrl: baseUrl || '',
  });

  useEffect(() => {
    if (messages.length === 0 || currentThreadId !== threadId) {
      if (initialMessages && threadId && memory) {
        setMessages(initialMessages);
        setCurrentThreadId(threadId);
      }
    }
  }, [initialMessages, threadId, memory, messages]);

  useEffect(() => {
    async function initSpeechAdapter() {
      try {
        setSpeechAdapter({
          speak: (text: string) => {
            let currentStatus: SpeechSynthesisAdapter.Status = { type: 'starting' };
            const subscribers = new Set<() => void>();
            let audioElement: HTMLAudioElement | null = null;

            const handleStatusChange = (status: SpeechSynthesisAdapter.Status, immediate = false) => {
              currentStatus = status;
              const notify = () => {
                subscribers.forEach(callback => callback());
              };

              if (immediate) {
                notify();
              } else {
                queueMicrotask(notify);
              }
            };

            const utterance = {
              get status() {
                return currentStatus;
              },
              cancel: () => {
                if (audioElement) {
                  audioElement.pause();
                  audioElement.currentTime = 0;
                  if (audioElement.src) {
                    URL.revokeObjectURL(audioElement.src);
                  }
                }
                handleStatusChange({ type: 'ended', reason: 'cancelled' });
              },
              subscribe: (callback: () => void) => {
                if (currentStatus.type === 'ended') {
                  let cancelled = false;
                  queueMicrotask(() => {
                    if (!cancelled) callback();
                  });
                  return () => {
                    cancelled = true;
                  };
                } else {
                  subscribers.add(callback);
                  callback(); // Call immediately with current status
                  return () => {
                    subscribers.delete(callback);
                  };
                }
              },
            };

            // Use the existing speak endpoint
            fetch(`${baseUrl}/api/agents/${agentId}/speak`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                input: text,
                options: {},
              }),
            })
              .then(async response => {
                if (!response.ok) {
                  throw new Error('Failed to get audio stream');
                }
                const blob = await response.blob();
                audioElement = new Audio();
                audioElement.src = URL.createObjectURL(blob);

                audioElement.onloadeddata = () => {
                  handleStatusChange({ type: 'running' });
                };

                audioElement.onplay = () => {
                  if (currentStatus.type !== 'running') {
                    handleStatusChange({ type: 'running' });
                  }
                };

                audioElement.onpause = () => {
                  if (currentStatus.type === 'running') {
                    handleStatusChange({ type: 'ended', reason: 'cancelled' });
                  }
                };

                audioElement.onended = () => {
                  handleStatusChange({ type: 'ended', reason: 'finished' });
                  if (audioElement?.src) {
                    URL.revokeObjectURL(audioElement.src);
                  }
                };

                audioElement.onerror = error => {
                  handleStatusChange({ type: 'ended', reason: 'error', error });
                  if (audioElement?.src) {
                    URL.revokeObjectURL(audioElement.src);
                  }
                };

                return audioElement.play();
              })
              .catch(error => {
                console.error('Speech synthesis error:', error);
                handleStatusChange({ type: 'ended', reason: 'error', error });
              });

            return utterance;
          },
        });
      } catch (error) {
        console.error('Failed to initialize speech adapter:', error);
      }
    }
    initSpeechAdapter();
  }, [agentId]);

  const onNew = async (message: AppendMessage) => {
    if (message.content[0]?.type !== 'text') throw new Error('Only text messages are supported');

    const input = message.content[0].text;
    setMessages(currentConversation => [...currentConversation, { role: 'user', content: input }]);
    setIsRunning(true);

    try {
      const agent = mastra.getAgent(agentId);
      const response = await agent.stream({
        messages: [
          {
            role: 'user',
            content: input,
          },
        ],
        runId: agentId,
        ...(memory ? { threadId, resourceId: agentId } : {}),
      });

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
          buffer += chunk;
          const matches = buffer.matchAll(/0:"((?:\\.|(?!").)*?)"/g);
          const errorMatches = buffer.matchAll(/3:"((?:\\.|(?!").)*?)"/g);

          if (errorMatches) {
            for (const match of errorMatches) {
              const content = match[1];
              errorMessage += content;
              setMessages(currentConversation => [
                ...currentConversation.slice(0, -1),
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: errorMessage }],
                  isError: true,
                },
              ]);
            }
          }

          for (const match of matches) {
            const content = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
            assistantMessage += content;
            setMessages(currentConversation => {
              const message: ThreadMessageLike = {
                role: 'assistant',
                content: [{ type: 'text', text: assistantMessage }],
              };

              if (!assistantMessageAdded) {
                assistantMessageAdded = true;
                return [...currentConversation, message];
              }
              return [...currentConversation.slice(0, -1), message];
            });
          }
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
    ...(speechAdapter
      ? {
          adapters: {
            speech: speechAdapter,
          },
        }
      : {}),
  });

  return <AssistantRuntimeProvider runtime={runtime}> {children} </AssistantRuntimeProvider>;
}
