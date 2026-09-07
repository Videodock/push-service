export interface PushMessageInput {
  title?: string;
  body?: string;
  imageUrl?: string;
  deepLink?: string;
  data?: Record<string, string>;
}

export interface TopicSendRequest {
  topic: string;
  message: PushMessageInput;
}

export interface ConditionSendRequest {
  condition: string;
  message: PushMessageInput;
}

export interface SendResult {
  messageId: string;
}

export interface TopicManagementError {
  index: number;
  reason: string;
}

export interface TopicManagementResult {
  topicNames: string[];
  successCount: number;
  failureCount: number;
  errors: TopicManagementError[];
}

export interface PushProvider {
  subscribeToTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult>;
  unsubscribeFromTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult>;
  sendToTopic(request: TopicSendRequest): Promise<SendResult>;
  sendToCondition?(request: ConditionSendRequest): Promise<SendResult>;
}

export interface NotificationsStore {
  getTopicsForDevice(deviceToken: string): Promise<string[]>;
  addTopicsForDevice?(deviceToken: string, topicNames: string[]): Promise<void>;
  removeTopicsForDevice?(deviceToken: string, topicNames: string[]): Promise<void>;
}

export interface LegacyFirebaseMessagingStoreOptions {
  getAccessToken: () => Promise<string>;
  endpoint?: string;
  fetch?: typeof fetch;
}

export interface PushServiceOptions {
  provider: PushProvider;
  store?: NotificationsStore;
}

export interface TriggerMessage {
  topics: string | string[];
  message: PushMessageInput;
}

export type TriggerInput = TriggerMessage;
