import { InvalidDeviceTokenError, UnsupportedOperationError } from "./errors.js";
import { assertValidTopicName, normalizeTopics } from "./topics.js";
import type {
  PushServiceOptions,
  SendResult,
  TopicManagementResult,
  TopicSendRequest,
  TriggerMessage
} from "./types.js";

export class PushService {
  constructor(private readonly options: PushServiceOptions) {}

  async getNotifications(deviceToken: string): Promise<string[]> {
    assertDeviceToken(deviceToken);

    if (!this.options.store) {
      throw new UnsupportedOperationError(
        "This PushService instance cannot read subscriptions. Configure a NotificationsStore if your application needs getNotifications(deviceToken)."
      );
    }

    return this.options.store.getTopicsForDevice(deviceToken);
  }

  async subscribe(deviceToken: string, topics: string | string[]): Promise<TopicManagementResult> {
    assertDeviceToken(deviceToken);
    const topicNames = normalizeTopics(topics);
    const result = await this.options.provider.subscribeToTopics(deviceToken, topicNames);

    if (this.options.store?.addTopicsForDevice) {
      await this.options.store.addTopicsForDevice(deviceToken, topicNames);
    }

    return result;
  }

  async unsubscribe(deviceToken: string, topics: string | string[]): Promise<TopicManagementResult> {
    assertDeviceToken(deviceToken);
    const topicNames = normalizeTopics(topics);
    const result = await this.options.provider.unsubscribeFromTopics(deviceToken, topicNames);

    if (this.options.store?.removeTopicsForDevice) {
      await this.options.store.removeTopicsForDevice(deviceToken, topicNames);
    }

    return result;
  }

  async sendToTopic(topic: string, request: Omit<TopicSendRequest, "topic">): Promise<SendResult> {
    assertValidTopicName(topic);

    return this.options.provider.sendToTopic({
      topic,
      message: request.message
    });
  }

  async trigger(input: TriggerMessage): Promise<SendResult[]> {
    const topics = normalizeTopics(input.topics);

    return Promise.all(
      topics.map((topic) =>
        this.sendToTopic(topic, {
          message: input.message
        })
      )
    );
  }
}

function assertDeviceToken(deviceToken: string): void {
  if (!deviceToken.trim()) {
    throw new InvalidDeviceTokenError();
  }
}
