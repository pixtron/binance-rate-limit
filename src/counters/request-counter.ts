import { AbstractCounter } from './abstract-counter';

export class RequestCounter extends AbstractCounter {
  public mayDispatchRequest(): number {
    const windowId = this._getWindow(Date.now());
    const usedAfter = this._getUsageAfterRequest(windowId, 1);

    return usedAfter <= this._limit ? 0 : this.msToNextInterval;
  }

  public dispatchRequest(): void {
    const windowId = this._getWindow(Date.now());
    const usedAfter = this._getUsageAfterRequest(windowId, 1);

    this._usage.set(windowId, usedAfter);
  }

  public completeRequest(): void {
    // nothing to do here
  }
}
