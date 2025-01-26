// import { mastra } from "@/mastra";
import { Agent, Mastra } from '@mastra/core';
import { MDocument, PgVector, createVectorQueryTool, embed } from '@mastra/rag';
import { InteractionResponseType, InteractionType, MessageComponentTypes } from 'discord-interactions';

interface DocumentChunk {
  text: string;
}

import { NextRequest, NextResponse } from 'next/server';

import { getRandomEmoji, verifyDiscordRequest } from '@/discord/utils';

// Initialize RAG components
const pgVector = new PgVector(process.env.DB_URL!);

const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: 'pgVector',
  indexName: 'embeddings',
  options: {
    provider: 'OPEN_AI',
    model: 'text-embedding-ada-002',
    maxRetries: 3,
  },
  topK: 3,
});

// Create the RAG agent
const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: 'You are a helpful assistant that answers questions about mastra based on the provided context. Keep your answers concise and relevant.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o-mini',
  },
  tools: {
    vectorQueryTool,
  },
});

// Initialize Mastra
const mastra = new Mastra({
  agents: { ragAgent },
  vectors: { pgVector },
});

// Load and index the documentation
const loadDocs = async () => {
  try {
    const response = await fetch('https://mastra.ai/llms.txt');
    const text = await response.text();
    const doc = MDocument.fromText(text);

    console.log('doc');

    // Create chunks
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 512,
      overlap: 50,
    });

    console.log('chunks');

    // Generate embeddings and store them
    const embedResult = (await embed(chunks, {
      provider: 'OPEN_AI',
      model: 'text-embedding-ada-002',
      maxRetries: 3,
    }));

    console.log('embedResult');

    const vectorStore = mastra.getVector('pgVector');

    if ('embeddings' in embedResult) {
      await vectorStore.createIndex('embeddings', 1536);
      await vectorStore.upsert(
        'embeddings',
        embedResult.embeddings,
        chunks.map((chunk: DocumentChunk) => ({ text: chunk.text })),
      );
      await pgVector.upsert('embeddings', embedResult.embeddings);
    } else {
      throw new Error('Failed to generate embeddings');
    }
    console.log('Documentation loaded and indexed successfully');
  } catch (error) {
    console.error('Failed to load documentation:', error);
  }
};

// Load docs when the server starts

export const POST = async (req: NextRequest) => {
  const result = await verifyDiscordRequest(req, process.env.DISCORD_PUBLIC_KEY!);

  if (!result.isValid) {
    return result.response;
  }
  const { type, data } = result.body;

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return NextResponse.json({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return NextResponse.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }

    // "docs" command
    if (name === 'docs') {
      console.log('logsssssssssssssssssssssss');
      return NextResponse.json(
        // this is a modal
        {
          type: InteractionResponseType.MODAL,
          data: {
            title: 'Ask a question about mastra',
            custom_id: 'azaman_question_modal',
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.INPUT_TEXT,
                    custom_id: 'azaman_question',
                    label: 'Your Question',
                    style: 2, // paragraph style
                    min_length: 1,
                    max_length: 4000,
                    placeholder: 'How do I create a workflow?',
                    required: true
                  }
                ]
              }
            ]
          },
        },
      );
    }
  }

  /**
   * Handle modal submissions
   */
  if (type === InteractionType.MODAL_SUBMIT) {
    const { custom_id, components } = data;

    if (custom_id === 'azaman_question_modal') {
      // First, acknowledge the interaction with a deferred response
      await fetch(`https://discord.com/api/v10/interactions/${result.body.id}/${result.body.token}/callback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
        }),
      });

      await loadDocs();

      // Get the user's question from the modal
      const question = components[0].components[0].value;

      try {
        const agent = mastra.getAgent('ragAgent');
        const completion = await agent.generate(question);

        console.log('completion', completion);

        // Send followup message using webhook
        const followupResponse = await fetch(
          `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${result.body.token}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: completion.text,
            }),
          }
        );

        if (!followupResponse.ok) {
          console.error('Failed to send followup:', await followupResponse.text());
          throw new Error('Failed to send followup message');
        }

        return new Response(null, { status: 200 });
      } catch (error) {
        console.error('Error querying documentation:', error);

        // Send error message as followup
        await fetch(
          `https://discord.com/api/v10/webhooks/${process.env.DISCORD_APPLICATION_ID}/${result.body.token}/messages/@original`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              content: "I'm sorry, I encountered an error while trying to answer your question. Please try again later.",
            }),
          }
        );

        return new Response(null, { status: 200 });
      }
    }
  }

  // Return a default response for unhandled cases
  return NextResponse.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: 'Unknown command' },
  });
};
