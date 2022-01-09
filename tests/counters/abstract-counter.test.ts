import {
  EBinanceRateLimitType,
  EBinanceRateLimitInterval,
  IBinanceRateLimitRule,
  AbstractCounter,
} from '../../src/index';

class CounterImplementation extends AbstractCounter {
  mayDispatchRequest(): number {
    return 0;
  }

  dispatchRequest(usage: number): void {
    const windowId = this._getWindow(Date.now());
    const usedAfter = this._getUsageAfterRequest(windowId, usage);
    this._usage.set(windowId, usedAfter);
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  completeRequest(): void {}
}

const defaultRule: IBinanceRateLimitRule = {
  rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
  interval: EBinanceRateLimitInterval.MINUTE,
  intervalNum: 1,
  limit: 1000,
};

describe('AbstractCounter', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:00:00.000Z').getTime());

    jest.spyOn(global, 'setInterval');
  });

  describe('garbage collector', () => {
    it('collects garbage after 10 * rule interval', () => {

      const counter = new CounterImplementation(defaultRule, 0);
      const interval = 60e3;

      expect(setInterval).toHaveBeenCalledTimes(1);
      expect(setInterval).toHaveBeenLastCalledWith(expect.any(Function), interval * 10);

      let i: number;
      for (i = 1; i <= 10; i++) {
        counter.dispatchRequest(i);
        expect(counter.currentUsage).toEqual(i);
        if (i < 10) jest.advanceTimersByTime(counter.msToNextInterval);
      }

      for (i = 0; i < 10; i++) {
        const ts = i * interval;
        const usage = counter.getUsage(ts);
        expect(usage).toEqual(i + 1);
      }

      jest.advanceTimersByTime(counter.msToNextInterval); // gc will be triggered
      counter.dispatchRequest(11);
      expect(counter.currentUsage).toEqual(11);

      for (i = 0; i <= 10; i++) {
        const ts = i * interval;
        const usage = counter.getUsage(ts);
        const expected = i < 9 ? 0 : i + 1;
        expect(usage).toEqual(expected);
      }
    });
  });

  describe('nextWindowStart', () => {
    it('returns a date when the next window starts', () => {
      const counter = new CounterImplementation(defaultRule, 0);

      expect(counter.nextWindowStart).toBeInstanceOf(Date);
      expect(counter.nextWindowStart.getTime()).toEqual(60e3);

      jest.advanceTimersByTime(61e3);

      expect(counter.nextWindowStart.getTime()).toEqual(120e3);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
