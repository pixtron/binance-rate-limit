export abstract class QueueError extends Error {
  public abstract code: string;
  public retryIn?: number;

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      stack: this.stack,
      code: this.code,
      retryIn: this.retryIn,
    }
  }
}

export class QueueCanceledError extends QueueError {
  public code: string;

  constructor() {
    const msg = `Request has been canceled.`;
    super(msg);
    this.code = 'E_CANCELED';
    this.name = 'QueueCanceledError';
  }
}

export class QueueSizeExceededError extends QueueError {
  public code: string;

  constructor(max: number) {
    const msg = `Queue max size of ${max} queued requests exceeded`;
    super(msg);
    this.code = 'E_QUEUE_SIZE_EXCEEDED';
    this.name = 'QueueSizeExceededError';
  }
}

export class QueueRetryInError extends QueueError {
  public code: string;
  public retryIn: number;

  constructor(retryIn: number) {
    const msg = `Retry in ${retryIn}ms`;
    super(msg);
    this.code = 'E_RETRY_IN';
    this.name = 'QueueRetryInError';
    this.retryIn = retryIn;
  }
}

export class QueueMaxConcurrentRequestsError extends QueueError {
  public code: string;

  constructor(max: number) {
    const msg = `Max concurrent requests of ${max} requests exceeded`;
    super(msg);
    this.code = 'E_MAX_CONCCURENT_REQUESTS';
    this.name = 'QueueMaxConcurrentRequestsError';
  }
}

export class QueueTimeoutError extends QueueError {
  public code: string;

  constructor(max: Date) {
    const msg = `Request timed out. Could not dispatch request before ${max.toISOString()}`;
    super(msg);
    this.code = 'E_TIMEOUT';
    this.name = 'QueueTimeoutError';
  }
}
