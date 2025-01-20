import { embed, type EmbedManyResult } from '@mastra/core';
import { MDocument } from '@mastra/rag';

import { scrapeWebsiteTool, getChannelMessagesTool, listChannelsTool } from './mastra/tools';

async function main() {
  const token = process.env.SLACK_TOKEN;

  if (!token) {
    throw new Error('Please set SLACK_TOKEN environment variable');
  }

  const suspend = async () => {};

  try {
    const channels = await listChannelsTool.execute({
      context: { token },
      suspend,
    });

    const kindergartenChannel = channels.channels.find(channel => channel.name === 'kindergarten');

    if (kindergartenChannel) {
      const messages = await getChannelMessagesTool.execute({
        context: {
          token,
          channelId: kindergartenChannel.id,
          limit: 10,
        },
        suspend,
      });

      //Loop through the first 10 messages instead
      const message = messages.messages[1];

      const urlMatch = message.text.match(/<(https?:\/\/[^>]+)>/) || message.originalUrl?.match(/<(https?:\/\/[^>]+)>/);
      if (urlMatch) {
        const url = urlMatch[1];
        console.log('\nFound URL:', url);

        try {
          console.log('scraping');
          const content = await scrapeWebsiteTool.execute({
            context: { url },
            suspend: async () => {},
          });

          const doc = MDocument.fromText(content.content, {
            title: content.title,
            url: content.url,
          });

          const chunks = await doc.chunk({
            strategy: 'recursive',
            size: 512,
            overlap: 50,
            separator: '\n',
          });

          const { embeddings } = (await embed(chunks, {
            provider: 'OPEN_AI',
            model: 'text-embedding-3-small',
            maxRetries: 3,
          })) as EmbedManyResult<string>;

          //TODO: store embeddings in vector db
        } catch (error) {
          console.error('Error scraping URL:', error);
        }
      } else {
        console.log('No URL found in the message');
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// main();

// async function main() {
//   console.log('Generating response...');
//   const agentRes = await kindergartenAgent.generate(
//     `Tell me about the article on Scaling Rag token=${process.env.SLACK_TOKEN}`,
//   );
//   console.log(agentRes.text);
//   console.log('Done');
// }

main();
