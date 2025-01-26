import { Agent, Mastra } from '@mastra/core';
import { MDocument, PgVector, createVectorQueryTool, embed } from '@mastra/rag';
import { PgMemory } from '@mastra/memory';
import { DiscordMessage } from './types';

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

// Initialize memory
const memory = new PgMemory({
  connectionString: process.env.DB_URL!,
});

// Create the RAG agent with conversation awareness
const ragAgent = new Agent({
  name: 'RAG Agent',
  instructions: `You are a helpful assistant that answers questions about mastra based on the provided context.
Keep your answers concise and relevant.
When you receive a question, consider the conversation history to maintain context.
If a question seems to reference previous messages, use that context in your response.`,
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

// Helper function to generate responses
const generateResponse = async (question: string, threadId: string) => {
  const agent = mastra.getAgent('ragAgent');

  // Generate response
  const completion = await agent.generate(question);

  // Store the interaction in memory
  await memory.addMessage({
    threadId,
    content: question,
    role: 'user',
    type: 'text'
  });

  await memory.addMessage({
    threadId,
    content: completion.text,
    role: 'assistant',
    type: 'text'
  });

  return completion.text;
};

// Load and index the documentation
const loadDocs = async () => {
  try {
    const response = await fetch('https://mastra.ai/llms.txt');
    const text = await response.text();
    const doc = MDocument.fromText(text);

    // Create chunks
    const chunks = await doc.chunk({
      strategy: 'recursive',
      size: 512,
      overlap: 50,
    });

    // Generate embeddings and store them
    const embedResult = await embed(chunks, {
      provider: 'OPEN_AI',
      model: 'text-embedding-ada-002',
      maxRetries: 3,
    });

    if ('embeddings' in embedResult) {
      await pgVector.upsert('embeddings', embedResult.embeddings);
    } else {
      throw new Error('Failed to generate embeddings');
    }
    console.log('Documentation loaded and indexed successfully');
  } catch (error) {
    console.error('Failed to load documentation:', error);
  }
};

// Load docs at startup
loadDocs();

// Helper to check if message is in a thread
const isInThread = (message: DiscordMessage): boolean => {
  return !!message.thread_id || !!message.message_reference;
};

// Helper to get thread ID
const getThreadId = (message: DiscordMessage): string => {
  return message.thread_id || message.message_reference?.channel_id || message.channel_id;
};

// Handle incoming Discord messages
export const handleMessage = async (message: DiscordMessage) => {
  // Skip bot messages
  if (message.author?.bot) return;

  // If not in a thread, only respond to mentions
  if (!isInThread(message) && !message.mentions?.some(mention => mention.id === process.env.DISCORD_APPLICATION_ID)) {
    return;
  }

  // Get the question (remove mention if present)
  const question = message.mentions?.length ?
    message.content.replace(/<@!\d+>/g, '').trim() :
    message.content.trim();

  // Skip empty messages
  if (!question) return;

  try {
    // Get or create thread for this conversation
    const threadId = getThreadId(message);
    let thread = await memory.getThreadById({ threadId });

    if (!thread) {
      thread = await memory.createThread({
        threadId,
        title: `Discord Thread ${threadId}`,
        resourceid: `discord-${message.channel_id}`,
      });
    }

    // Generate response using thread ID for context
    const answer = await generateResponse(question, threadId);

    // Send the response using Discord's message create endpoint
    await fetch(`https://discord.com/api/v10/channels/${message.channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: answer,
        message_reference: {
          message_id: message.id,
          channel_id: message.channel_id,
          guild_id: message.guild_id,
        },
      }),
    });
  } catch (error) {
    console.error('Error processing message:', error);

    // Send error message
    await fetch(`https://discord.com/api/v10/channels/${message.channel_id}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${process.env.DISCORD_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: "I'm sorry, I encountered an error while processing your question. Please try again later.",
        message_reference: {
          message_id: message.id,
          channel_id: message.channel_id,
          guild_id: message.guild_id,
        },
      }),
    });
  }
};

