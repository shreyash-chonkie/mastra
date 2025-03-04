# Mastra Network System

The Network system allows you to orchestrate multiple agents to work together on complex tasks. This system provides a flexible way to route between agents, maintain state, and track execution history.

## Key Components

### AgentNetwork

The `AgentNetwork` class is the main entry point for creating and running networks of agents. It handles the orchestration of multiple agents, routing between them, and maintaining state.

### NetworkState

The `NetworkState` class provides a way to maintain state between agent calls. It's a simple key-value store that can be used to pass information between agents.

### Router

A router function determines which agent should be called next based on the current state, last result, and call count. You can provide a custom router or use the default router that uses an LLM to decide.

## Usage

### Creating a Network

```typescript
import { AgentNetwork } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';

// Create OpenAI client
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create agents
const searchAgent = new Agent({
  name: 'Search',
  instructions: 'You search for information on the web',
  model: openai('gpt-4o'),
});

const summaryAgent = new Agent({
  name: 'Summary',
  instructions: 'You summarize information into concise points',
  model: openai('gpt-4o'),
});

// Create a network
const network = new AgentNetwork({
  name: 'Research Assistant',
  agents: [searchAgent, summaryAgent],
  routingModel: openai('gpt-4o'),
});
```

### Generating with a Network

```typescript
// Generate a response from the network
const result = await network.generate('Research the history of artificial intelligence');

console.log(result.output); // Final output from the last agent
console.log(result.steps); // Number of steps performed
console.log(result.history); // Execution history
console.log(result.state.toObject()); // Final state
```

### Using CoreMessage[] as Input

You can also provide an array of CoreMessage objects as input:

```typescript
import { CoreMessage } from 'ai';

// Create messages
const messages: CoreMessage[] = [
  { role: 'user', content: 'I need information about quantum computing.' },
  { role: 'assistant', content: 'I can help with that. What specific aspects are you interested in?' },
  { role: 'user', content: 'Focus on recent breakthroughs in the last 2 years.' },
];

// Generate with messages
const result = await network.generate(messages);
```

### Custom Router

You can provide a custom router function to determine which agent should be called next:

```typescript
const network = new AgentNetwork({
  name: 'Custom Router Example',
  agents: [agentA, agentB, agentC],
  routingModel: openai('gpt-4o'),
  router: async ({ callCount, state, lastResult, input }) => {
    // Custom routing logic
    if (callCount === 0) return agentA;

    if (lastResult.includes('error')) {
      return agentC; // Error handling agent
    }

    if (callCount === 1) return agentB;

    return undefined; // Done after two calls
  },
});
```

### Initial State

You can provide an initial state to the network:

```typescript
// Create initial state
const initialState = new NetworkState();
initialState.set('userData', { name: 'John Doe', age: 30 });

// Create a network with initial state
const network = new AgentNetwork({
  name: 'State Example',
  agents: [agentA, agentB],
  routingModel: openai('gpt-4o'),
  initialState: initialState,
});
```

### Custom Run IDs and Options

You can provide custom IDs and options for tracking and telemetry:

```typescript
const result = await network.generate('Process this data', {
  runId: 'custom-run-id',
  threadId: 'custom-thread-id',
  resourceId: 'custom-resource-id',
  maxSteps: 3, // Override the default maximum steps
});
```

## Advanced Usage

### Maximum Steps

You can set a maximum number of steps to prevent infinite loops:

```typescript
const network = new AgentNetwork({
  name: 'Limited Steps',
  agents: [agentA, agentB],
  routingModel: openai('gpt-4o'),
  maxSteps: 5, // Maximum 5 steps
});
```

You can also override this at generate time:

```typescript
// Override the default maxSteps for this specific run
const result = await network.generate('Process this data', { maxSteps: 3 });
```

### State Management

You can access and update the state during network execution:

```typescript
const network = new AgentNetwork({
  name: 'State Management Example',
  agents: [agentA, agentB],
  routingModel: openai('gpt-4o'),
  router: async ({ callCount, state, lastResult }) => {
    // Update state based on the last result
    if (callCount === 1) {
      state.set('processedData', lastResult);
      return agentB;
    }

    return callCount === 0 ? agentA : undefined;
  },
});
```

## Example: Multi-Agent Research Assistant

```typescript
import { AgentNetwork, Agent, NetworkState } from '@mastra/core';
import { createOpenAI } from '@ai-sdk/openai';

// Create OpenAI client
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create search agent
const searchAgent = new Agent({
  name: 'Search',
  instructions: 'You search for information on the web',
  model: openai('gpt-4o'),
});

// Create analysis agent
const analysisAgent = new Agent({
  name: 'Analysis',
  instructions: 'You analyze information and identify key insights',
  model: openai('gpt-4o'),
});

// Create summary agent
const summaryAgent = new Agent({
  name: 'Summary',
  instructions: 'You summarize information into concise points',
  model: openai('gpt-4o'),
});

// Create initial state
const initialState = new NetworkState();
initialState.set('topic', 'artificial intelligence');

// Create a network with a custom router
const network = new AgentNetwork({
  name: 'Research Assistant',
  agents: [searchAgent, analysisAgent, summaryAgent],
  routingModel: openai('gpt-4o'),
  initialState: initialState,
  router: async ({ callCount, state }) => {
    if (callCount === 0) return searchAgent;
    if (callCount === 1) return analysisAgent;
    if (callCount === 2) return summaryAgent;
    return undefined; // Done after three calls
  },
});

// Generate a response from the network
const result = await network.generate('Research the history and future of artificial intelligence');

console.log(result.output); // Final summary from the summary agent
```
