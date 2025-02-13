export type PromptVersionStatus = 'original' | 'draft' | 'published' | 'active';

export interface EvalResult {
  input: string;
  output: string;
  meta: Record<string, any>;
  createdAt: Date;
  result: {
    score: number;
    info: {
      reason: string;
    };
  };
}

export interface PromptVersion {
  content: string;
  timestamp: Date;
  analysis?: string;
  status: PromptVersionStatus;
  evals?: EvalResult[];
}

export interface VersionActionsProps {
  version: PromptVersion;
  index: number;
  isUpdating: boolean;
  onCopy: (content: string, index: number) => Promise<void>;
  onSetActive: (version: PromptVersion, index: number) => Promise<void>;
  onDelete: (index: number) => void;
  copiedVersions: Record<number, boolean>;
}
