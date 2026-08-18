export class IntegrationError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 400,
    readonly retryable = false,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

export class CredentialValidationError extends IntegrationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CREDENTIALS_INVALID", 401, false, details);
    this.name = "CredentialValidationError";
  }
}

export class UnsupportedChannelError extends IntegrationError {
  constructor(providerId: string, channelId: string) {
    super(
      `Logistics provider ${providerId} does not support sales channel ${channelId}`,
      "UNSUPPORTED_CHANNEL_COMBO",
      400,
      false,
      { providerId, channelId }
    );
    this.name = "UnsupportedChannelError";
  }
}

export class UnsupportedCapabilityError extends IntegrationError {
  constructor(capability: string, providerId: string) {
    super(
      `${providerId} does not support capability: ${capability}`,
      "UNSUPPORTED_CAPABILITY",
      400,
      false,
      { capability, providerId }
    );
    this.name = "UnsupportedCapabilityError";
  }
}
