import { InvalidTopicError, InvalidTopicInputError } from "./errors.js";

const VALID_TOPIC_NAME = /^[A-Za-z0-9_-]+$/;

export function assertValidTopicName(topicName: string): void {
  if (typeof topicName !== "string" || !VALID_TOPIC_NAME.test(topicName.trim())) {
    throw new InvalidTopicError(topicName);
  }
}

export function normalizeTopics(input: string | string[]): string[] {
  const topics = Array.isArray(input) ? input : [input];

  if (topics.length === 0) {
    throw new InvalidTopicInputError("At least one topic is required.");
  }

  topics.forEach(assertValidTopicName);
  return topics.map((topic) => topic.trim());
}

export function stripTopicPrefix(topicName: string): string {
  return topicName.startsWith("/topics/") ? topicName.slice("/topics/".length) : topicName;
}
