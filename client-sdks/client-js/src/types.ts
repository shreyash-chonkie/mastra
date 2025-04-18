import type {
  MessageType,
  AiMessageType,
  CoreMessage,
  QueryResult,
  StepAction,
  StepGraph,
  StorageThreadType,
  BaseLogMessage,
  WorkflowRunResult as CoreWorkflowRunResult,
} from '@mastra/core';

import type { AgentGenerateOptions, AgentStreamOptions } from '@mastra/core/agent';
import type { JSONSchema7 } from 'json-schema';
import type { ZodSchema } from 'zod';

export interface ClientOptions {
  /** Base URL for API requests */
  baseUrl: string;
  /** Number of retry attempts for failed requests */
  retries?: number;
  /** Initial backoff time in milliseconds between retries */
  backoffMs?: number;
  /** Maximum backoff time in milliseconds between retries */
  maxBackoffMs?: number;
  /** Custom headers to include with requests */
  headers?: Record<string, string>;
  /** Abort signal for request */
}

export interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  stream?: boolean;
  signal?: AbortSignal;
}

export interface GetAgentResponse {
  name: string;
  instructions: string;
  tools: Record<string, GetToolResponse>;
  provider: string;
  modelId: string;
}

export type GenerateParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[];
} & Partial<AgentGenerateOptions<T>>;

export type StreamParams<T extends JSONSchema7 | ZodSchema | undefined = undefined> = {
  messages: string | string[] | CoreMessage[] | AiMessageType[];
} & Omit<AgentStreamOptions<T>, 'onFinish' | 'onStepFinish' | 'telemetry'>;

export interface GetEvalsByAgentIdResponse extends GetAgentResponse {
  evals: any[];
}

export interface GetToolResponse {
  id: string;
  description: string;
  inputSchema: string;
  outputSchema: string;
}

export interface GetWorkflowResponse {
  name: string;
  triggerSchema: string;
  steps: Record<string, StepAction<any, any, any, any>>;
  stepGraph: StepGraph;
  stepSubscriberGraph: Record<string, StepGraph>;
  workflowId?: string;
}

export type WorkflowRunResult = {
  activePaths: Record<string, { status: string; suspendPayload?: any; stepPath: string[] }>;
  results: CoreWorkflowRunResult<any, any, any>['results'];
  timestamp: number;
  runId: string;
};
export interface UpsertVectorParams {
  indexName: string;
  vectors: number[][];
  metadata?: Record<string, any>[];
  ids?: string[];
}
export interface CreateIndexParams {
  indexName: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
}

export interface QueryVectorParams {
  indexName: string;
  queryVector: number[];
  topK?: number;
  filter?: Record<string, any>;
  includeVector?: boolean;
}

export interface QueryVectorResponse {
  results: QueryResult[];
}

export interface GetVectorIndexResponse {
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  count: number;
}

export interface SaveMessageToMemoryParams {
  messages: MessageType[];
  agentId: string;
}

export type SaveMessageToMemoryResponse = MessageType[];

export interface CreateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceid: string;
  threadId: string;
  agentId: string;
}

export type CreateMemoryThreadResponse = StorageThreadType;

export interface GetMemoryThreadParams {
  resourceId: string;
  agentId: string;
}

export type GetMemoryThreadResponse = StorageThreadType[];

export interface UpdateMemoryThreadParams {
  title: string;
  metadata: Record<string, any>;
  resourceid: string;
}

export interface GetMemoryThreadMessagesResponse {
  messages: CoreMessage[];
  uiMessages: AiMessageType[];
}

export interface GetLogsParams {
  transportId: string;
}

export interface GetLogParams {
  runId: string;
  transportId: string;
}

export type GetLogsResponse = BaseLogMessage[];

export type RequestFunction = (path: string, options?: RequestOptions) => Promise<any>;

type SpanStatus = {
  code: number;
};

type SpanOther = {
  droppedAttributesCount: number;
  droppedEventsCount: number;
  droppedLinksCount: number;
};

type SpanEventAttributes = {
  key: string;
  value: { [key: string]: string | number | boolean | null };
};

type SpanEvent = {
  attributes: SpanEventAttributes[];
  name: string;
  timeUnixNano: string;
  droppedAttributesCount: number;
};

type Span = {
  id: string;
  parentSpanId: string | null;
  traceId: string;
  name: string;
  scope: string;
  kind: number;
  status: SpanStatus;
  events: SpanEvent[];
  links: any[];
  attributes: Record<string, string | number | boolean | null>;
  startTime: number;
  endTime: number;
  duration: number;
  other: SpanOther;
  createdAt: string;
};

export interface GetTelemetryResponse {
  traces: Span[];
}

export interface GetTelemetryParams {
  name?: string;
  scope?: string;
  page?: number;
  perPage?: number;
  attribute?: Record<string, string>;
}

export interface GetNetworkResponse {
  name: string;
  instructions: string;
  agents: Array<{
    name: string;
    provider: string;
    modelId: string;
  }>;
  routingModel: {
    provider: string;
    modelId: string;
  };
  state?: Record<string, any>;
}

// A2A Protocol Types
export enum TaskState {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  TASK_NOT_FOUND = -32000,
  TASK_NOT_CANCELABLE = -32001,
}

export interface A2AMessagePart {
  type: string;
  [key: string]: any;
}

export interface A2AMessage {
  role: 'user' | 'agent';
  parts: A2AMessagePart[];
}

export interface TaskStatus {
  state: TaskState;
  message?: A2AMessage;
  timestamp: string;
}

export interface Task {
  id: string;
  sessionId: string | null;
  status: TaskStatus;
  history: A2AMessage[];
}

// A2A Request Types
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params: Record<string, any>;
}

export interface SendTaskRequest extends JSONRPCRequest {
  method: 'tasks/send';
  params: {
    id: string;
    message: A2AMessage;
    sessionId?: string;
  };
}

export interface GetTaskRequest extends JSONRPCRequest {
  method: 'tasks/get';
  params: {
    id: string;
    historyLength?: number;
  };
}

export interface CancelTaskRequest extends JSONRPCRequest {
  method: 'tasks/cancel';
  params: {
    id: string;
  };
}

export type A2ARequest = SendTaskRequest | GetTaskRequest | CancelTaskRequest;

// A2A Response Types
export interface JSONRPCSuccessResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result: any;
}

export interface JSONRPCErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: ErrorCode;
    message: string;
    data?: any;
  };
}

export type JSONRPCResponse = JSONRPCSuccessResponse | JSONRPCErrorResponse;

// Agent Card Types
export interface AgentCapabilities {
  tasks: {
    send: boolean;
    get: boolean;
    cancel: boolean;
  };
  pushNotifications: boolean;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
}

export interface AgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: AgentCapabilities;
  skills: AgentSkill[];
}
