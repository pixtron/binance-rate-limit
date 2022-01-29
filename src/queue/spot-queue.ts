
import { AbstractQueue } from './abstract-queue';
import { IQueueOptions, IQueueRequestConfig } from './types';
import { createSpotLimiter } from '../limiters/spot-limiter';

export class SpotQueue<
  RC extends IQueueRequestConfig
> extends AbstractQueue<
  RC,
  ReturnType<typeof createSpotLimiter>
> {
  /* istanbul ignore next */
  constructor(options: Partial<IQueueOptions> = {}) {
    super(createSpotLimiter, options);
  }
}
