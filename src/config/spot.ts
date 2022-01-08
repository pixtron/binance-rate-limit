import {
  ETrackingType,
  EBinanceRateLimitInterval,
  EBinanceRateLimitType,
  TLimitConfigs,
  TMapedLimitRules,
  TWeights,
} from '../types';

// maped rate limits from /api/v3/exchangeInfo
export const mapedRateLimits: TMapedLimitRules = new Map([
  [EBinanceRateLimitType.REQUEST_WEIGHT, [{
    rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
    interval: EBinanceRateLimitInterval.MINUTE,
    intervalNum: 1,
    limit: 1200
  }]],
  [EBinanceRateLimitType.ORDERS, [{
    rateLimitType: EBinanceRateLimitType.ORDERS,
    interval: EBinanceRateLimitInterval.SECOND,
    intervalNum: 10,
    limit: 50
  }, {
    rateLimitType: EBinanceRateLimitType.ORDERS,
    interval: EBinanceRateLimitInterval.DAY,
    intervalNum: 1,
    limit: 160000
  }]],
  [EBinanceRateLimitType.RAW_REQUESTS, [{
    rateLimitType: EBinanceRateLimitType.RAW_REQUESTS,
    interval: EBinanceRateLimitInterval.MINUTE,
    intervalNum: 5,
    limit: 6100
  }]]
]);

export const requestWeights: TWeights = {
  'GET': {
    '/api/v3/ping': 1,
    '/api/v3/time': 1,
    '/api/v3/exchangeInfo': 10,
    '/api/v3/depth': (params) => {
      let weight = 1

      switch(Number(params.limit)) {
        case 500:
          weight = 5;
        break;
        case 1000:
          weight = 10;
        break;
        case 5000:
          weight = 50;
        break;
      }

      return weight;
    },
    '/api/v3/trades': 1,
    '/api/v3/historicalTrades': 5,
    '/api/v3/aggTrades': 1,
    '/api/v3/avgPrice': 1,
    '/api/v3/ticker/24hr': (params) => params.symbol ? 1 : 40,
    '/api/v3/ticker/price': (params) => params.symbol ? 1 : 2,
    '/api/v3/ticker/bookTicker': (params) => params.symbol ? 1 : 2,
    '/api/v3/order': 2,
    '/api/v3/openOrders': (params) => params.symbol ? 3 : 40,
    '/api/v3/allOrders': 10,
    '/api/v3/orderList': 2,
    '/api/v3/openOrderList': 3,
    '/api/v3/myTrades': 10,
    '/api/v3/rateLimit/order': 20,
  },
  'POST': {
    '/api/v3/order/test': 1,
    '/api/v3/order': 1,
    '/api/v3/order/oco': 1,
    '/api/v3/userDataStream': 1,
  },
  'PUT': {
    '/api/v3/userDataStream': 1,
  },
  'DELETE': {
    '/api/v3/userDataStream': 1,
    '/api/v3/openOrders': 1,
    '/api/v3/orderList': 1,
  }
}

export const orderWeights: TWeights = {
  'POST': {
    '/api/v3/order': 1,
    '/api/v3/order/oco': 1,
  }
}

export const rawRequestWeight: TWeights = {
  '*': { '*': 1 }
}

export const limitConfigs: TLimitConfigs = new Map([
  [EBinanceRateLimitType.REQUEST_WEIGHT, {
    endpoints: requestWeights,
    trackingType: ETrackingType.IP,
    headerNameTemplate: 'x-mbx-used-weight-%(interval)',
  }],
  [EBinanceRateLimitType.RAW_REQUESTS, {
    endpoints: rawRequestWeight,
    trackingType: ETrackingType.IP
  }],
  [EBinanceRateLimitType.ORDERS, {
    endpoints: orderWeights,
    trackingType: ETrackingType.UID,
    headerNameTemplate: 'x-mbx-order-count-%(interval)'
  }]
]);
