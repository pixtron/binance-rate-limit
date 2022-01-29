import { createHash } from 'crypto';
import {
  IQueueOptions,
  IQueuedRequest,
  IQueueRequestConfig,
  TQueueDispatchFn,
} from './types';

import { IResponse } from '../types';
import {
  QueueCanceledError,
  QueueMaxConcurrentRequestsError,
  QueueRetryInError,
  QueueSizeExceededError,
  QueueTimeoutError,
} from './error';
import { AbstractLimiter } from '../limiters/index';
import { RetryTimeout, getHeaderValue } from '../utils/index';

export abstract class AbstractQueue<
  RC extends IQueueRequestConfig,
  L extends AbstractLimiter
> {
  protected _limiter: L;

  protected _options: IQueueOptions;
  protected _queue: IQueuedRequest<RC>[] = [];
  protected _concurrentRequests = 0;
  protected _retryTimeout: RetryTimeout = new RetryTimeout(true);
  protected _keyAliases: Map<string, string> = new Map();
  protected _tickRunning = false;

  constructor(
    limiterFactory: () => L,
    options: Partial<IQueueOptions> = {}
  ) {
    this._options = {
      maxConcurrentRequests: 10,
      maxQueueSize: Infinity,
      ...options
    }

    this._limiter = limiterFactory();

    this._retryTimeout.on('elapsed', this._tick.bind(this));
  }

  public get limiter(): L {
    return this._limiter;
  }

  public get queue(): IQueuedRequest<RC>[] {
    return [...this._queue];
  }

  public enqueue<R>(config: RC, dispatchFn: TQueueDispatchFn<RC, R>): Promise<R> {
    return new Promise<R>((resolve, reject) => {

      config = this._assignUid(config);

      const queued: IQueuedRequest<RC, R> = {
        config, dispatchFn, resolve, reject
      };

      if (config.skipQueue === true) {
        const { dispatched, retryIn } = this._tryDispatchRequest(queued);
        if (!dispatched) throw (
          retryIn ?
            new QueueRetryInError(retryIn)
            :
            new QueueMaxConcurrentRequestsError(this._options.maxConcurrentRequests)
        );
      } else {
        if (this._queue.length >= this._options.maxQueueSize) {
          return reject(new QueueSizeExceededError(this._options.maxQueueSize));
        }

        this._queue.push(queued);
        this._tick();
      }
    });
  }

  public flush(): void {
    for (const queued of this._queue) queued.reject(new QueueCanceledError());
    this._queue = [];
  }

  protected _tick(): void {
    if (this._tickRunning === true) return;
    if (this._queue.length === 0) return;
    if (this._maxConcurrentRequestsExceeded() === true) return;
    this._tickRunning = true;


    let retryTimeout: number | undefined;

    let removed = 0;
    for (const [i, queued] of [...this._queue].entries()) {
      const { config, reject } = queued;

      if (config.maxQueueUntil && Date.now() > config.maxQueueUntil.getTime()) {
        this._queue.splice(i-removed, 1);
        removed++;
        reject(new QueueTimeoutError(config.maxQueueUntil));
        continue;
      }

      const { dispatched, retryIn } = this._tryDispatchRequest(queued);

      if (dispatched) {
        this._queue.splice(i-removed, 1);
        removed++;
        if (this._maxConcurrentRequestsExceeded() === true) break;
      } else if (retryIn && (!retryTimeout || retryIn < retryTimeout)) {
        retryTimeout = retryIn;
      }
    }

    if (retryTimeout && retryTimeout > 0) {
      this._retryTimeout.backoff(retryTimeout);
    }

    if (
      this._retryTimeout.elapsed === true
      &&
      !this._maxConcurrentRequestsExceeded()
    ) {
      setImmediate(this._tick.bind(this));
    }

    this._tickRunning = false;
  }

  protected _tryDispatchRequest(queued: IQueuedRequest<RC>): {
    dispatched: boolean,
    retryIn?: number
  } {
    let shouldDispatch = false;
    let retryIn: number | undefined;

    if (!this._maxConcurrentRequestsExceeded()) {
      const { config } = queued;

      retryIn = this._limiter.mayDispatchRequest(config);
      shouldDispatch = retryIn === 0;
    }

    if (shouldDispatch) {
      this._dispatchRequest(queued);
    }

    return {
      dispatched: shouldDispatch,
      retryIn,
    };
  }

  protected async _dispatchRequest(queued: IQueuedRequest<RC>): Promise<void> {
    const { config, dispatchFn, resolve, reject } = queued;
    let res: IResponse = {};

    try {
      this._concurrentRequests++;
      const { response, data } = await dispatchFn(config);
      res = response;
      resolve(data);
    } catch(err) {
      res = this._parserErrorResponse(err);
      reject(err);
    } finally {
      this._limiter.completeRequest(res, config);
      this._concurrentRequests--;
      this._tick();
    }
  }

  protected _maxConcurrentRequestsExceeded(): boolean {
    return this._concurrentRequests >= this._options.maxConcurrentRequests;
  }

  protected _assignUid(
    config: RC,
  ): RC {
    const newConfig = { ...config }
    if (newConfig.uid) return newConfig;

    const apiKey = getHeaderValue('x-mbx-apikey', newConfig.headers);

    if (!apiKey) return newConfig;

    let alias = this._keyAliases.get(apiKey);

    if (!alias) {
      alias = createHash('sha1').update(apiKey).digest('hex');
      this._keyAliases.set(apiKey, alias);
    }

    newConfig.uid = alias;
    return newConfig;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _parserErrorResponse(err: any): IResponse {
    if (this._options.errorResponseParser) {
      return this._options.errorResponseParser(err);
    }

    const response: IResponse = {};

    if (
      Object.hasOwnProperty.call(err, 'isAxiosError')
      &&
      err.isAxiosError === true
      &&
      Object.hasOwnProperty.call(err, 'response')
    ) {
      const { response: axiosResponse } = err;
      response.statusCode = axiosResponse.status;
      response.headers = axiosResponse.headers;
    }

    return response;
  }
}
