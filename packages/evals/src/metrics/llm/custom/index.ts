import { Metric, MetricResult, ModelConfig } from '@mastra/core';

import { roundToTwoDecimals } from '../utils';

import { CustomJudge } from './metricJudge';

export interface CustomMetricOptions<T extends EvaluationParams[]> {
  scale?: number;
  criteria: string;
  evaluationSteps: string[];
  evaluationParams: [...T];
}

export enum EvaluationParams {
  INPUT = 'input',
  OUTPUT = 'output',
  EXPECTED_OUTPUT = 'expectedOutput',
  CONTEXT = 'context',
}

type BaseParams = {
  input: string;
  output: string;
};

type EvaluationParamsToType<T extends EvaluationParams[]> = {
  [K in T[number]]: string;
};

export class CustomMetric<T extends EvaluationParams[]> extends Metric {
  private judge: CustomJudge;
  private criteria: string;
  private evaluationSteps: string[];
  private evaluationParams: T;
  private scale: number;

  constructor(model: ModelConfig, { criteria, evaluationSteps, evaluationParams, scale = 1 }: CustomMetricOptions<T>) {
    super();

    // Validate constructor params
    if (criteria && evaluationSteps) {
      throw new Error('Cannot provide both criteria and evaluation_steps');
    }
    if (!criteria && !evaluationSteps) {
      throw new Error('Must provide either criteria or evaluation_steps');
    }

    this.judge = new CustomJudge(model);
    this.criteria = criteria;
    this.evaluationSteps = evaluationSteps;
    this.evaluationParams = evaluationParams;
    this.scale = scale;
  }

  async measure(params: BaseParams & EvaluationParamsToType<T>): Promise<MetricResult> {
    const paramsToUse = this.evaluationParams.reduce(
      (acc, param) => ({
        ...acc,
        [param]: params[param],
      }),
      {},
    );

    const verdicts = await this.judge.evaluate(paramsToUse, this.criteria, this.evaluationSteps);

    const reason = await this.judge.getReason(input, output, score, this.scale, verdicts);

    return {
      score: 0,
      reason,
    };
  }
}

const modelConfig: ModelConfig = {
  provider: 'OPEN_AI',
  name: 'gpt-4o',
  toolChoice: 'auto',
  apiKey: process.env.OPENAI_API_KEY,
};

const basicMetric = new CustomMetric(modelConfig, {
  criteria: 'The output should be a valid JSON object',
  evaluationSteps: [],
  evaluationParams: [
    EvaluationParams.INPUT,
    EvaluationParams.OUTPUT,
    EvaluationParams.CONTEXT,
    EvaluationParams.EXPECTED_OUTPUT,
  ],
});

basicMetric.measure({
  input: 'input',
  output: 'output',
  expectedOutput: 'expectedOutput',
  context: 'context',
});
