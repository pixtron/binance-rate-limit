import {
  AbstractLimiter,
  EBinanceRateLimitType,
  IRequest,
  IResponse,
} from '../../src/index';

import { limitConfigs, mapedRateLimits, exchangeInfoRateLimit } from './mock-config';

class LimiterImplementation extends AbstractLimiter {
  protected _mapedLimitRules = mapedRateLimits;
  protected _config = limitConfigs;
}

describe('AbstractCounter', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:00:00.000Z').getTime());
  });

  describe('normalize endpoints', () => {
    it('accepts endpoints without leading slash', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: 'api/v3/ticker/24hr' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '40',
      } };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(60e3);

      limiter.completeRequest(res, req);

      expect(limiter.currentUsage).toEqual({
        'RAW_REQUESTS.5m': 1,
        'REQUEST_WEIGHT.1m': 40,
      });
    });

    it('accepts endpoints with trailing slash', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr/' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '40',
      } };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(60e3);

      limiter.completeRequest(res, req);

      expect(limiter.currentUsage).toEqual({
        'RAW_REQUESTS.5m': 1,
        'REQUEST_WEIGHT.1m': 40,
      });
    });
  });

  describe('REQUEST_WEIGHT', () => {
    it('allows a request when it does not violate rate limit', () => {
      const limiter = new LimiterImplementation();
      const req1: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      const req2: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req1);
      expect(retryIn).toEqual(0);

      retryIn = limiter.mayDispatchRequest(req2);
      expect(retryIn).toEqual(0);
    });

    it('returns correct retryIn when request violates rate limit', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(60e3);
    });

    it('allows request after rate limit window resets', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '40',
      } };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      limiter.completeRequest(res, req);

      jest.advanceTimersByTime(60e3);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('resets pending weight if request recieves an empty response', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      const res: IResponse = {};
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      limiter.completeRequest(res, req);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('blocks all further requests when server sends 418 and a retry-after', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      const res: IResponse = { statusCode: 418, headers: { 'retry-after': '4' } };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);

      limiter.completeRequest(res, req);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(4001);

      jest.advanceTimersByTime(2000);
      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(2001);

      jest.advanceTimersByTime(2001);
      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('only emits retry-elapsed once when server sent 418 and a retry-after twice', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/ticker/24hr' };
      const res: IResponse = { statusCode: 418, headers: { 'retry-after': '4' } };
      const listener = jest.fn(() => {});
      let retryIn: number;

      limiter.on('retry-elapsed', listener);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);

      limiter.completeRequest(res, req);
      limiter.completeRequest(res, req);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(4001);

      jest.advanceTimersByTime(4001);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('ORDERS', () => {
    it('allows a request when it does not violate rate limit', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('returns correct retryIn when request violates rate limit', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      let i: number;

      for (i = 0; i < 10; i++) {
        // 10 order weights per uid allowed
        limiter.mayDispatchRequest(req);
      }

      const retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(10e3);
    });

    it('checks weight for each uid', () => {
      const limiter = new LimiterImplementation();
      const req1: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const req2: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'b' };
      let i: number;
      let retryIn: number;

      for (i = 0; i < 10; i++) {
        // 10 order weights per uid allowed
        retryIn = limiter.mayDispatchRequest(req1);
        expect(retryIn).toEqual(0);
      }

      retryIn = limiter.mayDispatchRequest(req1);
      expect(retryIn).toEqual(10e3);

      retryIn = limiter.mayDispatchRequest(req2);
      expect(retryIn).toEqual(0);
    });

    it('allows request after rate limit window resets', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-order-count-10s': '10',
      } };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
      limiter.completeRequest(res, req);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(10e3);

      jest.advanceTimersByTime(10e3);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('resets pending weight if request recieves an empty response', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const res: IResponse = {};
      let i: number;
      let retryIn: number;

      for (i = 0; i < 10; i++) {
        // 10 order weights per uid allowed
        retryIn = limiter.mayDispatchRequest(req);
        expect(retryIn).toEqual(0);
      }

      limiter.completeRequest(res, req);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });
  });

  describe('RAW_REQUESTS', () => {
    it('allows a request when it does not violate rate limit', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      const retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });

    it('returns correct retryIn when request violates rate limit', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '40',
      } };
      let retryIn: number;
      let i: number;

      for (i = 0; i < 4; i++) {
        let j: number;
        for (j = 0; j < 5; j++) {
          retryIn = limiter.mayDispatchRequest(req);
          expect(retryIn).toEqual(0);

          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          res.headers!['x-mbx-used-weight-1m'] = (j + 1) * 10 + '';
          limiter.completeRequest(res, req);
        }

        jest.advanceTimersByTime(60e3);
      }

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(60e3);

      jest.advanceTimersByTime(retryIn);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);
    });
  });

  describe('currentUsage', () => {
    it('returns the current usage', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '10',
        'x-mbx-order-count-10s': '3',
        'x-mbx-order-count-1m': '5',
      } };

      limiter.mayDispatchRequest(req);
      limiter.completeRequest(res, req);

      expect(limiter.currentUsage).toEqual({
        'RAW_REQUESTS.5m': 1,
        'REQUEST_WEIGHT.1m': 10,
        'ORDERS.10s.a': 3,
        'ORDERS.1m.a': 5,
      });
    });
  });

  describe('getUsage', () => {
    it('returns the usage of a given window', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '10',
        'x-mbx-order-count-10s': '3',
        'x-mbx-order-count-1m': '5',
      } };

      limiter.mayDispatchRequest(req);
      limiter.completeRequest(res, req);

      jest.advanceTimersByTime(60e3);

      expect(limiter.currentUsage).toEqual({
        'RAW_REQUESTS.5m': 1,
        'REQUEST_WEIGHT.1m': 0,
        'ORDERS.10s.a': 0,
        'ORDERS.1m.a': 0,
      });

      expect(limiter.getUsage(1)).toEqual({
        'RAW_REQUESTS.5m': 1,
        'REQUEST_WEIGHT.1m': 10,
        'ORDERS.10s.a': 3,
        'ORDERS.1m.a': 5,
      });
    });
  });

  describe('setRateLimitRules', () => {
    it('changes the rules', () => {
      const limiter = new LimiterImplementation();
      limiter.setRateLimitRules(exchangeInfoRateLimit);

      const req: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(10e3);
    });
  });

  describe('setSafetyBuffer', () => {
    it('respects REQUEST_WEIGHT safetyBuffer', () => {
      const limiter = new LimiterImplementation();
      limiter.setSafetyBuffers({ [EBinanceRateLimitType.REQUEST_WEIGHT]: 35 });

      const req: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      let retryIn: number;

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(0);

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(60e3);
    });

    it('respects ORDERS safetyBuffer', () => {
      const limiter = new LimiterImplementation();
      limiter.setSafetyBuffers({ [EBinanceRateLimitType.ORDERS]: 5 });

      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      let i: number;
      let retryIn: number;

      for (i = 0; i < 5; i++) {
        // 5 order weights per uid allowed
        retryIn = limiter.mayDispatchRequest(req);
        expect(retryIn).toEqual(0);
      }

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(10e3);
    });

    it('respects RAW_REQUESTS safetyBuffer', () => {
      const limiter = new LimiterImplementation();
      limiter.setSafetyBuffers({ [EBinanceRateLimitType.RAW_REQUESTS]: 16 });

      const req: IRequest = { method: 'GET', endpoint: '/api/v3/exchangeInfo' };
      const res: IResponse = { statusCode: 200, headers: {
        date: 'Thu, 01 Jan 1970 00:00:01 GMT',
        'x-mbx-used-weight-1m': '40',
      } };
      let i: number;
      let retryIn: number;

      for (i = 0; i < 4; i++) {
        retryIn = limiter.mayDispatchRequest(req);
        expect(retryIn).toEqual(0);

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        res.headers!['x-mbx-used-weight-1m'] = (i + 1) * 10 + '';
        limiter.completeRequest(res, req);
      }

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(5 * 60e3);
    });

    it('updates existing counters', () => {
      const limiter = new LimiterImplementation();
      const req: IRequest = { method: 'POST', endpoint: '/api/v3/order', uid: 'a' };
      let i: number;
      let retryIn: number;

      for (i = 0; i < 5; i++) {
        // 5 order weights per uid allowed
        retryIn = limiter.mayDispatchRequest(req);
        expect(retryIn).toEqual(0);
      }

      limiter.setSafetyBuffers({ [EBinanceRateLimitType.ORDERS]: 5 });

      retryIn = limiter.mayDispatchRequest(req);
      expect(retryIn).toEqual(10e3);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
