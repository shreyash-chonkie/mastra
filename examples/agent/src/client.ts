import { MastraClient } from '@mastra/client-js';

async function main() {
  const client = new MastraClient({
    baseUrl: 'http://localhost:4111',
  });

  // Get all available MCP servers
  const mcpServers = await client.getMCPServers();
  console.log('Available MCP servers:', mcpServers);

  // Get a specific MCP server
  const mcpServer = client.getMCPServer('myMcpServer');

  // Get server details
  const details = await mcpServer.details();
  console.log('Server details:', details);

  // List all tools
  const tools = await mcpServer.listTools();
  console.log('Available tools:', tools);

  // Call a specific tool
  try {
    const result = await mcpServer.callTool('helloWorld', {});
    console.log('Tool result:', result);
  } catch (error) {
    console.error('Error calling tool:', error);
  }

  // Connect via SSE
  try {
    console.log('Connecting to SSE...');
    const response = (await mcpServer.connectSSE()) as Response;

    // Handle the SSE response
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      console.log('SSE connection established, waiting for events...');

      // Process the stream
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        console.log('Received SSE event:', text);

        // Parse and handle events
        const events = text.split('\n\n').filter(Boolean);
        for (const event of events) {
          const lines = event.split('\n');
          const eventType = lines
            .find(line => line.startsWith('event:'))
            ?.slice(6)
            .trim();
          const data = lines
            .find(line => line.startsWith('data:'))
            ?.slice(5)
            .trim();

          if (eventType && data) {
            console.log(`Event type: ${eventType}, Data: ${data}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error with SSE connection:', error);
  }
}

main();
