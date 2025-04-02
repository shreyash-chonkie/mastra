'use client';

import { useRealtimeSession } from '@/hooks/realtime';
import { ToolFallback } from '@mastra/playground-ui';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';
import {
  renderChartTool,
  renderDetailsTool,
  renderListTool,
  renderTableTool,
  type RenderChartInput,
  type RenderDetailsInput,
  type RenderListInput,
  type RenderTableInput,
} from '../tools';
import { Button } from './Button';
import { Chart, Details, List, Table } from './UI';

// const instructions = `You are an expert UI renderer. When the user asks you to render something, make sure to mock any data thats needed.`;
const instructions = `You are a BigQuery data analyst assistant. You help users interact with Google BigQuery.`;

const initialMessage = `Ask the user what they would like to analyze today.`;

export const OpenAIRealtime = () => {
  const [text, setText] = useState('');
  const [toolCalls, setToolCalls] = useState<any[]>([]);
  const [chart, setChart] = useState<RenderChartInput | null>(null);
  const [details, setDetails] = useState<RenderDetailsInput | null>(null);
  const [list, setList] = useState<RenderListInput | null>(null);
  const [table, setTable] = useState<RenderTableInput | null>(null);

  const { connectionState, createSession } = useRealtimeSession();

  const handleCreateSession = async () => {
    await createSession({
      instructions,
      initialMessage,
      onMessage: data => {
        if (data.type === 'agent.stream' && typeof data.data === 'string') {
          setText(data.data);
        }
        if (data.type === 'agent.tool_call' && typeof data.data === 'object') {
          setToolCalls(c => [...c, data.data]);
        }
      },
      browserTools: [
        renderChartTool(({ data }, { connection }) => {
          connection.sendResponse(`Chart rendered.`);
          setChart({ data });
        }),
        renderDetailsTool(({ name, description, attributes }, { connection }) => {
          connection.sendResponse(`Details rendered.`);
          setDetails({ name, description, attributes });
        }),
        renderListTool(({ items }, { connection }) => {
          connection.sendResponse(`List rendered.`);
          setList({ items });
        }),
        renderTableTool(({ columns, data = [] }, { connection }) => {
          console.log('Table rendered.', columns, data);
          connection.sendResponse(`Table rendered.`);
          setTable({ columns, data });
        }),
      ],
    });
  };

  return (
    <>
      <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>

      <div className="flex flex-col gap-4 p-2">
        {toolCalls.map((toolCall, index) => (
          <ToolFallback key={index} {...toolCall} />
        ))}
      </div>

      {connectionState === 'connected' ? (
        <>
          {chart && <Chart data={chart.data} />}
          {details && <Details name={details.name} description={details.description} attributes={details.attributes} />}
          {list && <List items={list.items} />}
          {table && <Table columns={table.columns} data={table.data} />}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full">
          <Button onClick={handleCreateSession}>
            {connectionState === 'pending' ? 'Creating Session...' : 'Create Session'}
          </Button>
        </div>
      )}
    </>
  );
};
