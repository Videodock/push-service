import type { Credential } from 'firebase-admin/app';
import { InvalidDeviceTokenError, LegacyFirebaseMessagingStoreError } from '../errors.js';
import { assertValidTopicName, stripTopicPrefix } from '../topics.js';
import type { LegacyFirebaseMessagingStoreOptions, NotificationsStore } from '../types.js';

const DEFAULT_ENDPOINT = 'https://iid.googleapis.com/iid/info';
const APNS_PATTERN = /^[0-9a-fA-F]{64}$/;

interface LegacyFirebaseMessagingResponse {
  rel?: {
    topics?: Record<string, unknown>;
  };
  error?: string;
}

interface LegacyBatchImportResponse {
  results?: Array<{
    registration_token?: string;
    error?: string;
  }>;
}

export class LegacyFirebaseMessagingStore implements NotificationsStore {
  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor (private readonly options: LegacyFirebaseMessagingStoreOptions) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.fetchImpl = options.fetch ?? fetch;
  }

  async getTopicsForDevice (deviceToken: string): Promise<string[]> {
    const accessToken = await this.options.getAccessToken();
    const url = new URL(`${this.endpoint}/${deviceToken}`);
    url.searchParams.set('details', 'true');

    const response = await this.fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        access_token_auth: 'true'
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

  async exchangeDeviceToken (deviceToken: string) {
    // if the given deviceToken is not an APNs token, we can return it as is (assuming it is an FCM token)
    if (!APNS_PATTERN.test(deviceToken)) return deviceToken;

    const accessToken = await this.options.getAccessToken();

    const response = await this.fetchImpl('https://iid.googleapis.com/iid/v1:batchImport', {
      method: 'POST',
      body: JSON.stringify({
        application: this.options.appId,
        sandbox: this.options.sandbox,
        apns_tokens: [
          deviceToken,
        ],
      }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        access_token_auth: 'true'
      },
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new LegacyFirebaseMessagingStoreError(
        `Legacy Firebase Messaging batchImport failed with ${response.status} ${response.statusText}: ${responseText}`
      );
    }

    const data = await response.json() as LegacyBatchImportResponse;
    const result = data.results?.[0];

    if (result?.error) {
      throw new LegacyFirebaseMessagingStoreError(`Legacy Firebase Messaging batchImport returned an error: ${result.error}`);
    }

    if (!result?.registration_token) {
      throw new InvalidDeviceTokenError();
    }

    return result.registration_token;
  }
}

export function createServiceAccountAccessTokenProvider (credential: Credential): () => Promise<string> {
  return async () => {
    const accessToken = await credential.getAccessToken();
    return accessToken.access_token;
  };
}
