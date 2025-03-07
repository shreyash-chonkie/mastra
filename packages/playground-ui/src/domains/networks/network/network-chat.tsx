import { useChatRuntime } from '@assistant-ui/react-ai-sdk';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { Thread } from '@/components/assistant-ui/thread';
import { MastraRuntimeProvider } from '@/services/mastra-runtime-provider';
import { ChatProps } from '@/types';
import { Brain } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ToolFallback } from '@/domains/networks/network/tool-fallback';

export const NetworkChat = ({
  agentId,
  agentName,
  agents,
  threadId,
  initialMessages,
  memory,
  baseUrl,
  refreshThreadList,
}: ChatProps & { agents: string[] }) => {
  const runtime = useChatRuntime({
    api: `/api/networks/${agentId}/stream`,
  });

  return (
    <>
      <AssistantRuntimeProvider runtime={runtime}>
        <Thread memory={memory} ToolFallback={ToolFallback} />
      </AssistantRuntimeProvider>

      {/* <MastraRuntimeProvider
                agentId={agentId}
                agentName={agentName}
                threadId={threadId}
                initialMessages={initialMessages}
                memory={memory}
                baseUrl={baseUrl}
                refreshThreadList={refreshThreadList}
                type="network"
            >
                <NetworkAgentTool />
                <Thread memory={memory} />
            </MastraRuntimeProvider> */}
    </>
  );
};
