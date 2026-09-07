import test from "node:test";
import assert from "node:assert/strict";
import { LegacyFirebaseMessagingStore, LegacyFirebaseMessagingStoreError } from "../src/index.js";

test("LegacyFirebaseMessagingStore includes response bodies in HTTP failures", async () => {
  const store = new LegacyFirebaseMessagingStore({
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
