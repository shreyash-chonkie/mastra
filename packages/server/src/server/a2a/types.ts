/**
 * A2A Protocol Types
 * Based on the A2A Protocol Schema
 */

export type JSONRPCMessage = {
  jsonrpc: '2.0';
  id?: string | number | null;
};

export type JSONRPCRequest = JSONRPCMessage & {
  method: string;
  params?: Record<string, any> | null;
};

export type JSONRPCError = {
  code: number;
  message: string;
  data?: Record<string, any> | null;
};

export type JSONRPCResponse = JSONRPCMessage & {
  result?: any | null;
  error?: JSONRPCError | null;
};

export enum TaskState {
  SUBMITTED = 'submitted',
  WORKING = 'working',
  INPUT_REQUIRED = 'input-required',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
}

export type Part = TextPart | FilePart | DataPart;

export type TextPart = {
  type: 'text';
  text: string;
  metadata?: Record<string, any> | null;
};

export type FileContent = {
  name?: string | null;
  mimeType?: string | null;
  bytes?: string | null;
  uri?: string | null;
};

export type FilePart = {
  type: 'file';
  file: FileContent;
  metadata?: Record<string, any> | null;
};

export type DataPart = {
  type: 'data';
  data: Record<string, any>;
  metadata?: Record<string, any> | null;
};

export type Message = {
  role: 'user' | 'agent';
  parts: Part[];
  metadata?: Record<string, any> | null;
};

export type TaskStatus = {
  state: TaskState;
  message?: Message | null;
  timestamp?: string;
};

export type Artifact = {
  name?: string | null;
  description?: string | null;
  parts: Part[];
  index?: number;
  append?: boolean | null;
  lastChunk?: boolean | null;
  metadata?: Record<string, any> | null;
};

export type Task = {
  id: string;
  sessionId?: string | null;
  status: TaskStatus;
  artifacts?: Artifact[] | null;
  history?: Message[] | null;
  metadata?: Record<string, any> | null;
};

export type TaskIdParams = {
  id: string;
  metadata?: Record<string, any> | null;
};

export type TaskQueryParams = {
  id: string;
  historyLength?: number | null;
  metadata?: Record<string, any> | null;
};

export type AuthenticationInfo = {
  schemes: string[];
  credentials?: string | null;
} & Record<string, any>;

export type PushNotificationConfig = {
  url: string;
  token?: string | null;
  authentication?: AuthenticationInfo | null;
};

export type TaskPushNotificationConfig = {
  id: string;
  pushNotificationConfig: PushNotificationConfig;
};

export type TaskSendParams = {
  id: string;
  sessionId?: string;
  message: Message;
  pushNotification?: PushNotificationConfig | null;
  historyLength?: number | null;
  metadata?: Record<string, any> | null;
};

export type TaskStatusUpdateEvent = {
  id: string;
  status: TaskStatus;
  final?: boolean;
  metadata?: Record<string, any> | null;
};

export type TaskArtifactUpdateEvent = {
  id: string;
  artifact: Artifact;
  metadata?: Record<string, any> | null;
};

// A2A Request Types
export type SendTaskRequest = JSONRPCRequest & {
  method: 'tasks/send';
  params: TaskSendParams;
};

export type GetTaskRequest = JSONRPCRequest & {
  method: 'tasks/get';
  params: TaskQueryParams;
};

export type CancelTaskRequest = JSONRPCRequest & {
  method: 'tasks/cancel';
  params: TaskIdParams;
};

export type SetTaskPushNotificationRequest = JSONRPCRequest & {
  method: 'tasks/pushNotification/set';
  params: TaskPushNotificationConfig;
};

export type GetTaskPushNotificationRequest = JSONRPCRequest & {
  method: 'tasks/pushNotification/get';
  params: TaskIdParams;
};

export type TaskResubscriptionRequest = JSONRPCRequest & {
  method: 'tasks/resubscribe';
  params: TaskQueryParams;
};

export type SendTaskStreamingRequest = JSONRPCRequest & {
  method: 'tasks/sendSubscribe';
  params: TaskSendParams;
};

// A2A Response Types
export type SendTaskResponse = JSONRPCResponse & {
  result?: Task | null;
};

export type GetTaskResponse = JSONRPCResponse & {
  result?: Task | null;
};

export type CancelTaskResponse = JSONRPCResponse & {
  result?: Task | null;
};

export type SetTaskPushNotificationResponse = JSONRPCResponse & {
  result?: TaskPushNotificationConfig | null;
};

export type GetTaskPushNotificationResponse = JSONRPCResponse & {
  result?: TaskPushNotificationConfig | null;
};

export type SendTaskStreamingResponse = JSONRPCResponse & {
  result?: TaskStatusUpdateEvent | TaskArtifactUpdateEvent | null;
};

// Error Codes
export enum ErrorCode {
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  TASK_NOT_FOUND = -32001,
  TASK_NOT_CANCELABLE = -32002,
  PUSH_NOTIFICATION_NOT_SUPPORTED = -32003,
  UNSUPPORTED_OPERATION = -32004,
}

// Agent Card Types
export type AgentCapabilities = {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
};

export type AgentAuthentication = {
  schemes: string[];
  credentials?: string | null;
};

export type AgentProvider = {
  organization: string;
  url?: string | null;
};

export type AgentSkill = {
  id: string;
  name: string;
  description?: string | null;
  tags?: string[] | null;
  examples?: string[] | null;
  inputModes?: string[] | null;
  outputModes?: string[] | null;
};

export type AgentCard = {
  name: string;
  description?: string | null;
  url: string;
  provider?: AgentProvider | null;
  version: string;
  documentationUrl?: string | null;
  capabilities: AgentCapabilities;
  authentication?: AgentAuthentication | null;
  defaultInputModes?: string[];
  defaultOutputModes?: string[];
  skills: AgentSkill[];
};

// A2A Protocol Type
export type A2ARequest =
  | SendTaskRequest
  | GetTaskRequest
  | CancelTaskRequest
  | SetTaskPushNotificationRequest
  | GetTaskPushNotificationRequest
  | TaskResubscriptionRequest;
