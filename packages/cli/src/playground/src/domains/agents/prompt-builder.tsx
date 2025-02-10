import { MastraClient } from '@mastra/client-js';
import { Terminal, BookmarkPlus, Check, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { z } from 'zod';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

export function PromptBuilder({ agentId, instructions }: PromptBuilderProps) {
  const [nextPrompt, setNextPrompt] = useState('');
  const [nextExplanation, setNextExplanation] = useState('');
  const [isImproving, setIsImproving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [versions, setVersions] = useState<PromptVersion[]>(() => {
    const saved = localStorage.getItem(`prompt-versions-${agentId}`);
    return saved ? JSON.parse(saved) : [];
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

  const setVersionActive = async (versionId: string) => {
    setIsUpdating(true);
    try {
      setActiveVersion(versionId);
      setVersions(prev =>
        prev.map(v => ({
          ...v,
          isActive: v.id === versionId,
        })),
      );

      const version = versions.find(v => v.id === versionId);
      if (version) {
        setNextPrompt(version.content);
        setNextExplanation(version.explanation || '');
      }
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
                try {
                  const a = client.getAgent(agentId);
                  const response = await a.generate({
                    messages: [
                      {
                        role: 'user',
                        content: `Iterate and improve this prompt:${nextPrompt || instructions}`,
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
                <Button
                  onClick={() => {
                    setNextPrompt('');
                    setNextExplanation('');
                  }}
                  variant="outline"
                >
                  Reset
                </Button>
              </>
            )}
          </div>
        </div>

        {versions.length > 0 && (
          <div className="border-t">
            <div className="px-3 py-2 border-b bg-mastra-bg-2">
              <h3 className="text-xs font-medium text-mastra-el-4">Saved Versions</h3>
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              <div className="divide-y">
                {versions.map(version => (
                  <div
                    key={version.id}
                    className={`group flex items-center justify-between text-xs px-3 py-2 hover:bg-mastra-bg-3 cursor-pointer ${
                      version.id === activeVersion ? 'bg-mastra-bg-2' : ''
                    }`}
                    onClick={() => setVersionActive(version.id)}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-mastra-el-3 truncate">{new Date(version.timestamp).toLocaleString()}</span>
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
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-mastra-bg-4 rounded"
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
