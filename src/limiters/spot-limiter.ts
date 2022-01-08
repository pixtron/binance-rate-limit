import { AbstractLimiter } from './index';

import { limitConfigs, mapedRateLimits } from '../config/spot';

class SpotLimiter extends AbstractLimiter {
  private static _instance: SpotLimiter;

  protected _mapedLimitRules = mapedRateLimits;
  protected _config = limitConfigs;

  private constructor() {
    super();
  }

  public static getInstance(): SpotLimiter {
    return this._instance || (this._instance = new SpotLimiter());
  }
}

export const createSpotLimiter = (): SpotLimiter => {
  return SpotLimiter.getInstance();
}
