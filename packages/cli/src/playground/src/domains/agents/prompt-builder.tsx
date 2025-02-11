import { MastraClient } from '@mastra/client-js';
import { Terminal, BookmarkPlus, Check, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { z } from 'zod';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
});

interface PromptVersion {
  id: string;
  content: string;
  explanation?: string;
  timestamp: Date;
  isActive: boolean;
}

interface PromptBuilderProps {
  agentId: string;
  instructions?: string;
  evals?: any[];
}

function ClickToCopy({ content }: { content: string }) {
  const [hasCopied, setHasCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div onClick={copyToClipboard} className="relative group cursor-pointer">
      <pre className="text-xs p-3 text-mastra-el-3 whitespace-pre-wrap font-sans">{content}</pre>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-mastra-bg-2 text-mastra-el-3 text-xs py-1 px-2 rounded">
        {hasCopied ? 'Copied!' : 'Click to copy'}
      </div>
    </div>
  );
}

export function PromptBuilder({ agentId, instructions, evals }: PromptBuilderProps) {
  const [nextPrompt, setNextPrompt] = useState('');
  const [nextExplanation, setNextExplanation] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>(() => {
    const saved = localStorage.getItem(`prompt-versions-${agentId}`);
    const savedVersions = saved ? JSON.parse(saved) : [];

    if (instructions && !savedVersions.some((v: PromptVersion) => v.id === 'original')) {
      return [
        {
          id: 'original',
          content: instructions,
          timestamp: new Date(0), // This ensures it appears first
          isActive: false,
          explanation: 'Original Instructions',
        },
        ...savedVersions,
      ];
    }

    return savedVersions;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeVersion, setActiveVersion] = useState<string>(() => {
    const saved = localStorage.getItem(`active-version-${agentId}`);
    return saved || '';
  });
  const [isVersionsPanelOpen, setIsVersionsPanelOpen] = useState(false);

  // Persist versions whenever they change
  useEffect(() => {
    localStorage.setItem(`prompt-versions-${agentId}`, JSON.stringify(versions));
  }, [versions, agentId]);

  // Persist active version whenever it changes
  useEffect(() => {
    localStorage.setItem(`active-version-${agentId}`, activeVersion);
  }, [activeVersion, agentId]);

  const saveVersion = async () => {
    if (!nextPrompt) return;

    setIsSaving(true);
    try {
      const newVersion: PromptVersion = {
        id: Date.now().toString(),
        content: nextPrompt,
        explanation: nextExplanation,
        timestamp: new Date(),
        isActive: false,
      };

      setVersions(prev => [...prev, newVersion]);
    } catch (error) {
      console.error('Failed to save version:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const setInstructions = async (content: string) => {
    const response = await fetch(`http://localhost:4111/api/agents/${agentId}/instructions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instructions: content,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update agent instructions');
    }
  };

  const reset = () => {
    if (!instructions) return;
    setNextPrompt(instructions);
    setNextExplanation('');
    setActiveVersion(null);
    setInstructions(instructions).catch(error => {
      console.error('Failed to reset instructions:', error);
    });
  };

  const setVersionActive = async (versionId: string) => {
    setIsUpdating(true);
    try {
      const version = versions.find(v => v.id === versionId);
      if (!version) return;

      // Update UI state
      setActiveVersion(versionId);
      setVersions(prev =>
        prev.map(v => ({
          ...v,
          isActive: v.id === versionId,
        })),
      );
      setNextPrompt(version.content);
      setNextExplanation(version.explanation || '');

      // Update agent instructions
      await setInstructions(version.content);
    } catch (error) {
      console.error('Failed to set active version:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteVersion = (versionId: string) => {
    setVersions(prev => prev.filter(v => v.id !== versionId));
    if (activeVersion === versionId) {
      setActiveVersion('');
    }
  };

  if (!instructions) {
    return <div>Loading...</div>;
  }

  return (
    <section className="border rounded-md bg-mastra-bg-1">
      <div className="flex flex-col">
        <div className="flex-1">
          {nextPrompt ? (
            <>
              <Alert className="rounded-none border-t-0 border-x-0 border-b px-3">
                <Terminal className="h-4 w-4" />
                <AlertDescription className="text-xs text-mastra-el-3">
                  Review the improved prompt below. If you'd like to use this prompt, copy it and update your agent's
                  instructions manually.
                </AlertDescription>
              </Alert>
              <div className="max-h-[400px] overflow-y-auto">
                <ClickToCopy content={nextPrompt} />
                {nextExplanation && (
                  <div className="border-t bg-mastra-bg-2">
                    <div className="px-3 py-3 text-xs text-mastra-el-3">
                      <h3 className="font-medium mb-2 text-mastra-el-4">Changes Made:</h3>
                      <pre className="whitespace-pre-wrap font-sans">{nextExplanation}</pre>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <ClickToCopy content={instructions} />
            </div>
          )}

          <div className="flex gap-2 justify-end p-3 border-t">
            <Button
              onClick={async () => {
                setIsImproving(true);

                const BUILDER_PROMPT = `
                  Please improve this system prompt. Here is the current prompt:
                  ${nextPrompt || instructions}

                  ${
                    evals?.length
                      ? `
                  Here are the evaluation results for this prompt:
                  ${evals
                    .map(
                      evalObj => `
                  - ${evalObj.meta.metricName}: Score ${evalObj.result.score}
                    Input: ${evalObj.input || 'N/A'}
                    Reason: ${evalObj.result.info?.reason || 'N/A'}
                  `,
                    )
                    .join('\n')}
                  `
                      : ''
                  }

                  Please provide:
                  1. An improved version of the prompt
                  2. A brief explanation of the changes you made and why they will help improve performance
                `;

                console.log(BUILDER_PROMPT);

                try {
                  const a = client.getAgent('builder');
                  const response = await a.generate({
                    messages: [
                      {
                        role: 'user',
                        content: BUILDER_PROMPT,
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
              <>
                <Button onClick={saveVersion} disabled={isSaving} variant="secondary" className="gap-2">
                  <BookmarkPlus className="h-4 w-4" />
                  {isSaving ? 'Saving...' : 'Save Version'}
                </Button>
                <Button onClick={reset} variant="outline">
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>

        {versions.length > 0 && (
          <div className="border-t">
            <div className="px-3 py-2 border-b bg-mastra-bg-2 sticky top-0 z-10">
              <h3 className="text-xs font-medium text-mastra-el-4">Saved Versions</h3>
            </div>
            <div className="max-h-[120px] overflow-y-auto">
              <div className="divide-y divide-mastra-bg-3">
                {versions.map(version => (
                  <div
                    key={version.id}
                    className={`group flex items-center justify-between text-xs px-3 py-2 hover:bg-mastra-bg-3 cursor-pointer ${
                      version.id === activeVersion ? 'bg-mastra-bg-2' : ''
                    }`}
                    onClick={() => setVersionActive(version.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-mastra-el-3 truncate flex-1">
                        {version.id === 'original'
                          ? 'Original Instructions'
                          : new Date(version.timestamp).toLocaleString()}
                      </span>
                      {version.id === activeVersion && (
                        <span className="text-green-500 flex-shrink-0">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <button
                      title="Delete Version"
                      onClick={e => {
                        e.stopPropagation();
                        deleteVersion(version.id);
                      }}
                      className={`${version.id === 'original' ? 'hidden' : 'opacity-0 group-hover:opacity-100'} transition-opacity p-1 hover:bg-mastra-bg-4 rounded ml-2`}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
