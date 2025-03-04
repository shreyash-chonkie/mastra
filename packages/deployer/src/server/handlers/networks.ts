import type { Mastra } from '@mastra/core';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { streamText } from 'hono/streaming';
import { stringify } from 'superjson';
import zodToJsonSchema from 'zod-to-json-schema';

import { handleError } from './error';
import { validateBody } from './utils';

// Network handlers
export async function getNetworksHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networks = mastra.getNetworks();

    const serializedNetworks = Object.entries(networks).reduce<any>((acc, [_id, _network]) => {
      const network = _network as any;
      acc[_id] = {
        name: network.name,
        agents: network.agents.map((agent: any) => ({
          name: agent.name,
          provider: agent.llm?.getProvider(),
          modelId: agent.llm?.getModelId(),
        })),
        routingModel: {
          provider: network.llm?.getProvider(),
          modelId: network.llm?.getModelId(),
        },
      };
      return acc;
    }, {});

    return c.json(serializedNetworks);
  } catch (error) {
    return handleError(error, 'Error getting networks');
  }
}

export async function getNetworkByIdHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const serializedNetwork = {
      name: network.name,
      agents: network.agents.map((agent: any) => ({
        name: agent.name,
        provider: agent.llm?.getProvider(),
        modelId: agent.llm?.getModelId(),
      })),
      routingModel: {
        provider: network.llm?.getProvider(),
        modelId: network.llm?.getModelId(),
      },
    };

    return c.json(serializedNetwork);
  } catch (error) {
    return handleError(error, 'Error getting network');
  }
}

export async function generateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const body = await c.req.json();
    const { input } = body;

    // Support both string and CoreMessage[] inputs
    const result = await network.generate(input);

    return c.json(result);
  } catch (error) {
    return handleError(error, 'Error generating network response');
  }
}

export async function streamGenerateHandler(c: Context) {
  try {
    const mastra: Mastra = c.get('mastra');
    const networkId = c.req.param('networkId');
    const network = mastra.getNetwork(networkId);

    if (!network) {
      throw new HTTPException(404, { message: 'Network not found' });
    }

    const body = await c.req.json();
    const { input } = body;

    return streamText(c, async stream => {
      const result = await network.stream(input, {
        onStepStart: (agent, step) => {
          stream.write(JSON.stringify({ type: 'stepStart', agent: agent.name, step }));
        },
        onStepFinish: result => {
          stream.write(JSON.stringify({ type: 'stepFinish', output: result.output }));
        },
      });

      for await (const chunk of result.stream) {
        stream.write(JSON.stringify(chunk));
      }

      stream.close();
    });
  } catch (error) {
    return handleError(error, 'Error streaming network response');
  }
}
