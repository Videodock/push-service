import test from "node:test";
import assert from "node:assert/strict";
import { LegacyFirebaseMessagingStore, LegacyFirebaseMessagingStoreError } from "../src/index.js";

test("LegacyFirebaseMessagingStore includes response bodies in HTTP failures", async () => {
  const store = new LegacyFirebaseMessagingStore({
    appId: "app-id",
    sandbox: true,
    getAccessToken: async () => "token",
    fetch: async () => new Response('{"error":"InvalidToken"}', { status: 400, statusText: "Bad Request" })
  });

  await assert.rejects(
    () => store.getTopicsForDevice("device-token"),
    (error: unknown) => {
      assert.ok(error instanceof LegacyFirebaseMessagingStoreError);
      assert.match(error.message, /400 Bad Request/);
      assert.match(error.message, /InvalidToken/);
      return true;
    }
  );
});

test("LegacyFirebaseMessagingStore surfaces logical payload errors", async () => {
  const store = new LegacyFirebaseMessagingStore({
    appId: "app-id",
    sandbox: true,
    getAccessToken: async () => "token",
    fetch: async () =>
      new Response('{"error":"SomethingWentWrong"}', {
        status: 200,
        headers: { "content-type": "application/json" }
      })
  });

  await assert.rejects(
    () => store.getTopicsForDevice("device-token"),
    (error: unknown) => {
      assert.ok(error instanceof LegacyFirebaseMessagingStoreError);
      assert.match(error.message, /SomethingWentWrong/);
      return true;
    }
  );
});

test("LegacyFirebaseMessagingStore exchanges APNs tokens through batchImport", async () => {
  const apnsToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const store = new LegacyFirebaseMessagingStore({
    appId: "app-id",
    getAccessToken: async () => "token",
    sandbox: true,
    fetch: async (input, init) => {
      assert.equal(String(input), "https://iid.googleapis.com/iid/v1:batchImport");
      assert.equal(init?.method, "POST");
      assert.deepEqual(init?.headers, {
        Authorization: "Bearer token",
        "Content-Type": "application/json",
        access_token_auth: "true"
      });
      assert.deepEqual(JSON.parse(String(init?.body)), {
        application: "app-id",
        sandbox: true,
        apns_tokens: [apnsToken]
      });

      return new Response(JSON.stringify({
        results: [
          {
            registration_token: "fcm-token"
          }
        ]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
  });

  assert.equal(await store.exchangeDeviceToken(apnsToken), "fcm-token");
});

test("LegacyFirebaseMessagingStore returns non-APNs tokens unchanged", async () => {
  const store = new LegacyFirebaseMessagingStore({
    appId: "app-id",
    sandbox: true,
    getAccessToken: async () => "token",
    fetch: async () => {
      throw new Error("fetch should not be called");
    }
  });

  assert.equal(await store.exchangeDeviceToken("fcm-token"), "fcm-token");
});
