import { EBinanceRateLimitType, IBinanceRateLimitRule } from '../types';
import { LimitConverter } from '../utils/limit-converter';

export abstract class AbstractCounter {
  protected _rule: IBinanceRateLimitRule;
  protected _limit: number;
  protected _interval: number;
  protected _usage: Map<number, number> = new Map();

  constructor(rule: IBinanceRateLimitRule, safetyBuffer: number) {
    this._rule = rule;
    this._limit = rule.limit - safetyBuffer;
    this._interval = LimitConverter.asMilliseconds(rule);

    const interval = setInterval(() => {
      this._collectGarbage();
    }, this._interval * 10);
    interval.unref();
  }

  public get rateLimitType(): EBinanceRateLimitType {
    return this._rule.rateLimitType;
  }

  public get currentUsage(): number {
    return this._getUsage(this._getWindow(Date.now()));
  }

  public get msToNextInterval(): number {
    return LimitConverter.msUntilNextWindow(this._interval);
  }

  public get nextWindowStart(): Date {
    return LimitConverter.nextWindowStart(this._interval);
  }

  public getUsage(timestamp: number): number {
    return this._getUsage(this._getWindow(timestamp));
  }

  public setSafetyBuffer(buffer: number) {
    this._limit = this._rule.limit - buffer;
  }

  /**
   * Check if the given request weight might be dispatched in current window.
   * The implementation of this method should not change the internal
   * usage counter.
   */
  public abstract mayDispatchRequest(usage: number): number;

  /**
   * Dispatch the request
   * The implementation of this method should change the internal usage counter.
   */
  public abstract dispatchRequest(usage: number): void;

  /**
   * Update the counter after request completed or errored
   */
  public abstract completeRequest(usage?: number, serverDate?: number, serverUsage?: number): void;

  protected _collectGarbage(): void {
    const previousWindow = this._getWindow(Date.now()) - 1;
    for (const key of this._usage.keys()) {
      if (key < previousWindow) this._usage.delete(key);
    }
  }

  protected _getWindow(timestamp: number): number {
    return Math.floor(timestamp / this._interval);
  }

  protected _getUsage(windowId: number): number {
    return (this._usage.get(windowId) || 0)
  }

  protected _getUsageAfterRequest(windowId: number, usage: number): number {
    return this._getUsage(windowId) + usage;
  }
}
