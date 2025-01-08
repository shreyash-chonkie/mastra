# Prompting Technique Categories

## In-Context Learning (ICL)

- Few-Shot Prompting
- Zero-Shot Prompting
- Role Prompting
- Style Prompting
- Emotion Prompting
- System 2 Attention (S2A)
- SimToM
- Rephrase and Respond (RaR)
- Re-reading (RE2)
- Self-Ask

## Thought Generation

- Chain-of-Thought (CoT)
- Zero-Shot CoT
- Step-Back Prompting
- Analogical Prompting
- Thread-of-Thought (ThoT)
- Tabular Chain-of-Thought (Tab-CoT)
- Contrastive CoT
- Uncertainty-Routed CoT
- Complexity-based Prompting
- Active Prompting
- Memory-of-Thought
- Automatic Chain-of-Thought (Auto-CoT)

## Decomposition

- Least-to-Most Prompting
- Decomposed Prompting (DECOMP)
- Plan-and-Solve Prompting
- Tree-of-Thought (ToT)
- Recursion-of-Thought
- Program-of-Thoughts
- Faithful Chain-of-Thought
- Skeleton-of-Thought
- Metacognitive Prompting

## Ensembling

- Demonstration Ensembling (DENSE)
- Mixture of Reasoning Experts (MoRE)
- Max Mutual Information Method
- Self-Consistency
- Universal Self-Consistency
- Meta-Reasoning over Multiple CoTs
- DiVeRSe
- Consistency-based Self-adaptive Prompting (COSP)
- Universal Self-Adaptive Prompting (USP)
- Prompt Paraphrasing

## Self-Criticism

- Self-Calibration
- Self-Refine
- Reversing Chain-of-Thought (RCoT)
- Self-Verification
- Chain-of-Verification (COVE)
- Cumulative Reasoning

# Considered Techniques

- Chain-of-Thought (CoT): Used for complex reasoning tasks and step-by-step problem solving
- Zero-Shot CoT: Implemented for handling novel tasks without specific examples
- Tree-of-Thought (ToT): Applied for branching decision-making processes
- Role Prompting: Utilized to give agents specific personas and capabilities
- System 2 Attention (S2A): Employed for careful, deliberate reasoning
- Self-Verification: Used to validate agent outputs and responses
- Memory-of-Thought: Implemented for maintaining context across conversations

# Evaluated Techniques

The following prompting techniques have been implemented and evaluated across different LLM providers (OpenAI, Anthropic, Groq):

- Zero-Shot: Direct problem solving without examples
- Few-Shot: Learning from similar example patterns
- Chain-of-Thought (CoT): Step-by-step reasoning process
- Auto Chain-of-Thought: Automatically generated reasoning steps
- Tree-of-Thought (ToT): Multiple solution path exploration
- Self-Verification: Solution checking and validation
- Self-Ask: Question-based problem decomposition
- Role Prompting: Enhanced responses through professional personas and expertise

# Prompting Architecture

## Core Components

- **Instruction**: Base class for formatting prompts with configurable options:

  - Role/persona
  - Style and tone
  - Output format
  - Context and constraints
  - Examples

- **PromptTemplate**: Template system for composing different prompting elements:

  - Primary instruction
  - Component management
  - Flexible composition

- **StepBasedPrompt**: Base class for techniques using sequential steps:
  - Chain-of-thought implementation
  - Decomposition support
  - Step formatting

## Evaluation Framework

- Correctness scoring
- Technique-specific effectiveness metrics
- Cross-model comparison
- Benchmark-based evaluation (GSM8K)

## Implementation Details

The codebase provides a flexible architecture for:

- Building and composing prompts
- Implementing various prompting techniques
- Evaluating effectiveness across different models
- Supporting multiple LLM providers
