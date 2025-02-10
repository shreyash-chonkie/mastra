import { MastraClient } from '@mastra/client-js';
import { Terminal } from 'lucide-react';
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

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

export function AgentInformation({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  const [nextPrompt, setNextPrompt] = useState('');
  const [nextExplanation, setNextExplanation] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const { isLoading, agent } = useAgent(agentId);
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
        {isLoading ? (
          <>Loading...</>
        ) : (
          <section className="border rounded-md bg-mastra-bg-1">
            {nextPrompt ? (
              <>
                <Alert>
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>New Prompt Generated</AlertTitle>
                  <AlertDescription>
                    Review the improved prompt below. If you'd like to use this prompt, copy it and update your agent's
                    instructions manually.
                  </AlertDescription>
                </Alert>
                <div className="max-h-[400px] overflow-y-auto">
                  <pre className="text-xs p-3 text-mastra-el-3 whitespace-pre-wrap font-sans">{nextPrompt}</pre>
                  {nextExplanation && (
                    <div className="px-3 pb-3 text-xs text-mastra-el-3">
                      <h3 className="font-medium mb-1">Changes Made:</h3>
                      <p>{nextExplanation}</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="max-h-[400px] overflow-y-auto">
                <pre className="text-xs p-3 text-mastra-el-3 whitespace-pre-wrap font-sans">{agent?.instructions}</pre>
              </div>
            )}
            <div className="flex gap-2 justify-end p-3 border-t">
              <Button
                onClick={async () => {
                  setIsImproving(true);
                  try {
                    const a = client.getAgent(agentId);
                    const response = await a.generate({
                      messages: [
                        {
                          role: 'user',
                          content: `Iterate and improve this prompt:${nextPrompt || agent?.instructions}`,
                        },
                      ],
                      output: z.object({
                        prompt: z.string(),
                        explanation: z.string(),
                      }),
                    });

                    setNextPrompt(response.object.prompt);
                    setNextExplanation(response.object.explanation);
                  } catch (error) {
                    console.error(error);
                  } finally {
                    setIsImproving(false);
                  }
                }}
                disabled={isImproving}
              >
                {isImproving ? 'Improving...' : 'Improve'}
              </Button>

              {nextPrompt && (
                <Button
                  onClick={() => {
                    setNextPrompt('');
                    setNextExplanation('');
                  }}
                  variant="outline"
                >
                  Reset
                </Button>
              )}
            </div>
          </section>
        )}
      </TabsContent>
    </Tabs>
  );
}
