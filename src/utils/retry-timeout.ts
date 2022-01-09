import { EventEmitter } from 'events';

export class RetryTimeout extends EventEmitter {
  protected _timer: NodeJS.Timeout | null = null;
  protected _ends: Date = new Date(Date.now() - 1);
  protected _active = false;

  constructor(protected lowest = false) {
    super();
  }

  public get elapsed(): boolean {
    return !this._active;
  }

  public get retryAfterMs(): number {
    return Math.max(this._ends.getTime() - Date.now() + 1, 0);
  }

  public get retryAfter(): Date {
    return new Date(this._ends.getTime() + 1);
  }

  public reset(): void {
    this._clearTimer();
    this._active = false;
    this._ends = new Date(Date.now() - 1);
  }

  public backoff(until: Date | number): void {
    if (typeof until === 'number') until = new Date(Date.now() + until);

    if (this._active === false && until < new Date()) {
      return this._triggerElapsed();
    }

    if (
      this._active === false
      ||
      (!this.lowest && until > this._ends)
      ||
      (this.lowest && (until < this._ends))
    ) {
      this._active = true;
      this._ends = until;

      this._clearTimer();

      const t = until.getTime() - Date.now();

      if (t >= 1) {
        this._timer = setTimeout(this._triggerElapsed.bind(this), t);
        this._timer.unref();
      } else {
        this._triggerElapsed();
      }
    }
  }

  protected _triggerElapsed(): void {
    this._active = false;
    this.emit('elapsed');
    this._clearTimer();
  }

  protected _clearTimer(): void {
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
}
