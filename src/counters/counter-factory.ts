import { EBinanceRateLimitType, IBinanceRateLimitRule } from '../types';

import { AbstractCounter, RequestCounter, WeightCounter } from './index';

export const counterFactory = function(
  limit: IBinanceRateLimitRule,
  safetyBuffer: number
): AbstractCounter {
  switch (limit.rateLimitType) {
    case EBinanceRateLimitType.REQUEST_WEIGHT:
    case EBinanceRateLimitType.ORDERS:
      return new WeightCounter(limit, safetyBuffer);
    case EBinanceRateLimitType.RAW_REQUESTS:
      return new RequestCounter(limit, safetyBuffer);
  }
}
