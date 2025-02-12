import { Terminal, Copy, Check, Wand2, ChevronRight, MessageSquare, Trash2, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { useAgent } from '@/hooks/use-agents';

interface PromptVersion {
  content: string;
  timestamp: Date;
  analysis?: string;
  status: 'original' | 'draft' | 'published' | 'active';
}

interface AgentPromptEnhancerProps {
  agentId: string;
}

export function AgentPromptEnhancer({ agentId }: AgentPromptEnhancerProps) {
  const { agent } = useAgent(agentId);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [copiedVersions, setCopiedVersions] = useState<Record<number, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [explanation, setExplanation] = useState('');
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [expandedAnalysis, setExpandedAnalysis] = useState<number | null>(null);
  const [versionToDelete, setVersionToDelete] = useState<number | null>(null);

  // Load versions from local storage on mount
  useEffect(() => {
    const storedVersions = localStorage.getItem(`agent-${agentId}-versions`);
    if (storedVersions) {
      const parsedVersions = JSON.parse(storedVersions);
      // Convert string dates back to Date objects
      setVersions(
        parsedVersions.map((v: any) => ({
          ...v,
          timestamp: new Date(v.timestamp),
        })),
      );
    } else if (agent?.instructions) {
      const initialVersions = [
        {
          content: agent.instructions,
          timestamp: new Date(),
          analysis: 'Original instructions',
          status: 'original' as const,
        },
      ];
      setVersions(initialVersions);
      localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(initialVersions));
    }
  }, [agent?.instructions, agentId]);

  // Save versions to local storage whenever they change
  useEffect(() => {
    if (versions.length > 0) {
      localStorage.setItem(`agent-${agentId}-versions`, JSON.stringify(versions));
    }
  }, [versions, agentId]);

  const copyToClipboard = async (text: string, versionIndex: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedVersions(prev => ({ ...prev, [versionIndex]: true }));
      setTimeout(() => {
        setCopiedVersions(prev => ({ ...prev, [versionIndex]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const enhancePrompt = async () => {
    if (!agent?.instructions) return;

    setIsEnhancing(true);
    try {
      const response = await fetch(`http://localhost:4111/api/agents/${agentId}/instructions/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions: agent.instructions,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to enhance prompt');
      }

      const data = await response.json();
      setEnhancedPrompt(data.new_prompt);
      setExplanation(data.explanation);

      const newVersion = {
        content: data.new_prompt,
        timestamp: new Date(),
        analysis: data.explanation,
        status: 'draft' as const,
      };
      setVersions(prev => [...prev, newVersion]);

      // Auto-expand the new version
      setExpandedVersion(versions.length);
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const applyChanges = async () => {
    if (!enhancedPrompt) return;

    const draftIndex = versions.findIndex(v => v.status === 'draft');
    if (draftIndex === -1) {
      // If no draft exists, create a new version
      const newVersion: PromptVersion = {
        content: enhancedPrompt,
        timestamp: new Date(),
        analysis: explanation,
        status: 'published' as const,
      };

      setVersions(prev => [...prev, newVersion]);
    } else {
      // Update existing draft version
      setVersions(prev =>
        prev.map((version, index) =>
          index === draftIndex
            ? { ...version, content: enhancedPrompt, analysis: explanation, status: 'published' as const }
            : version,
        ),
      );
    }

    // Clear the draft state
    setEnhancedPrompt('');
    setExplanation('');
  };

  const setVersionActive = async (version: PromptVersion, index: number) => {
    setIsUpdating(true);
    try {
      const response = await fetch(`http://localhost:4111/api/agents/${agentId}/instructions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions: version.content,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update instructions');
      }

      // Update version statuses
      setVersions(prev =>
        prev.map((v, i) => ({
          ...v,
          status: i === index ? 'active' : v.status === 'active' ? 'published' : v.status,
        })),
      );

      // Clear any draft state
      setEnhancedPrompt('');
      setExplanation('');
    } catch (error) {
      console.error('Failed to set version as active:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteVersion = (indexToDelete: number) => {
    // Don't allow deleting the original version
    if (indexToDelete === 0) return;

    setVersions(prev => {
      const newVersions = prev.filter((_, index) => index !== indexToDelete);
      // If we're deleting the currently expanded version, collapse it
      if (expandedVersion === indexToDelete) {
        setExpandedVersion(null);
      }
      if (expandedAnalysis === indexToDelete) {
        setExpandedAnalysis(null);
      }
      return newVersions;
    });

    // If we're deleting the latest version and it was a draft
    if (indexToDelete === versions.length - 1 && enhancedPrompt) {
      setEnhancedPrompt('');
      setExplanation('');
    }

    // Reset the version to delete
    setVersionToDelete(null);
  };

  return (
    <div className="grid p-4 h-full">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-mastra-el-5">Current Instructions</h3>
            </div>
            <Button variant="default" size="sm" onClick={enhancePrompt} disabled={isEnhancing || !agent?.instructions}>
              {isEnhancing ? (
                <>
                  <Terminal className="mr-2 h-3 w-3 animate-spin" />
                  Enhancing...
                </>
              ) : (
                <>
                  <Wand2 className="mr-2 h-3 w-3" />
                  Enhance
                </>
              )}
            </Button>
          </div>
          <ScrollArea className="h-[200px] rounded-md border bg-mastra-bg-2">
            <div className="p-2">
              <pre className="text-xs whitespace-pre-wrap font-mono">
                {enhancedPrompt || agent?.instructions?.trim()}
              </pre>
              {enhancedPrompt && (
                <div className="mt-2 flex items-center">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                    Draft - Save changes to apply
                  </span>
                </div>
              )}
            </div>
          </ScrollArea>
          {enhancedPrompt && (
            <div className="flex justify-end space-x-2 mt-4">
              <Button variant="outline" onClick={() => setEnhancedPrompt('')}>
                Cancel
              </Button>
              <Button onClick={applyChanges} disabled={!enhancedPrompt}>
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Version History */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-medium text-mastra-el-5">Version History</h3>
              <p className="text-xs text-mastra-el-3">Previous versions of the instructions</p>
            </div>
          </div>
          <div className="space-y-1">
            {versions.map((version, index) => (
              <div
                key={index}
                className={`rounded-md border ${expandedVersion === index ? 'border-mastra-purple/30' : 'border-mastra-bg-3'} bg-mastra-bg-2`}
              >
                <div
                  className="p-2 flex items-center justify-between cursor-pointer hover:bg-mastra-bg-3/50"
                  onClick={() => setExpandedVersion(expandedVersion === index ? null : index)}
                >
                  <div className="flex items-center space-x-2">
                    <ChevronRight
                      className={`h-3 w-3 transition-transform ${expandedVersion === index ? 'rotate-90 text-mastra-purple' : ''}`}
                    />
                    <div>
                      <div className="flex items-center space-x-2">
                        <p className="text-xs font-medium text-mastra-el-4">Version {index + 1}</p>
                        {version.status === 'active' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-500">
                            Active
                          </span>
                        )}
                        {version.status === 'original' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                            Original
                          </span>
                        )}
                        {version.status === 'draft' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-500">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-mastra-el-3">{version.timestamp.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    {version.analysis && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 hover:bg-mastra-bg-3 relative group"
                        onClick={e => {
                          e.stopPropagation();
                          setExpandedAnalysis(expandedAnalysis === index ? null : index);
                        }}
                      >
                        <MessageSquare
                          className={`h-3 w-3 ${expandedAnalysis === index ? 'text-mastra-purple' : ''}`}
                        />
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-mastra-bg-3 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          {expandedAnalysis === index ? 'Hide explanation' : 'View explanation'}
                        </span>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 hover:bg-mastra-bg-3 relative group"
                      onClick={e => {
                        e.stopPropagation();
                        copyToClipboard(version.content, index);
                      }}
                    >
                      {copiedVersions[index] ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-mastra-bg-3 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {copiedVersions[index] ? 'Copied!' : 'Copy to clipboard'}
                      </span>
                    </Button>
                    {version.status !== 'active' && version.status !== 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 hover:bg-mastra-bg-3 relative group"
                        onClick={e => {
                          e.stopPropagation();
                          setVersionActive(version, index);
                        }}
                        disabled={isUpdating}
                      >
                        <Play className="h-3 w-3" />
                        <span className="absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-mastra-bg-3 rounded text-[10px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                          Set as active
                        </span>
                      </Button>
                    )}
                    {index !== 0 &&
                      version.status !== 'active' && ( // Don't show delete button for original or active version
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 hover:bg-red-500/20"
                          onClick={e => {
                            e.stopPropagation();
                            setVersionToDelete(index);
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-red-400 hover:text-red-500" />
                        </Button>
                      )}
                  </div>
                </div>
                {(expandedVersion === index || expandedAnalysis === index) && (
                  <div className="px-2 pb-2 space-y-2">
                    {expandedAnalysis === index && version.analysis && (
                      <Alert className="py-1.5 bg-transparent border-none">
                        <AlertDescription className="text-[10px] text-mastra-el-4">{version.analysis}</AlertDescription>
                      </Alert>
                    )}
                    {expandedVersion === index && (
                      <ScrollArea className="h-[150px] rounded-md border border-mastra-bg-3">
                        <div className="p-2">
                          <pre className="text-xs whitespace-pre-wrap font-mono">{version.content}</pre>
                        </div>
                      </ScrollArea>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      <AlertDialog open={versionToDelete !== null} onOpenChange={() => setVersionToDelete(null)}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Version {versionToDelete !== null ? versionToDelete + 1 : ''}</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete this version? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (versionToDelete !== null) {
                  deleteVersion(versionToDelete);
                }
              }}
            >
              Delete
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </div>
  );
}
