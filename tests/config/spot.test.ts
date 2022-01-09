import { requestWeights } from '../../src/config/spot';
import { TMethod, TWeightConfig } from '../../src/index';

const getWeightFn = (method: TMethod, endpoint: string): TWeightConfig | undefined => {
  const methodConfig = requestWeights[method];

  if (methodConfig) return methodConfig[endpoint];
}

describe('requestWeights', () => {
  describe('/api/v3/depth', () => {
    it('calculates the correct weights', () => {
      const fn = getWeightFn('GET', '/api/v3/depth')

      expect(typeof fn).toEqual('function');

      if (typeof fn === 'function') {
        expect(fn({})).toEqual(1);
        expect(fn({ limit: 5 })).toEqual(1);
        expect(fn({ limit: 10 })).toEqual(1);
        expect(fn({ limit: 20 })).toEqual(1);
        expect(fn({ limit: 100 })).toEqual(1);
        expect(fn({ limit: 500 })).toEqual(5);
        expect(fn({ limit: 1000 })).toEqual(10);
        expect(fn({ limit: 5000 })).toEqual(50);
      }
    });
  });

  describe('/api/v3/ticker/24hr', () => {
    it('calculates the correct weights', () => {
      const fn = getWeightFn('GET', '/api/v3/ticker/24hr');

      expect(typeof fn).toEqual('function');

      if (typeof fn === 'function') {
        expect(fn({})).toEqual(40);
        expect(fn({ symbol: 'BTCUSDT' })).toEqual(1);
      }
    });
  });

  describe('/api/v3/ticker/price', () => {
    it('calculates the correct weight', () => {
      const fn = getWeightFn('GET', '/api/v3/ticker/price');

      expect(typeof fn).toEqual('function');

      if (typeof fn === 'function') {
        expect(fn({})).toEqual(2);
        expect(fn({ symbol: 'BTCUSDT' })).toEqual(1);
      }
    });
  });

  describe('/api/v3/ticker/bookTicker', () => {
    it('calculates the correct weight', () => {
      const fn = getWeightFn('GET', '/api/v3/ticker/bookTicker')

      expect(typeof fn).toEqual('function');

      if (typeof fn === 'function') {
        expect(fn({})).toEqual(2);
        expect(fn({ symbol: 'BTCUSDT' })).toEqual(1);
      }
    });
  });

  describe('/api/v3/openOrders', () => {
    it('calculates the correct weight', () => {
      const fn = getWeightFn('GET', '/api/v3/openOrders')

      expect(typeof fn).toEqual('function');

      if (typeof fn === 'function') {
        expect(fn({})).toEqual(40);
        expect(fn({ symbol: 'BTCUSDT' })).toEqual(3);
      }
    });
  });

});
