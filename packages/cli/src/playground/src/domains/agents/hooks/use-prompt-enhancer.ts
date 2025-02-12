import { useState } from 'react';

import type { PromptVersion } from '../types';

interface UsePromptEnhancerProps {
  agentId: string;
  instructions?: string;
  onVersionCreate: (version: PromptVersion) => void;
}

interface UsePromptEnhancerResult {
  enhancedPrompt: string;
  explanation: string;
  isEnhancing: boolean;
  userComment: string;
  showCommentInput: boolean;
  enhancePrompt: () => Promise<void>;
  setUserComment: (comment: string) => void;
  setShowCommentInput: (show: boolean) => void;
  clearEnhancement: () => void;
  applyChanges: () => void;
}

export function usePromptEnhancer({
  agentId,
  instructions,
  onVersionCreate,
}: UsePromptEnhancerProps): UsePromptEnhancerResult {
  const [enhancedPrompt, setEnhancedPrompt] = useState('');
  const [explanation, setExplanation] = useState('');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [userComment, setUserComment] = useState('');

  const enhancePrompt = async () => {
    if (!instructions) return;

    setIsEnhancing(true);
    try {
      const response = await fetch(`http://localhost:4111/api/agents/${agentId}/instructions/enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instructions,
          comment: userComment,
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
      onVersionCreate(newVersion);

      // Clear the comment
      setUserComment('');
      setShowCommentInput(false);
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const clearEnhancement = () => {
    setEnhancedPrompt('');
    setExplanation('');
  };

  const applyChanges = () => {
    if (!enhancedPrompt) return;

    const newVersion = {
      content: enhancedPrompt,
      timestamp: new Date(),
      analysis: explanation,
      status: 'published' as const,
    };

    onVersionCreate(newVersion);
    clearEnhancement();
  };

  return {
    enhancedPrompt,
    explanation,
    isEnhancing,
    userComment,
    showCommentInput,
    enhancePrompt,
    setUserComment,
    setShowCommentInput,
    clearEnhancement,
    applyChanges,
  };
}
