import { ModelConfig } from '@mastra/core';
import { z } from 'zod';

import { MastraAgentJudge } from '../../judge';

import { generateEvaluationSteps, generateEvaluationResults, CUSTOM_AGENT_INSTRUCTIONS } from './prompts';

export class CustomJudge extends MastraAgentJudge {
  constructor(model: ModelConfig) {
    super('Custom', CUSTOM_AGENT_INSTRUCTIONS, model);
  }

  async evaluate(params: EvaluationParamsToType<T>, criteria: string, evaluationSteps: string[]): Promise<{ verdict: string; reason: string }[]> {
    const evaluationSteps = evaluationSteps && evaluationSteps?.length > 0 ? evaluationSteps : generateEvaluationSteps(params.input, params.output);

    return [];
  }

  async getReason(
    input: string,
    actualOutput: string,
    score: number,
    scale: number,
    verdicts: { verdict: string; reason: string }[],
  ): Promise<string> {
    const prompt = generateReasonPrompt({ input, output: actualOutput, verdicts, score, scale });
    const result = await this.agent.generate(prompt, {
      output: z.object({
        reason: z.string(),
      }),
    });
    return result.object.reason;
  }
}
