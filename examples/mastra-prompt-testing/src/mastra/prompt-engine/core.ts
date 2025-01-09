/**
 * Core interfaces and classes for implementing prompting techniques as described
 * in the systematic review of prompting literature.
 */

/**
 * Options for instruction configuration based on studied prompt engineering patterns.
 * Role, style, and format have shown significant impact on model outputs.
 */
export interface InstructionOptions {
  role?: string; // Professional role/persona to guide response style
  style?: string; // Response style (analytical, creative, etc.)
  callout?: boolean; // Callout for attention
  tone?: string; // Communication tone affecting response formality
  outputFormat?: string; // Output structure specification
  perspective?: string; // Point of view for response
  context?: string; // Contextual information
  constraints?: string[]; // Response limitations/requirements
}

/**
 * Configuration for different prompting techniques.
 * Supports various approaches including zero-shot, few-shot, and step-based methods.
 */
export interface PromptConfig {
  instruction: string | Instruction; // Primary instruction
  examples?: Example[]; // Few-shot exemplars
  steps?: string[]; // Sequential steps for chain-of-thought
  role?: string; // Role-based prompting
  subQuestions?: string[]; // Self-ask decomposition
  verificationSteps?: string[]; // Self-verification steps
  branches?: { [key: string]: string[] }; // Tree-of-thought branches
  options?: Partial<InstructionOptions>;
}

/**
 * Instruction class implementing core prompting patterns.
 * Combines explicit instruction with formatting elements that have shown
 * to improve model performance in research.
 */
export class Instruction {
  protected text: string;
  protected role: string | null;
  protected style: string | null;
  protected tone: string | null;
  protected outputFormat: string | null;
  protected perspective: string | null;
  protected context: string | null;
  protected constraints: string[];
  protected examples: string[];
  protected callout = false;

  constructor(text: string, options: Partial<InstructionOptions> = {}) {
    this.text = text;
    this.role = options.role || null;
    this.style = options.style || null;
    this.tone = options.tone || null;
    this.outputFormat = options.outputFormat || null;
    this.perspective = options.perspective || null;
    this.context = options.context || null;
    this.constraints = options.constraints || [];
    this.callout = options.callout || false;
  }

  toString(): string {
    const parts: string[] = [];
    if (this.role) parts.push(`As a ${this.role}:`.toUpperCase());
    if (this.style || this.tone) {
      const styleStr = [this.style, this.tone].filter(Boolean).join(', ');
      parts.push(`Write in a ${styleStr} manner:`.toUpperCase());
    }
    if (this.outputFormat) parts.push(`OUTPUT FORMAT: ${this.outputFormat}`);
    if (this.constraints.length) parts.push(`CONSTRAINTS:\n${this.constraints.map(c => `- ${c}`).join('\n')}`);
    let transformedText = this.text;
    if (this.callout) {
      transformedText = this.text.toUpperCase();
    }
    parts.push(transformedText);
    return parts.join('\n');
  }
}

/**
 * Example class for few-shot learning.
 * Research shows few-shot prompting can significantly improve performance
 * through demonstration of desired behavior.
 */
export class Example {
  constructor(
    private input: string,
    private output: string,
  ) {}

  toString(): string {
    return `Input: ${this.input}\nOutput: ${this.output}`;
  }
}

/**
 * Base template for prompt construction.
 * Supports composition of different prompting elements shown
 * to be effective in research.
 */
export class PromptTemplate {
  protected components: (string | Instruction | Example)[] = [];

  constructor(protected primaryInstruction?: Instruction) {}

  addComponent(component: string | Instruction | Example): this {
    this.components.push(component);
    return this;
  }

  toString(): string {
    const parts: string[] = [];
    if (this.primaryInstruction) parts.push(this.primaryInstruction.toString());
    parts.push(...this.components.map(c => c.toString()));
    return parts.join('\n\n');
  }
}

/**
 * Base class for step-based prompting techniques.
 * Implements methods like chain-of-thought and decomposition
 * that improve performance on complex tasks through explicit
 * step-by-step reasoning.
 */
export abstract class StepBasedPrompt extends PromptTemplate {
  constructor(
    instruction: string | Instruction,
    protected steps: string[] = [],
    options: Partial<InstructionOptions>,
  ) {
    const primaryInstruction = typeof instruction === 'string' ? new Instruction(instruction, options) : instruction;
    super(primaryInstruction);
  }

  protected formatSteps(): string {
    return this.steps.map((step, i) => `${i + 1}. ${step}`).join('\n');
  }
}
