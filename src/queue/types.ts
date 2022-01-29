import { IRequest, IResponse, TRequestHeaders } from '../types';

export interface IQueueOptions {
  maxConcurrentRequests: number;
  maxQueueSize: number;
  errorResponseParser?: (err: unknown) => IResponse,
}

export interface IQueueRequestConfig extends IRequest {
  headers?: TRequestHeaders,
  skipQueue?: boolean, // if true request will skip queue, will throw immediately if rate limit or maxConcurrentRequests is exceeded
  maxQueueUntil?: Date, // max Date until when to queued the request
}

export interface IQueuedRequest<
  RC extends IQueueRequestConfig = IQueueRequestConfig,
  R = any, // eslint-disable-line @typescript-eslint/no-explicit-any
> {
  config: RC,
  dispatchFn: TQueueDispatchFn<RC, R>,
  resolve: (response: R) => void,
  reject: (err: unknown) => void
}

export type TQueueDispatchFn<
  RC extends IQueueRequestConfig = IQueueRequestConfig,
  R = any, // eslint-disable-line @typescript-eslint/no-explicit-any
> = (config: RC) => Promise<{
  response: IResponse,
  data: R,
}>
