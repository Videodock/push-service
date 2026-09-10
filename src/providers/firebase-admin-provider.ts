import type { App, FirebaseArrayIndexError } from "firebase-admin/app";
import { getMessaging, type Messaging, type Message, type MessagingTopicManagementResponse } from "firebase-admin/messaging";
import type {
  ConditionSendRequest,
  PushMessageInput,
  PushProvider,
  SendResult,
  TopicManagementResult,
  TopicSendRequest
} from "../types.js";
import { assertValidTopicName } from "../topics.js";

export class FirebaseAdminPushProvider implements PushProvider {
  constructor(private readonly messaging: Messaging) {}

  static fromApp(app?: App): FirebaseAdminPushProvider {
    return new FirebaseAdminPushProvider(getMessaging(app));
  }

  async subscribeToTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult> {
    topicNames.forEach(assertValidTopicName);

    const responses = await Promise.all(
      topicNames.map((topicName) => this.messaging.subscribeToTopic(deviceToken, topicName))
    );

    return toTopicManagementResult(topicNames, responses);
  }

  async unsubscribeFromTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult> {
    topicNames.forEach(assertValidTopicName);

    const responses = await Promise.all(
      topicNames.map((topicName) => this.messaging.unsubscribeFromTopic(deviceToken, topicName))
    );

    return toTopicManagementResult(topicNames, responses);
  }

  async sendToTopic(request: TopicSendRequest): Promise<SendResult> {
    assertValidTopicName(request.topic);

    const messageId = await this.messaging.send({
      ...createBaseMessage(request.message),
      topic: request.topic
    });

    return { messageId };
  }

  async sendToCondition(request: ConditionSendRequest): Promise<SendResult> {
    const messageId = await this.messaging.send({
      ...createBaseMessage(request.message),
      condition: request.condition
    });

    return { messageId };
  }
}

function createBaseMessage(message: PushMessageInput): Omit<Message, "topic" | "condition"> {
  const data = {
    ...(message.data ?? {}),
    ...(message.deepLink ? { deepLink: message.deepLink, url: message.deepLink } : {})
  };

  return {
    notification: message.title || message.body || message.imageUrl
      ? {
          ...(message.title ? { title: message.title } : {}),
          ...(message.body ? { body: message.body } : {}),
          ...(message.imageUrl ? { imageUrl: message.imageUrl } : {})
        }
      : undefined,
    data: Object.keys(data).length > 0 ? data : undefined,
    apns: message.deepLink
      ? {
          payload: {
            aps: {
              sound: "default"
            }
          }
        }
      : undefined
  };
}

function toTopicManagementResult(topicNames: string[], responses: MessagingTopicManagementResponse[]): TopicManagementResult {
  return {
    topicNames,
    successCount: responses.reduce((count, response) => count + response.successCount, 0),
    failureCount: responses.reduce((count, response) => count + response.failureCount, 0),
    errors: responses.flatMap((response, responseIndex) =>
      response.errors.map((error: FirebaseArrayIndexError) => ({
        index: responseIndex,
        reason: error.error.message
      }))
    )
  };
}
