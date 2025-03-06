import { Thread } from '@/components/assistant-ui/thread';
import { makeAssistantToolUI } from '@assistant-ui/react';
import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';

type WebSearchArgs = {
  query: string;
};

type WebSearchResult = {
  title: string;
  description: string;
  url: string;
};

export const WebSearchToolUI = makeAssistantToolUI<WebSearchArgs, WebSearchResult>({
  toolName: 'Research_Strategist',
  render: ({ args, status }) => {
    return <p>Research Strategist({args.query})</p>;
  },
});

export const NetworkChat = ({
  agentId,
  agentName,
  threadId,
  initialMessages,
  memory,
  baseUrl,
  refreshThreadList,
}: ChatProps) => {
  return (
    <MastraRuntimeProvider
      agentId={agentId}
      agentName={agentName}
      threadId={threadId}
      initialMessages={initialMessages}
      memory={memory}
      baseUrl={baseUrl}
      refreshThreadList={refreshThreadList}
      type="network"
    >
      <WebSearchToolUI />
      <Thread memory={memory} />
    </MastraRuntimeProvider>
  );
};
