import { EventEmitter } from 'events';

import {
  EBinanceRateLimitType,
  ETrackingType,
  IBinanceRateLimitRule,
  IRequest,
  IResponse,
  ILimitConfig,
  TLimitConfigs,
  TMapedLimitRules,
  TMethod,
  TRequestParams,
  TResponseHeaders,
  TSafetyBuffers,
} from '../types';

import { RetryTimeout, LimitConverter, getHeaderValue } from '../utils/index';
import { AbstractCounter, counterFactory } from '../counters/index';

export abstract class AbstractLimiter extends EventEmitter {
  protected _counters: Map<string, AbstractCounter> = new Map();
  protected _retryTimeout: RetryTimeout = new RetryTimeout();
  protected _safetyBuffers: TSafetyBuffers = {};
  protected abstract _mapedLimitRules: TMapedLimitRules;
  protected abstract _config: TLimitConfigs;

  public get currentUsage(): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const [id, counter] of this._counters) {
      usage[id] = counter.currentUsage;
    }

    return usage;
  }

  public getUsage(timestamp: number): Record<string, number> {
    const usage: Record<string, number> = {};

    for (const [id, counter] of this._counters) {
      usage[id] = counter.getUsage(timestamp);
    }

    return usage;
  }

  public setRateLimitRules(limits: IBinanceRateLimitRule[]): void {
    this._mapedLimitRules = new Map();

    for (const limit of limits) {
      if (this._config.has(limit.rateLimitType)) {
        const rules = this._mapedLimitRules.get(limit.rateLimitType) || [];
        rules.push(limit);

        this._mapedLimitRules.set(limit.rateLimitType, rules);
      }
    }
  }

  public setSafetyBuffers(buffers: TSafetyBuffers): void {
    for (const counter of this._counters.values()) {
      const buffer = buffers[counter.rateLimitType];
      if (buffer) {
        counter.setSafetyBuffer(buffer);
      }
    }

    this._safetyBuffers = buffers;
  }

  public mayDispatchRequest({ method, endpoint, params = {}, uid = '' }: IRequest): number {
    let dispatchIn = this._retryTimeout.retryAfterMs;
    let counters: ReturnType<typeof this._requestCounters>;

    endpoint = this._normalizeEndpoint(endpoint);

    counters = this._requestCounters(method, endpoint, params, uid);
    for (const { counter, weight } of counters) {
      const t = counter.mayDispatchRequest(weight);
      if (t > dispatchIn) dispatchIn = t;
    }

    if (dispatchIn > 0) return dispatchIn;

    counters = this._requestCounters(method, endpoint, params, uid);
    for (const { counter, weight } of counters) {
      counter.dispatchRequest(weight);
    }

    return 0;
  }

  public completeRequest(
    { statusCode, headers }: IResponse,
    { method, endpoint, params = {}, uid = '' }: IRequest
  ): void {
    endpoint = this._normalizeEndpoint(endpoint);

    // update usage from headers
    const counters = this._requestCounters(method, endpoint, params, uid);
    for (const { counter, config, rule, weight } of counters) {
      counter.completeRequest(
        this._getServerHeaderDate(headers),
        this._getUsageFromHeaders(rule, headers, config.headerNameTemplate),
        weight
      );
    }

    if (!statusCode || !headers) return;

    // if statusCode is 419 || 429, but no retry-after header is set it must be
    // an ORDERS limit, which is handled by counters already
    if ([418, 429].includes(statusCode) && headers['retry-after']) {
      // 418: ip has failed to back off after a 418 and has been banned
      // 429: ip exceeded a rate limit.
      const retryIn = Number(headers['retry-after']) * 1e3;
      this._retryTimeout.once('elapsed', () => {
        this.emit('retry-elapsed');
      });
      this.emit('retry-in', retryIn);
      this._retryTimeout.backoff(retryIn);
    }
  }

  protected *_requestCounters(
    method: TMethod,
    endpoint: string,
    params: TRequestParams = {},
    uid: string
  ): IterableIterator<{
    counter: AbstractCounter,
    rule: IBinanceRateLimitRule,
    config: ILimitConfig,
    weight: number,
    type: EBinanceRateLimitType,
  }> {
    const rules = this._requestRules(method, endpoint, params);
    for (const { rule , config, type, weight } of rules) {
      const counter = this._getCounter(rule, uid);
      yield { rule , config, type, weight, counter };
    }
  }

  protected *_requestRules(
    method: TMethod,
    endpoint: string,
    params: TRequestParams = {}
  ): IterableIterator<{
    rule: IBinanceRateLimitRule,
    config: ILimitConfig,
    type: EBinanceRateLimitType,
    weight: number,
  }> {
    for (const [type, config] of this._config) {
      const weight = this._getEndpointWeight(config, method, endpoint, params);
      if (weight !== null) {
        const rules = this._mapedLimitRules.get(type);

        /* istanbul ignore next */
        if (!rules) continue;

        for (const rule of rules) yield { rule, config, type, weight };
      }
    }
  }

  protected _getCounterKey(limit: IBinanceRateLimitRule, uid: string): string {
    const trackingType = this._config.get(limit.rateLimitType)?.trackingType;

    if (trackingType === ETrackingType.UID) {
      return `${limit.rateLimitType}.${LimitConverter.asString(limit)}.${uid}`;
    }

    return `${limit.rateLimitType}.${LimitConverter.asString(limit)}`;
  }

  protected _getCounter(limit: IBinanceRateLimitRule, uid: string): AbstractCounter {
    const key = this._getCounterKey(limit, uid);

    let counter = this._counters.get(key);

    if (!counter) {
      const buffer = this._safetyBuffers[limit.rateLimitType];
      counter = counterFactory(limit, buffer || 0);
      this._counters.set(key, counter);
    }

    return counter;
  }

  protected _getServerHeaderDate(headers?: TResponseHeaders): number | undefined {
    if (headers?.date) return Date.parse(headers.date);
  }

  protected _getUsageFromHeaders(
    rule: IBinanceRateLimitRule,
    headers?: TResponseHeaders,
    headerNameTemplate?: string
  ): number | undefined {
    if (headerNameTemplate && headers) {
      const headerName = headerNameTemplate.replace(
        '%(interval)',
        LimitConverter.asString(rule)
      );

      const value = getHeaderValue(headerName, headers);
      if (value) return Number(value);
    }
  }

  protected _normalizeEndpoint(endpoint: string): string {
    return endpoint.replace(/^\/?/, '/').replace(/\/$/, '');
  }

  protected _getEndpointWeight(
    config: ILimitConfig,
    method: TMethod,
    endpoint: string,
    params: TRequestParams = {}
  ): number | null {
    let weight: number;

    const methodEndpoints = config.endpoints[method] || config.endpoints['*'];
    const weightConfig = (
      methodEndpoints
      &&
      (methodEndpoints[endpoint] || methodEndpoints['*'])
    );

    switch (typeof weightConfig) {
      case 'undefined':
        return null;
      case 'function':
        weight = weightConfig(params);
      break;
      case 'number':
        weight = weightConfig;
      break;
      /* istanbul ignore next */
      default:
        weight = Number(weightConfig);
    }

    /* istanbul ignore next */
    if (isNaN(weight)) {
      throw new TypeError(`Invalid endpoint config for '${method} ${endpoint}'`);
    }

    return weight;
  }
}
