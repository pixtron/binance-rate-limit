
export class QueueError extends Error {
  public code: string;
  public retryIn?: number;

  constructor(arg?: string | number) {
    let msg: string, code: string, retryIn: number | undefined;

    if (typeof arg === 'string') {
      msg = arg;
      code = 'E_QUEUE_SIZE_EXCEEDED';
    } else if (arg) {
      msg = `Retry in ${arg}ms`;
      code = 'E_RETRY_IN';
      retryIn = arg;
    } else {
      msg = `Max concurrent requests exceeded`;
      code = 'E_MAX_CONCCURENT_REQUESTS';
    }

    super(msg);

    this.code = code;
    this.retryIn = retryIn;
  }
}
