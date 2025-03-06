import React, { useCallback } from 'react';

import { MastraClient } from '@mastra/client-js';

import { BaseChat } from './chat-base';
import { NetworkChatProps } from './types';

export function NetworkChat({
  networkId,
  initialMessages = [],
  networkName,
  threadId,
  memory,
  buildUrl,
}: NetworkChatProps) {
  const handleSubmit = useCallback(
    async (params: { messages: { content: string; role: 'user' }[]; threadId: string; resourceId: string }) => {
      const client = new MastraClient({
        baseUrl: buildUrl || '',
      });

      return client.getNetwork(networkId).stream(params);
    },
    [buildUrl],
  );

  return (
    <BaseChat
      resourceId={networkId}
      initialMessages={initialMessages}
      resourceName={networkName}
      threadId={threadId}
      memory={memory}
      buildUrl={buildUrl}
      onSubmit={handleSubmit}
    />
  );
}
