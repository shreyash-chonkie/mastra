'use client';

//import { useEdgeRuntime } from '@assistant-ui/react';
import { Thread } from '@assistant-ui/react';
import { makeMarkdownText } from '@assistant-ui/react-markdown';

const MarkdownText = makeMarkdownText();

export function MyAssistant() {
  //const runtime = useEdgeRuntime({ api: '/api/chat' });

  return (
    <Thread
      strings={{
        welcome: { message: 'Ask me questions about YC 2024' },
      }}
      assistantMessage={{ components: { Text: MarkdownText } }}
    />
  );
}
