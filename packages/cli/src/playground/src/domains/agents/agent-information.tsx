import { MastraClient } from '@mastra/client-js';
import { Terminal, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAgent } from '@/hooks/use-agents';

import { AgentDetails } from './agent-details';
import { AgentEndpoints } from './agent-endpoints';
import { AgentLogs } from './agent-logs';
import { PromptBuilder } from './prompt-builder';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

export function AgentInformation({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  const [nextPrompt, setNextPrompt] = useState('');
  const [nextExplanation, setNextExplanation] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { isLoading, agent } = useAgent(agentId);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(nextPrompt);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const applyChanges = async () => {
    if (!nextPrompt) return;

    setIsUpdating(true);
    try {
      // TODO: Implement the API call to update the agent's instructions
      console.log('Updating agent instructions...');
    } catch (error) {
      console.error('Failed to update agent instructions:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Tabs defaultValue="details">
      <TabsList className="flex shrink-0 border-b">
        <TabsTrigger value="details" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Details
          </p>
        </TabsTrigger>
        <TabsTrigger value="prompt_builder" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Prompt Builder
          </p>
        </TabsTrigger>
        <TabsTrigger value="endpoints" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Endpoints
          </p>
        </TabsTrigger>
        <TabsTrigger value="logs" className="group">
          <p className="text-xs p-3 text-mastra-el-3 group-data-[state=active]:text-mastra-el-5 group-data-[state=active]:border-b-2 group-data-[state=active]:pb-2.5 border-white">
            Log Drains
          </p>
        </TabsTrigger>
        <button className="group" onClick={() => navigate(`/agents/${agentId}/evals`)}>
          <p className="text-xs p-3 text-mastra-el-3">Evals</p>
        </button>
      </TabsList>
      <TabsContent value="details">{agentId ? <AgentDetails agentId={agentId} /> : null}</TabsContent>
      <TabsContent value="endpoints">
        <AgentEndpoints agentId={agentId} />
      </TabsContent>
      <TabsContent value="logs">
        <AgentLogs agentId={agentId} />
      </TabsContent>
      <TabsContent value="prompt_builder">
        {isLoading ? <>Loading...</> : <PromptBuilder agentId={agentId} instructions={agent?.instructions} />}
      </TabsContent>
    </Tabs>
  );
}
