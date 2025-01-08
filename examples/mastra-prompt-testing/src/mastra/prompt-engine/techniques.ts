import { Instruction, InstructionOptions, PromptTemplate, StepBasedPrompt, PromptConfig, Example } from './core';

/**
 * Chain-of-Thought implementation following Wei et al. (2022b).
 * Expresses step-by-step reasoning before delivering final answer.
 */
export class ChainOfThought extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    steps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'analytical',
      format: 'sequential reasoning',
      constraints: ['Show each logical step', 'Explain reasoning between steps'],
    },
  ) {
    super(instruction, steps, options);
  }

  toString(): string {
    return `${super.toString()}\nLet's solve this step by step:\n${this.formatSteps()}`;
  }
}

/**
 * Decomposition technique for breaking complex problems into simpler sub-problems.
 * Based on research showing effectiveness of systematic problem breakdown.
 */
export class Decomposition extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    steps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'systematic',
      format: 'step-by-step breakdown',
      constraints: ['Each step should be self-contained', 'Steps build on previous results'],
    },
  ) {
    super(instruction, steps, options);
  }

  toString(): string {
    return `${super.toString()}\nLet's break this down into smaller parts:\n${this.formatSteps()}`;
  }
}

/**
 * Self-Ask prompting technique that encourages breaking problems into sub-questions.
 * Based on research showing improved performance through self-questioning.
 */
export class SelfAsk extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    private subQuestions: string[],
    options: Partial<InstructionOptions> = {
      style: 'investigative',
      format: 'question-answer sequence',
      constraints: ['Answer each question before moving to next', 'Use answers to build final solution'],
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }

  toString(): string {
    const questions = this.subQuestions
      .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: [Let's think about this...]`)
      .join('\n\n');
    return `${super.toString()}\n\nLet me break this down into sub-questions:\n\n${questions}\n\nNow, using these answers, the final solution is:`;
  }
}

/**
 * Tree-of-Thought implementation following Yao et al. (2023b).
 * Creates tree-like search considering multiple solution paths.
 */
export class TreeOfThought extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    private branches: { [key: string]: string[] },
    options: Partial<InstructionOptions> = {
      style: 'exploratory',
      format: 'branching analysis',
      constraints: ['Consider multiple valid approaches', 'Evaluate each path', 'Choose optimal solution'],
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }

  toString(): string {
    const branchStrings = Object.entries(this.branches)
      .map(([branch, thoughts]) => `${branch} Approach:\n${thoughts.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`)
      .join('\n\nAlternatively:\n\n');
    return `${super.toString()}\n\nLet's explore different solution approaches:\n\n${branchStrings}\n\nAfter considering these approaches, the best solution is:`;
  }
}

/**
 * Self-Verification implementation for solution checking.
 * Includes explicit verification steps to catch errors.
 */
export class SelfVerification extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    verificationSteps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'thorough',
      format: 'verification checklist',
      constraints: ['Verify each calculation', 'Check logical consistency', 'Validate final answer'],
    },
  ) {
    super(instruction, verificationSteps, options);
  }

  toString(): string {
    const solution = `${super.toString()}\n\nFirst, let's solve:\n[Solution steps here]\n\n`;
    return `${solution}Now, let's verify our work:\n${this.steps.map(step => `• ${step}`).join('\n')}`;
  }
}

/**
 * Zero-shot prompting with clear instruction formatting.
 * Basic template that relies on model's inherent capabilities.
 */
export class ZeroShot extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    options: Partial<InstructionOptions> = {
      format: 'direct response',
      constraints: ['Show all work', 'Explain key steps'],
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }
}

/**
 * Few-shot learning with example-based instruction.
 * Improves performance through demonstration.
 */
export class FewShot extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    private examples: Example[],
    options: Partial<InstructionOptions> = {
      format: 'example-based solution',
      constraints: ['Follow example pattern', 'Show similar level of detail'],
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
    examples.forEach(example => this.addComponent(example));
  }

  toString(): string {
    return `${super.toString()}\n\nNow solve the new problem using a similar approach:`;
  }
}

export function buildPrompt(type: string, config: PromptConfig): PromptTemplate {
  const instruction =
    typeof config.instruction === 'string' ? new Instruction(config.instruction, config.options) : config.instruction;

  switch (type) {
    case 'zero-shot':
      return new ZeroShot(instruction, config.options);

    case 'few-shot':
      if (!config.examples?.length) throw new Error('Examples required for few-shot prompting');
      return new FewShot(instruction, config.examples, config.options);

    case 'chain-of-thought':
      return new ChainOfThought(instruction, config.steps, config.options);

    case 'self-ask':
      if (!config.subQuestions?.length) throw new Error('Sub-questions required for self-ask prompting');
      return new SelfAsk(instruction, config.subQuestions, config.options);

    case 'decomposition':
      if (!config.steps?.length) throw new Error('Steps required for decomposition');
      return new Decomposition(instruction, config.steps, config.options);

    case 'tree-of-thought':
      if (!config.branches || Object.keys(config.branches).length === 0)
        throw new Error('Multiple solution branches required for tree-of-thought');
      return new TreeOfThought(instruction, config.branches, config.options);

    case 'self-verification':
      if (!config.verificationSteps?.length) throw new Error('Verification steps required for self-verification');
      return new SelfVerification(instruction, config.verificationSteps, config.options);

    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}
