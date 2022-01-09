import {
  EBinanceRateLimitType,
  EBinanceRateLimitInterval,
  IBinanceRateLimitRule,
  WeightCounter
} from '../../src/index';

const createCounter = (buffer: number = 0, rule?: IBinanceRateLimitRule): WeightCounter => {
  if (!rule) {
    rule = {
      rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
      interval: EBinanceRateLimitInterval.MINUTE,
      intervalNum: 1,
      limit: 1000,
    }
  }

  return new WeightCounter(rule, buffer);
}

describe('WeightCounter', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('2022-01-01T00:01:00.000Z').getTime());
  });

  describe('getters', () => {
    // TODO pixtron - do we still need this test?
    it('exposes the rate limit type', () => {
      const counter = createCounter();
      expect(counter.rateLimitType).toEqual(EBinanceRateLimitType.REQUEST_WEIGHT);
    });


  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
