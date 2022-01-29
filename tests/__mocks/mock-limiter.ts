import { AbstractLimiter } from '../../src/index';
import { limitConfigs, mapedRateLimits } from './mock-config';

export class LimiterImplementation extends AbstractLimiter {
  protected _mapedLimitRules = mapedRateLimits;
  protected _config = limitConfigs;
}
