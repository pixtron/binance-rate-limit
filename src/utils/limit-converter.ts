import {
  EBinanceRateLimitInterval,
  IBinanceRateLimitRule,
} from '../types';

export class LimitConverter {
  static asString(limit: IBinanceRateLimitRule): string {
    let letter: string;
    switch(limit.interval) {
      case EBinanceRateLimitInterval.SECOND:
        letter = 's';
      break;
      case EBinanceRateLimitInterval.MINUTE:
        letter = 'm';
      break;
      case EBinanceRateLimitInterval.DAY:
        letter = 'd';
      break;
    }

    return `${limit.intervalNum}${letter}`;
  }

  static asSeconds(limit: IBinanceRateLimitRule): number {
    let interval: number;
    switch(limit.interval) {
      case EBinanceRateLimitInterval.SECOND:
        interval = 1;
      break;
      case EBinanceRateLimitInterval.MINUTE:
        interval = 60;
      break;
      case EBinanceRateLimitInterval.DAY:
        interval = 86400;
      break;
    }

    return limit.intervalNum * interval;
  }

  static asMilliseconds(limit: IBinanceRateLimitRule): number {
    return LimitConverter.asSeconds(limit) * 1e3;
  }

  static msUntilNextWindow(
    value: IBinanceRateLimitRule | number,
    now?: number
  ): number {
    let interval: number;
    if (typeof value === 'number') {
      interval = value;
    } else {
      interval = LimitConverter.asMilliseconds(value);
    }

    if (now === undefined) now = Date.now();

    return interval - (now % interval);
  }

  static nextWindowStart(value: IBinanceRateLimitRule | number): Date {
    const now = Date.now();
    return new Date(now + LimitConverter.msUntilNextWindow(value, now));
  }
}
