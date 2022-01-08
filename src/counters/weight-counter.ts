import { AbstractCounter } from './abstract-counter';

export class WeightCounter extends AbstractCounter {
  protected _pendingUsage = 0; // usage currently pending in requests

  public mayDispatchRequest(usage = 1): number {
    const windowId = this._getWindow(Date.now());
    const usedAfter = this._getUsageAfterRequest(windowId, usage);

    return usedAfter <= this._limit ? 0 : this.msToNextInterval;
  }

  public dispatchRequest(usage: number): void {
    this._pendingUsage += usage;
  }

  public completeRequest(serverDate?: number, serverUsage?: number, usage = 1): void {
    this._pendingUsage -= usage;

    if (!serverDate || !serverUsage) return;

    const serverWindow = this._getWindow(serverDate);
    const currentUsage = this._getUsage(serverWindow);

    // responses might get returned out of order, always track the highest value
    if (serverUsage > currentUsage ) this._usage.set(serverWindow, serverUsage);
  }

  protected _getUsageAfterRequest(windowId: number, usage: number): number {
    return super._getUsageAfterRequest(windowId, this._pendingUsage + usage);
  }
}
