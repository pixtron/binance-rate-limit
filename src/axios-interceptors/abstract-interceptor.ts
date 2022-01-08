import { URLSearchParams } from 'url';
import { createHash } from 'crypto';

import {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
} from 'axios';

import {
  IAxiosInterceptorOptions,
  IRequest,
  IResponse,
  TMethod,
} from '../types';

import { QueueError } from './queue-error';
import { AbstractLimiter } from '../limiters/index';
import { RetryTimeout, getHeaderValue } from '../utils/index';

interface IQueuedRequest {
  config: AxiosRequestConfig,
  resolve: (config: AxiosRequestConfig) => void,
  reject: (err: Error) => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TParams = Record<string, any>;

export abstract class AbstractAxiosInterceptor<L extends AbstractLimiter> {
  protected abstract _limiter: L;

  protected _options: IAxiosInterceptorOptions;

  protected _attached = false;

  protected _concurrentRequests = 0;

  protected _retryElapsedListener: () => void;

  protected _retryTimeout: RetryTimeout = new RetryTimeout(true);

  protected _interceptors: {
    request: number | null,
    response: number | null
  } = {
    request: null,
    response: null,
  }

  protected _queue: IQueuedRequest[] = [];

  protected _keyAliases: Map<string, string> = new Map();

  constructor(
    protected _axios: AxiosInstance,
    options: Partial<IAxiosInterceptorOptions> = {}
  ) {
    this._options = {
      maxConcurrentRequests: 10,
      maxQueueSize: Infinity,
      ...options
    };

    this._retryElapsedListener = () => this._tick();
  }

  public get limiter(): L {
    return this._limiter;
  }

  public attach(): void {
    if (this._attached) return;

    this._concurrentRequests = 0;
    this._attached = true;

    this._limiter.on('retry-elapsed', this._retryElapsedListener);
    this._retryTimeout.on('elapsed', this._retryElapsedListener);

    if (this._interceptors.request === null) {
      this._interceptors.request = this._axios.interceptors.request.use(
        this._requestInterceptor.bind(this)
      );
    }

    if (this._interceptors.response === null) {
      this._interceptors.response = this._axios.interceptors.response.use(
        this._responseInterceptor.bind(this),
        this._errorResponseInterceptor.bind(this),
      );
    }
  }

  public detach(cancel = false): void {
    if (!this._attached) return;

    this._attached = false;

    this._limiter.off('retry-elapsed', this._retryElapsedListener);
    this._retryTimeout.off('elapsed', this._retryElapsedListener);

    if (this._interceptors.request !== null) {
      this._axios.interceptors.request.eject(this._interceptors.request);
      this._interceptors.request = null;
    }

    if (this._interceptors.response !== null) {
      this._axios.interceptors.response.eject(this._interceptors.response);
      this._interceptors.response = null;
    }

    this._flushQueue(cancel);
  }

  protected _tick(): void {
    if (this._attached === false) return;
    if (this._queue.length === 0) return;
    if (this._maxConcurrentRequestsExceeded() === true) return;

    let retryTimeout: number | undefined;

    for (const [i, queued] of this._queue.entries()) {
      const { dispatched, retryIn } = this._tryDispatchRequest(queued);

      if (dispatched) {
        this._queue.splice(i, 1);
        if (this._maxConcurrentRequestsExceeded() === true) break;
      } else if (retryIn && (!retryTimeout || retryIn < retryTimeout)) {
        retryTimeout = retryIn;
      }
    }

    if (retryTimeout && !this._maxConcurrentRequestsExceeded()) {
      this._retryTimeout.backoff(retryTimeout);
    }
  }

  protected _flushQueue(cancel = false): void {
    let queued: IQueuedRequest | undefined;
    while ((queued = this._queue.shift())) {
      const { config, resolve, reject } = queued;

      cancel ? reject(new Error('canceled')) : resolve(config);
    }
  }

  protected _tryDispatchRequest(
    queued: IQueuedRequest
  ): {dispatched: boolean, retryIn?: number} {
    let shouldDispatch = !this._attached;
    let retryIn: number | undefined;

    if (!shouldDispatch && !this._maxConcurrentRequestsExceeded()) {
      const { config } = queued;

      const args = this._axiosConfigToLimiterArgs(config);
      retryIn = this._limiter.mayDispatchRequest(args);

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

  protected _dispatchRequest(queued: IQueuedRequest) {
    const { config, resolve } = queued;

    this._concurrentRequests++;
    resolve(config);
  }

  protected _requestInterceptor(
    config: AxiosRequestConfig
  ): Promise<AxiosRequestConfig> {
    if (this._attached === false) return Promise.resolve(config);

    return new Promise((resolve, reject) => {
      const queued: IQueuedRequest = { config, resolve, reject };

      const { dispatched, retryIn } = this._tryDispatchRequest(queued);
      if (!dispatched) {
        const noQueue = !!getHeaderValue(
          'x-binance-limiter-no-queue',
          config?.headers
        );
        const timestamp = !!config?.params?.timestamp;

        if (noQueue || timestamp) {
          // not sure if it can be schedule in time
          return reject(new QueueError(retryIn));
        }

        if (this._queue.length >= this._options.maxQueueSize) {
          return reject(new QueueError(
            `Queue size of ${this._options.maxQueueSize} exceeded.`
          ));
        }

        if (retryIn) {
          this._retryTimeout.backoff(retryIn);
        }

        // request could not be immediatly dispatched but is queuable
        this._queue.push(queued);
      }
    });
  }

  protected _responseInterceptor(
    response: AxiosResponse
  ): Promise<AxiosResponse> {
    this._done(response.config, response);
    return Promise.resolve(response);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected _errorResponseInterceptor(err: any): Promise<any> {
    this._done(err.config, err.response);
    return Promise.reject(err);
  }

  protected _done(config?: AxiosRequestConfig, response?: AxiosResponse): void {
    if (this._attached === false) return;

    const responseArgs: IResponse = {};

    try {
      if (config) {
        if (response) {
          responseArgs.statusCode = response.status;
          responseArgs.headers = response.headers;
        }

        const requestArgs = this._axiosConfigToLimiterArgs(config);
        this._limiter.completeRequest(responseArgs, requestArgs);
      }
    } finally {
      this._concurrentRequests--;
      this._tick();
    }
  }

  protected _maxConcurrentRequestsExceeded(): boolean {
    return this._concurrentRequests >= this._options.maxConcurrentRequests;
  }

  protected _extractParams(
    params: TParams | URLSearchParams,
    data?: TParams
  ): TParams {
    let result: TParams = {}
    if (params instanceof URLSearchParams)  {
      const result: TParams = {};
      for (const [key, value] of params.entries()) result[key] = value;
    } else {
      result = { ...params };
    }

    if (data) result = { ...result, ...data };

    return result;
  }

  protected _tryGetUidFromRequestHeaders(
    headers?: AxiosRequestHeaders
  ): string | undefined {
    const apiKey = getHeaderValue('x-mx-apikey', headers);

    if (!apiKey) return;

    let alias = this._keyAliases.get(apiKey);

    if (!alias) {
      alias = createHash('sha1').update(apiKey).digest('hex');
      this._keyAliases.set(apiKey, alias);
    }

    return alias;
  }

  protected _axiosConfigToLimiterArgs(config: AxiosRequestConfig): IRequest {
    const { params, data, method, url, headers } = config;

    return {
      method: ((method || 'GET').toUpperCase() as TMethod),
      endpoint: (url || '/'),
      params: this._extractParams(params, data),
      uid: this._tryGetUidFromRequestHeaders(headers)
    };
  }
}
