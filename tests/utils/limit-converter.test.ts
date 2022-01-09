import {
  EBinanceRateLimitType,
  EBinanceRateLimitInterval,
  IBinanceRateLimitRule,
  LimitConverter,
} from '../../src/index';

describe('LimitConverter', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:00:00.000Z').getTime());
  });

  describe('msUntilNextWindow', () => {
    it('allows to pass a rule', () => {
      const rule: IBinanceRateLimitRule = {
        rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
        interval: EBinanceRateLimitInterval.MINUTE,
        intervalNum: 1,
        limit: 1000,
      };

      const result = LimitConverter.msUntilNextWindow(rule);
      expect(result).toEqual(60e3);
    });

    it('allows to pass a timestamp', () => {
      const rule: IBinanceRateLimitRule = {
        rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
        interval: EBinanceRateLimitInterval.MINUTE,
        intervalNum: 1,
        limit: 1000,
      };

      const result = LimitConverter.msUntilNextWindow(rule, 30e3);
      expect(result).toEqual(30e3);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
