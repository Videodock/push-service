import type { Credential } from "firebase-admin/app";
import { LegacyFirebaseMessagingStoreError } from "../errors.js";
import { assertValidTopicName, stripTopicPrefix } from "../topics.js";
import type { LegacyFirebaseMessagingStoreOptions, NotificationsStore } from "../types.js";

const DEFAULT_ENDPOINT = "https://iid.googleapis.com/iid/info";

interface LegacyFirebaseMessagingResponse {
  rel?: {
    topics?: Record<string, unknown>;
  };
  error?: string;
}

export class LegacyFirebaseMessagingStore implements NotificationsStore {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: LegacyFirebaseMessagingStoreOptions) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getTopicsForDevice(deviceToken: string): Promise<string[]> {
    const accessToken = await this.options.getAccessToken();
    const url = new URL(`${this.endpoint}/${deviceToken}`);
    url.searchParams.set("details", "true");

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        access_token_auth: "true"
      }
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new LegacyFirebaseMessagingStoreError(
        `Legacy Firebase Messaging store request failed with ${response.status} ${response.statusText}: ${responseText}`
      );
    }

    const payload = (await response.json()) as LegacyFirebaseMessagingResponse;

    if (payload.error) {
      throw new LegacyFirebaseMessagingStoreError(`Legacy Firebase Messaging store returned an error: ${payload.error}`);
    }

    return Object.keys(payload.rel?.topics ?? {}).map((topicName) => {
      const normalizedTopicName = stripTopicPrefix(topicName);
      assertValidTopicName(normalizedTopicName);
      return normalizedTopicName;
    });
  }
}

export function createServiceAccountAccessTokenProvider(credential: Credential): () => Promise<string> {
  return async () => {
    const accessToken = await credential.getAccessToken();
    return accessToken.access_token;
  };
}
