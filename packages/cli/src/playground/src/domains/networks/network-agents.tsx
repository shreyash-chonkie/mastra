import { useNetwork } from '@/hooks/use-networks';
import { Badge } from '@/components/ui/badge';
import { Brain } from 'lucide-react';

export function NetworkAgents({ networkId }: { networkId: string }) {
  const { network, isLoading } = useNetwork(networkId);

  if (isLoading || !network) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">Loading network agents...</p>
      </div>
    );
  }

  if (!network.agents || network.agents.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-mastra-el-4">No agents found in this network.</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-mastra-el-5 mb-3">Network Agents</h3>
      <div className="space-y-3">
        {network.agents.map((agent, index) => (
          <div key={index} className="bg-mastra-bg-2 p-3 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <div className="flex gap-2">
                <Brain className="h-4 w-4 text-mastra-el-4" />
                <h4 className="text-sm font-medium text-mastra-el-5">{agent.name}</h4>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-none text-xs min-w-[120px]">
                  {agent.provider}/{agent.modelId}
                </Badge>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
