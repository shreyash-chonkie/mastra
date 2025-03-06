import { Thread } from '@/components/assistant-ui/thread';

import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { NetworkChatProps } from '@/types';

export const NetworkChat = ({
  networkId,
  networkName,
  threadId,
  initialMessages,
  memory,
  buildUrl,
  refreshThreadList,
}: NetworkChatProps) => {
  return (
    <MastraRuntimeProvider
      agentId={networkId}
      agentName={networkName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      baseUrl={buildUrl}
      refreshThreadList={refreshThreadList}
    >
      <Thread memory={memory} />
    </MastraRuntimeProvider>
  );
};
