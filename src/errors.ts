export class PushServiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class InvalidDeviceTokenError extends PushServiceError {
  constructor() {
    super("Device token is required.");
  }
}

export class InvalidTopicError extends PushServiceError {
  constructor(topic: string) {
    super(`Invalid Firebase topic name: ${topic}`);
  }
}

export class InvalidTopicInputError extends PushServiceError {
  constructor(message: string) {
    super(message);
  }
}

export class UnsupportedOperationError extends PushServiceError {
  constructor(message: string) {
    super(message);
  }
}

export class LegacyFirebaseMessagingStoreError extends PushServiceError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
