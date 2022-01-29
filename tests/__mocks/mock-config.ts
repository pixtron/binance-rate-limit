import {
  ETrackingType,
  EBinanceRateLimitInterval,
  EBinanceRateLimitType,
  IBinanceRateLimitRule,
  TLimitConfigs,
  TMapedLimitRules,
  TWeights,
} from '../../src/index';

export const mapedRateLimits: TMapedLimitRules = new Map([
  [EBinanceRateLimitType.REQUEST_WEIGHT, [{
    rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
    interval: EBinanceRateLimitInterval.MINUTE,
    intervalNum: 1,
    limit: 50
  }]],
  [EBinanceRateLimitType.ORDERS, [{
    rateLimitType: EBinanceRateLimitType.ORDERS,
    interval: EBinanceRateLimitInterval.SECOND,
    intervalNum: 10,
    limit: 10
  }, {
    rateLimitType: EBinanceRateLimitType.ORDERS,
    interval: EBinanceRateLimitInterval.MINUTE,
    intervalNum: 1,
    limit: 40
  }]],
  [EBinanceRateLimitType.RAW_REQUESTS, [{
    rateLimitType: EBinanceRateLimitType.RAW_REQUESTS,
    interval: EBinanceRateLimitInterval.MINUTE,
    intervalNum: 5,
    limit: 20
  }]]
]);

export const exchangeInfoRateLimit: IBinanceRateLimitRule[] = [
  {
    rateLimitType: EBinanceRateLimitType.REQUEST_WEIGHT,
    interval: EBinanceRateLimitInterval.SECOND,
    intervalNum: 10,
    limit: 20
  },{
    rateLimitType: EBinanceRateLimitType.RAW_REQUESTS,
    interval: EBinanceRateLimitInterval.SECOND,
    intervalNum: 10,
    limit: 5
  }
];

export const requestWeights: TWeights = {
  'GET': {
    '/api/v3/ping': 1,
    '/api/v3/exchangeInfo': 10,
    '/api/v3/ticker/24hr': (params) => params.symbol ? 1 : 40,
  },
  'POST': {
    '/api/v3/order': 1,
  },
  'PUT': {
    '/api/v3/userDataStream': 1,
  },
  'DELETE': {
    '/api/v3/userDataStream': 1,
  }
}

export const orderWeights: TWeights = {
  'POST': {
    '/api/v3/order': 1,
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
