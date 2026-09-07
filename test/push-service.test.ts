import test from "node:test";
import assert from "node:assert/strict";
import {
  createServiceAccountAccessTokenProvider,
  LegacyFirebaseMessagingStore,
  PushService,
  UnsupportedOperationError
} from "../src/index.js";
import type { NotificationsStore, PushProvider, TopicManagementResult, TopicSendRequest } from "../src/index.js";
import type { Credential } from "firebase-admin/app";
import { InvalidDeviceTokenError, InvalidTopicError } from "../src/index.js";

class FakeProvider implements PushProvider {
  public subscribed: { deviceToken: string; topicNames: string[] }[] = [];
  public unsubscribed: { deviceToken: string; topicNames: string[] }[] = [];
  public sent: TopicSendRequest[] = [];

  async subscribeToTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult> {
    this.subscribed.push({ deviceToken, topicNames });
    return { topicNames, successCount: topicNames.length, failureCount: 0, errors: [] };
  }

  async unsubscribeFromTopics(deviceToken: string, topicNames: string[]): Promise<TopicManagementResult> {
    this.unsubscribed.push({ deviceToken, topicNames });
    return { topicNames, successCount: topicNames.length, failureCount: 0, errors: [] };
  }

  async sendToTopic(request: TopicSendRequest) {
    this.sent.push(request);
    return { messageId: `message:${request.topic}` };
  }
}

class FakeStore implements NotificationsStore {
  public topics = new Map<string, string[]>([
    ["device-token", ["news-updates", "product-alerts", "general-announcements"]]
  ]);

  async getTopicsForDevice(deviceToken: string): Promise<string[]> {
    return this.topics.get(deviceToken) ?? [];
  }

  async addTopicsForDevice(deviceToken: string, topicNames: string[]): Promise<void> {
    const existing = new Set(this.topics.get(deviceToken) ?? []);
    topicNames.forEach((topicName) => existing.add(topicName));
    this.topics.set(deviceToken, [...existing]);
  }

  async removeTopicsForDevice(deviceToken: string, topicNames: string[]): Promise<void> {
    const existing = new Set(this.topics.get(deviceToken) ?? []);
    topicNames.forEach((topicName) => existing.delete(topicName));
    this.topics.set(deviceToken, [...existing]);
  }
}

test("subscribe forwards opaque topic strings", async () => {
  const provider = new FakeProvider();
  const service = new PushService({ provider });

  await service.subscribe("device-token", [
    "news-updates",
    "product-alerts"
  ]);

  assert.deepEqual(provider.subscribed, [
    {
      deviceToken: "device-token",
      topicNames: ["news-updates", "product-alerts"]
    }
  ]);
});

test("subscribe rejects blank device tokens", async () => {
  const service = new PushService({ provider: new FakeProvider() });
  await assert.rejects(() => service.subscribe("   ", ["news-updates"]), InvalidDeviceTokenError);
});

test("sendToTopic rejects invalid topic names", async () => {
  const service = new PushService({ provider: new FakeProvider() });
  await assert.rejects(() => service.sendToTopic("/topics/news-updates", { message: {} }), InvalidTopicError);
});

test("getNotifications requires a configured store", async () => {
  const service = new PushService({ provider: new FakeProvider() });

  await assert.rejects(() => service.getNotifications("device-token"), UnsupportedOperationError);
});

test("getNotifications returns the topics from the store unchanged", async () => {
  const service = new PushService({
    provider: new FakeProvider(),
    store: new FakeStore()
  });

  const notifications = await service.getNotifications("device-token");

  assert.deepEqual(notifications, ["news-updates", "product-alerts", "general-announcements"]);
});

test("subscribe syncs the configured store", async () => {
  const provider = new FakeProvider();
  const store = new FakeStore();
  const service = new PushService({ provider, store });

  await service.subscribe("other-device", ["a", "b"]);

  assert.deepEqual(await store.getTopicsForDevice("other-device"), ["a", "b"]);
});

test("unsubscribe syncs the configured store", async () => {
  const provider = new FakeProvider();
  const store = new FakeStore();
  const service = new PushService({ provider, store });

  await service.unsubscribe("device-token", ["product-alerts"]);

  assert.deepEqual(await store.getTopicsForDevice("device-token"), ["news-updates", "general-announcements"]);
});

test("subscribe skips store sync when the store is read-only", async () => {
  const provider = new FakeProvider();
  const store = new LegacyFirebaseMessagingStore({
    getAccessToken: async () => "token",
    fetch: async () =>
      new Response(JSON.stringify({ rel: { topics: { "/topics/demo": {} } } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
  });
  const service = new PushService({ provider, store });

  await assert.doesNotReject(() => service.subscribe("device-token", ["demo"]));
});

test("LegacyFirebaseMessagingStore reads topics from the IID info endpoint", async () => {
  const store = new LegacyFirebaseMessagingStore({
    getAccessToken: async () => "token",
    fetch: async (input, init) => {
      assert.equal(String(input), "https://iid.googleapis.com/iid/info/device-token?details=true");
      assert.equal(init?.headers instanceof Headers, false);
      assert.deepEqual(init?.headers, {
        Authorization: "Bearer token",
        access_token_auth: "true"
      });

      return new Response(
        JSON.stringify({
          rel: {
            topics: {
              "/topics/one": {},
              "/topics/two": {}
            }
          }
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      );
    }
  });

  assert.deepEqual(await store.getTopicsForDevice("device-token"), ["one", "two"]);
});

test("LegacyFirebaseMessagingStore preserves raw FCM token characters in the IID path", async () => {
  const deviceToken = "dObkozJYTGmR4tepBDBFZq:APA91bETmo0B2flzjge_dja6SGVqTAQbqDKfcbFBpejwndY5VBIbiyJX_1ZWsO5PIQOPLEA7BEuMFyR8DwYJ0jTDBgM5K3HK2PGf7_BBU96gLvkLSXqJGi0";
  const store = new LegacyFirebaseMessagingStore({
    getAccessToken: async () => "token",
    fetch: async (input) => {
      assert.equal(
        String(input),
        `https://iid.googleapis.com/iid/info/${deviceToken}?details=true`
      );

      return new Response(JSON.stringify({ rel: { topics: {} } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.deepEqual(await store.getTopicsForDevice(deviceToken), []);
});

test("createServiceAccountAccessTokenProvider resolves the credential access token", async () => {
  const provider = createServiceAccountAccessTokenProvider({
    getAccessToken: async () => ({
      access_token: "oauth-token",
      expires_in: 3600
    })
  } as Credential);

  await assert.doesNotReject(async () => {
    assert.equal(await provider(), "oauth-token");
  });
});

test("trigger sends the same message to each topic", async () => {
  const provider = new FakeProvider();
  const service = new PushService({ provider });

  await service.trigger({
    topics: ["news-updates", "billing-alerts"],
    message: {
      title: "Now live",
      body: "A new update is available"
    }
  });

  assert.deepEqual(provider.sent, [
    {
      topic: "news-updates",
      message: {
        title: "Now live",
        body: "A new update is available"
      }
    },
    {
      topic: "billing-alerts",
      message: {
        title: "Now live",
        body: "A new update is available"
      }
    }
  ]);
});
