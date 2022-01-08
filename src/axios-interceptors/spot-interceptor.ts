import { AxiosInstance } from 'axios';
import { AbstractAxiosInterceptor } from './index';

import { createSpotLimiter } from '../limiters/spot-limiter';
import { IAxiosInterceptorOptions } from '../types';

type TSpotLimiter = ReturnType<typeof createSpotLimiter>;

export class SpotAxiosInterceptor extends AbstractAxiosInterceptor<TSpotLimiter> {
  protected _limiter: TSpotLimiter;

  constructor(
    protected _axios: AxiosInstance,
    options: Partial<IAxiosInterceptorOptions> = {},
    limiter?: TSpotLimiter
  ) {
    super(_axios, options);
    this._limiter = limiter || createSpotLimiter();
  }
}
