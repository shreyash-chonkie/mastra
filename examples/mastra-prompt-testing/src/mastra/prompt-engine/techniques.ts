import { Instruction, InstructionOptions, PromptTemplate, StepBasedPrompt, PromptConfig } from './core';

export class ChainOfThought extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    steps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'analytical',
      format: 'sequential reasoning',
    },
  ) {
    super(instruction, steps, options);
  }

  toString(): string {
    return `${super.toString()}\n${this.formatSteps()}`;
  }
}

export class Decomposition extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    steps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'systematic',
      format: 'step-by-step breakdown',
    },
  ) {
    super(instruction, steps, options);
  }

  toString(): string {
    return `${super.toString()}\nBreakdown:\n${this.formatSteps()}`;
  }
}

export class SelfAsk extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    private subQuestions: string[],
    options: Partial<InstructionOptions> = {
      style: 'investigative',
      format: 'question-answer sequence',
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }

  toString(): string {
    return `${super.toString()}\n\n${this.subQuestions.map((q, i) => `Q${i + 1}: ${q}`).join('\n')}`;
  }
}

export class RolePrompt extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    role: string,
    options: Partial<InstructionOptions> = {
      format: 'expert response',
    },
  ) {
    const fullOptions = {
      ...options,
      role,
      style: options.style || 'professional',
    };
    const primaryInstruction =
      typeof instruction === 'string' ? new Instruction(instruction, fullOptions) : instruction;
    super(primaryInstruction);
  }
}

export class SelfVerification extends StepBasedPrompt {
  constructor(
    instruction: string | Instruction,
    verificationSteps: string[] = [],
    options: Partial<InstructionOptions> = {
      style: 'thorough',
      format: 'verification checklist',
    },
  ) {
    super(instruction, verificationSteps, options);
  }

  toString(): string {
    return `${super.toString()}\n\nVerification Steps:\n${this.steps.map(step => `✓ ${step}`).join('\n')}`;
  }
}

export class TreeOfThought extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    private branches: { [key: string]: string[] },
    options: Partial<InstructionOptions> = {
      style: 'exploratory',
      format: 'branching analysis',
    },
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }

  toString(): string {
    const branchStrings = Object.entries(this.branches)
      .map(([branch, thoughts]) => `${branch}:\n${thoughts.map((t, i) => `  ${i + 1}. ${t}`).join('\n')}`)
      .join('\n\n');
    return `${super.toString()}\n\nThought Branches:\n${branchStrings}`;
  }
}

export function buildPrompt(type: string, config: PromptConfig): PromptTemplate {
  const instruction =
    typeof config.instruction === 'string' ? new Instruction(config.instruction, config.options) : config.instruction;

  switch (type) {
    case 'zero-shot':
      return new PromptTemplate(instruction);

    case 'few-shot': {
      const prompt = new PromptTemplate(instruction);
      config.examples?.forEach(example => prompt.addComponent(example));
      return prompt;
    }

    case 'chain-of-thought':
      return new ChainOfThought(instruction, config.steps, config.options);

    case 'self-ask':
      return new SelfAsk(instruction, config.subQuestions || [], config.options);

    case 'decomposition':
      return new Decomposition(instruction, config.steps, config.options);

    case 'role':
      if (!config.role) throw new Error('Role is required for role-based prompts');
      return new RolePrompt(instruction, config.role, config.options);

    case 'self-verification':
      return new SelfVerification(instruction, config.verificationSteps, config.options);

    case 'tree-of-thought':
      if (!config.branches) throw new Error('Branches are required for tree-of-thought prompts');
      return new TreeOfThought(instruction, config.branches, config.options);

    default:
      throw new Error(`Unknown prompt type: ${type}`);
  }
}
