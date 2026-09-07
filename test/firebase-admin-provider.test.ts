import test from "node:test";
import assert from "node:assert/strict";
import { FirebaseAdminPushProvider, InvalidTopicError } from "../src/index.js";
import type { Messaging } from "firebase-admin/messaging";

function createTopicManagementResponse(successCount: number, failureCount: number, messages: string[] = []) {
  return {
    successCount,
    failureCount,
    errors: messages.map((message, index) => ({
      index,
      error: new Error(message)
    }))
  };
}

test("FirebaseAdminPushProvider subscribes each topic separately and aggregates results", async () => {
  const calls: Array<{ token: string; topic: string }> = [];
  const messaging = {
    subscribeToTopic: async (token: string, topic: string) => {
      calls.push({ token, topic });
      return topic === "bad-topic"
        ? createTopicManagementResponse(0, 1, ["broken topic"])
        : createTopicManagementResponse(1, 0);
    }
  } as Partial<Messaging> as Messaging;

  const provider = new FirebaseAdminPushProvider(messaging);
  const result = await provider.subscribeToTopics("device-token", ["news-updates", "bad-topic"]);

  assert.deepEqual(calls, [
    { token: "device-token", topic: "news-updates" },
    { token: "device-token", topic: "bad-topic" }
  ]);
  assert.deepEqual(result, {
    topicNames: ["news-updates", "bad-topic"],
    successCount: 1,
    failureCount: 1,
    errors: [{ index: 1, reason: "broken topic" }]
  });
});

test("FirebaseAdminPushProvider unsubscribes each topic separately and aggregates results", async () => {
  const calls: Array<{ token: string; topic: string }> = [];
  const messaging = {
    unsubscribeFromTopic: async (token: string, topic: string) => {
      calls.push({ token, topic });
      return createTopicManagementResponse(1, 0);
    }
  } as Partial<Messaging> as Messaging;

  const provider = new FirebaseAdminPushProvider(messaging);
  const result = await provider.unsubscribeFromTopics("device-token", ["news-updates", "live-events"]);

  assert.deepEqual(calls, [
    { token: "device-token", topic: "news-updates" },
    { token: "device-token", topic: "live-events" }
  ]);
  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 0);
});

test("FirebaseAdminPushProvider rejects invalid topic names before subscribe", async () => {
  const provider = new FirebaseAdminPushProvider({} as Messaging);
  await assert.rejects(() => provider.subscribeToTopics("device-token", ["/topics/news-updates"]), InvalidTopicError);
});

test("FirebaseAdminPushProvider sends topic messages with notification and data payloads", async () => {
  let sentMessage: unknown;
  const messaging = {
    send: async (message: unknown) => {
      sentMessage = message;
      return "message-id";
    }
  } as Partial<Messaging> as Messaging;

  const provider = new FirebaseAdminPushProvider(messaging);
  const result = await provider.sendToTopic({
    topic: "news-updates",
    message: {
      title: "Hello",
      body: "World",
      imageUrl: "https://example.com/image.png",
      deepLink: "my-app://news/1",
      data: { key: "value" }
    }
  });

  assert.equal(result.messageId, "message-id");
  assert.deepEqual(sentMessage, {
    topic: "news-updates",
    notification: {
      title: "Hello",
      body: "World",
      imageUrl: "https://example.com/image.png"
    },
    data: {
      key: "value",
      deepLink: "my-app://news/1"
    },
    android: {
      data: {
        deepLink: "my-app://news/1"
      }
    },
    apns: {
      payload: {
        aps: {
          sound: "default"
        }
      },
      fcmOptions: {
        analyticsLabel: "push-service"
      }
    }
  });
});

test("FirebaseAdminPushProvider sends condition messages", async () => {
  let sentMessage: unknown;
  const messaging = {
    send: async (message: unknown) => {
      sentMessage = message;
      return "message-id";
    }
  } as Partial<Messaging> as Messaging;

  const provider = new FirebaseAdminPushProvider(messaging);
  const result = await provider.sendToCondition({
    condition: "'a' in topics || 'b' in topics",
    message: { body: "World" }
  });

  assert.equal(result.messageId, "message-id");
  assert.deepEqual(sentMessage, {
    condition: "'a' in topics || 'b' in topics",
    notification: {
      body: "World"
    },
    data: undefined,
    android: undefined,
    apns: undefined
  });
});
