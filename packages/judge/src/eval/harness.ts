import { Agent } from '@mastra/core';

import { Judge } from '../judge';
import { JudgingResult } from '../types';

export interface TestContext {
  prompt: string;
  response: string;
  reference?: string;
  metadata?: Record<string, any>;
}

export interface TestResult {
  prompt: string;
  reference: string;
  response: string;
  passed: boolean;
  scores: Record<string, number>;
  feedback: string[];
  duration: number;
}

export interface SuiteResult {
  name: string;
  passed: boolean;
  tests: TestResult[];
  duration: number;
}

export class TestHarness {
  private suites: Array<() => Promise<SuiteResult>> = [];
  private currentSuite: {
    name: string;
    agent?: Agent;
    judge?: Judge;
    tests: Array<() => Promise<TestResult>>;
  } | null = null;

  describe(name: string, fn: (register: ({ agent, judge }: { agent: Agent; judge: Judge }) => void) => void) {
    // Create a new suite
    const suite = {
      name,
      agent: undefined as Agent | undefined,
      judge: undefined as Judge | undefined,
      tests: [] as Array<() => Promise<TestResult>>,
    };

    // Set it as current
    this.currentSuite = suite;

    fn(({ agent, judge }) => {
      if (agent) {
        suite.agent = agent; // Changed from this.currentSuite.agent
      }
      if (judge) {
        suite.judge = judge; // Changed from this.currentSuite.judge
      }
    });

    // Add the suite execution function
    this.suites.push(async () => {
      const startTime = Date.now();
      const tests = await Promise.all(suite.tests.map(t => t()));
      const duration = Date.now() - startTime;
      const passed = tests.every(t => t.passed);

      return {
        name,
        passed,
        tests,
        duration,
      };
    });

    // Clear current suite
    this.currentSuite = null;
  }

  it(
    { prompt, reference }: { prompt: string; reference: string },
    fn: ({ response }: { response: string; judgement: JudgingResult }) => Promise<any>,
  ) {
    if (!this.currentSuite) {
      throw new Error('Test must be inside a describe block');
    }

    const suite = this.currentSuite; // Capture the current suite

    this.currentSuite.tests.push(async () => {
      const startTime = Date.now();

      let response;
      let judgement;
      try {
        console.log(`Running prompt: ${prompt}`, suite?.agent?.name);
        console.log(`\n$`);
        response = await suite?.agent?.generate(prompt);
        judgement = await suite.judge?.judge(response?.text || '', {
          prompt,
          reference,
        });
        const result = await fn({ response: response?.text || '', judgement: judgement! });
        const duration = Date.now() - startTime;
        return {
          ...result,
          response: response?.text,
          scores: judgement?.details?.individualScores,
          feedback: judgement?.feedback || [],
          passed: true,
          prompt,
          reference,
          duration,
        };
      } catch (error) {
        let errMsg = 'Unknown';
        if (error instanceof Error) {
          errMsg = error.message;
        }
        return {
          prompt,
          reference,
          response: response?.text,
          passed: false,
          scores: judgement?.details?.individualScores,
          feedback: [...(judgement?.feedback || []), `Test failed with error: ${errMsg}`],
          duration: Date.now() - startTime,
        };
      }
    });
  }

  async run() {
    console.log('\nRunning Suites 🤖\n');
    const startTime = Date.now();

    const res = [];
    for (const suite of this.suites) {
      res.push(await suite());
    }
    const duration = Date.now() - startTime;

    this.printResults(res, duration);
    this.suites = [];
    this.currentSuite = null;
    return res;
  }

  private printResults(results: SuiteResult[], totalDuration: number) {
    const totalTests = results.reduce((sum, s) => sum + s.tests.length, 0);
    const passedTests = results.reduce((sum, s) => sum + s.tests.filter(t => t.passed).length, 0);

    results.forEach(suite => {
      console.log(`\n${suite.passed ? '✅' : '❌'} ${suite.name}`);
      suite.tests.forEach(test => {
        console.log(`  ${test.passed ? '✓' : '✗'} ${test.prompt} (${test.duration}ms)`);
        if (!test.passed) {
          console.log(test.response);
          test?.feedback?.forEach(f => console.log(`    • ${f}`));
          console.log(test.scores);
        }
      });
    });

    console.log(`\nTest Suites: ${results.length}`);
    console.log(`Tests: ${passedTests}/${totalTests} passed`);
    console.log(`Time: ${totalDuration}ms\n`);
  }

  getSuites() {
    return this.suites;
  }
}

export const harness = new TestHarness();
