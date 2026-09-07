import test from "node:test";
import assert from "node:assert/strict";
import { assertValidTopicName, normalizeTopics, stripTopicPrefix } from "../src/topics.js";

test("assertValidTopicName accepts plain topic names", () => {
  assert.doesNotThrow(() => assertValidTopicName("news-updates"));
});

test("normalizeTopics returns a single topic as an array", () => {
  assert.deepEqual(normalizeTopics("news-updates"), ["news-updates"]);
});

test("normalizeTopics preserves multiple plain topic names", () => {
  assert.deepEqual(normalizeTopics(["news-updates", "product-alerts"]), [
    "news-updates",
    "product-alerts"
  ]);
});

test("assertValidTopicName rejects Firebase topic paths", () => {
  assert.throws(() => assertValidTopicName("/topics/news-updates"));
});

test("stripTopicPrefix converts Firebase topic paths to plain topic names", () => {
  assert.equal(stripTopicPrefix("/topics/news-updates"), "news-updates");
});
