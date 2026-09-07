# @videodock/push-service

Framework-agnostic helpers for Firebase Cloud Messaging topic subscriptions, optional subscription storage, and push delivery.

## Status

This package currently focuses on:

- subscribing a device token to Firebase topics
- unsubscribing a device token from Firebase topics
- optionally storing topic state in a separate adapter
- sending push messages to arbitrary Firebase topics

## Install

```bash
npm install @videodock/push-service firebase-admin
```

`firebase-admin` is a peer dependency of this package.

## Quick Start

```ts
import { initializeApp, applicationDefault } from "firebase-admin/app";
import {
  FirebaseAdminPushProvider,
  InMemoryNotificationsStore,
  PushService
} from "@videodock/push-service";

const app = initializeApp({
  credential: applicationDefault()
});

const pushService = new PushService({
  provider: FirebaseAdminPushProvider.fromApp(app),
  store: new InMemoryNotificationsStore()
});

await pushService.subscribe("device-token", [
  "news-updates",
  "product-alerts"
]);

await pushService.sendToTopic(
  "news-updates",
  {
    message: {
      title: "Live now",
      body: "A new update is available",
      deepLink: "my-app://content/item-123"
    }
  }
);
```

## Topic Handling

This package treats topics as topic names, not Firebase topic paths.

Use `news-updates`, not `/topics/news-updates`.

Allowed characters are intentionally narrow:

- letters
- numbers
- `_`
- `-`

That keeps the package reusable across projects while avoiding Firebase-specific path formatting in the public API.

## Adapters

This package deliberately separates push delivery from subscription storage.

- `PushProvider`: subscribe, unsubscribe, and send through FCM or another push backend
- `NotificationsStore`: read and persist current topic state for a device token

That lets you combine:

- `FirebaseAdminPushProvider` for actual topic subscription and delivery
- a future `FirestoreAdapter`, `DatabaseAdapter`, or another store for reads and sync

## API

### `new PushService(options)`

Creates a service around a provider implementation.

If you configure `store`, the service will keep it in sync on subscribe and unsubscribe.

`options`:

- `provider: PushProvider`
- `store?: NotificationsStore`

### `pushService.subscribe(deviceToken, topics)`

Subscribes a device token to one or more topics.

### `pushService.unsubscribe(deviceToken, topics)`

Unsubscribes a device token from one or more topics.

### `pushService.sendToTopic(topic, { message })`

Sends a push message to a single topic.

### `pushService.trigger({ topics, message })`

Sends the same push message to one or more topics.

### `pushService.getNotifications(deviceToken)`

This method delegates to `store.getTopicsForDevice(deviceToken)`.

If no `store` is configured, this method throws.

The bundled `FirebaseAdminPushProvider` only handles push writes and delivery. Use a separate `NotificationsStore` if your application needs reads.

## Legacy Firebase Read Adapter

`LegacyFirebaseMessagingStore` provides an opt-in read path for current topic subscriptions through the deprecated IID info endpoint.

Use it only as a temporary compatibility adapter.

```ts
import { cert, initializeApp } from "firebase-admin/app";
import {
  createServiceAccountAccessTokenProvider,
  FirebaseAdminPushProvider,
  LegacyFirebaseMessagingStore,
  PushService
} from "@videodock/push-service";

const credential = cert("./service-account.json");
const app = initializeApp({ credential });

const pushService = new PushService({
  provider: FirebaseAdminPushProvider.fromApp(app),
  store: new LegacyFirebaseMessagingStore({
    getAccessToken: createServiceAccountAccessTokenProvider(credential)
  })
});
```

This adapter only implements reads. `subscribe()` and `unsubscribe()` continue to write through the configured `PushProvider`.

The legacy endpoint returns topic keys in Firebase format like `/topics/news-updates`. This adapter normalizes those to plain topic names like `news-updates`.

## Example Route Integration

```ts
const pushService = new PushService({
  provider: FirebaseAdminPushProvider.fromApp(app),
  store: new InMemoryNotificationsStore()
});

app.get("/notifications/:deviceToken", async (request) => {
  return pushService.getNotifications(request.params.deviceToken);
});

app.post("/notifications/subscribe", async (request) => {
  const { deviceToken, topics } = request.body;
  return pushService.subscribe(deviceToken, topics);
});
```
