import type { NotificationsStore } from "../types.js";

export class InMemoryNotificationsStore implements NotificationsStore {
  private readonly topicsByDeviceToken = new Map<string, Set<string>>();

  async getTopicsForDevice(deviceToken: string): Promise<string[]> {
    return [...(this.topicsByDeviceToken.get(deviceToken) ?? new Set<string>())];
  }

  async addTopicsForDevice(deviceToken: string, topicNames: string[]): Promise<void> {
    const topics = this.topicsByDeviceToken.get(deviceToken) ?? new Set<string>();

    topicNames.forEach((topicName) => topics.add(topicName));
    this.topicsByDeviceToken.set(deviceToken, topics);
  }

  async removeTopicsForDevice(deviceToken: string, topicNames: string[]): Promise<void> {
    const topics = this.topicsByDeviceToken.get(deviceToken);
    if (!topics) {
      return;
    }

    topicNames.forEach((topicName) => topics.delete(topicName));

    if (topics.size === 0) {
      this.topicsByDeviceToken.delete(deviceToken);
      return;
    }

    this.topicsByDeviceToken.set(deviceToken, topics);
  }
}
