import test from "node:test";
import assert from "node:assert/strict";
import { InMemoryNotificationsStore } from "../src/index.js";

test("InMemoryNotificationsStore stores and returns topics", async () => {
  const store = new InMemoryNotificationsStore();

  await store.addTopicsForDevice("device-token", ["news-updates", "live-events"]);

  assert.deepEqual(await store.getTopicsForDevice("device-token"), ["news-updates", "live-events"]);
});

test("InMemoryNotificationsStore de-duplicates topics", async () => {
  const store = new InMemoryNotificationsStore();

  await store.addTopicsForDevice("device-token", ["news-updates", "news-updates"]);

  assert.deepEqual(await store.getTopicsForDevice("device-token"), ["news-updates"]);
});

test("InMemoryNotificationsStore ignores removals for unknown devices", async () => {
  const store = new InMemoryNotificationsStore();

  await assert.doesNotReject(() => store.removeTopicsForDevice("missing-device", ["news-updates"]));
  assert.deepEqual(await store.getTopicsForDevice("missing-device"), []);
});

test("InMemoryNotificationsStore removes matching topics", async () => {
  const store = new InMemoryNotificationsStore();

  await store.addTopicsForDevice("device-token", ["news-updates", "live-events"]);
  await store.removeTopicsForDevice("device-token", ["news-updates"]);

  assert.deepEqual(await store.getTopicsForDevice("device-token"), ["live-events"]);
});

test("InMemoryNotificationsStore removes empty device entries", async () => {
  const store = new InMemoryNotificationsStore();

  await store.addTopicsForDevice("device-token", ["news-updates"]);
  await store.removeTopicsForDevice("device-token", ["news-updates"]);

  assert.deepEqual(await store.getTopicsForDevice("device-token"), []);
});
