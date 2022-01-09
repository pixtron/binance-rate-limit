import {
  createSpotLimiter,
  IRequest,
  IResponse,
} from '../../src/index';

describe('createSpotLimiter', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:00:00.000Z').getTime());
  });

  it('returns a singleton', () => {
    const limiter = createSpotLimiter();
    const limiter2 = createSpotLimiter();
    const req: IRequest = {method: 'POST', endpoint: '/api/v3/order', uid: 'a'};
    const res: IResponse = {statusCode: 200, headers: {
      date: 'Thu, 01 Jan 1970 00:00:01 GMT',
      'x-mbx-used-weight-1m': '10',
      'x-mbx-order-count-10s': '3',
      'x-mbx-order-count-1m': '5',
    }};

    limiter.mayDispatchRequest(req);
    limiter.completeRequest(res, req);

    expect(limiter.currentUsage).toEqual(limiter2.currentUsage);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
