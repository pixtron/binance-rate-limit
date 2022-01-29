export enum EBinanceRateLimitInterval {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  DAY = 'DAY',
}

export enum EBinanceRateLimitType {
  REQUEST_WEIGHT = 'REQUEST_WEIGHT',
  ORDERS = 'ORDERS',
  RAW_REQUESTS = 'RAW_REQUESTS',
}

export enum ETrackingType {
  IP,
  UID,
}

export interface IBinanceRateLimitRule {
  rateLimitType: EBinanceRateLimitType,
  interval: EBinanceRateLimitInterval,
  intervalNum: number,
  limit: number
}

export interface ILimitConfig {
  endpoints: TWeights,
  trackingType: ETrackingType,
  headerNameTemplate?: string,
}

export interface IResponse {
  statusCode?: number,
  headers?: TResponseHeaders,
}

export interface IRequest {
  method: TMethod,
  endpoint: string,
  params?: TRequestParams,
  uid?: string,
}

export type TLimitConfigs = Map<EBinanceRateLimitType, ILimitConfig>

export type TMapedLimitRules = Map<EBinanceRateLimitType, IBinanceRateLimitRule[]>;

export type TMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TRequestParams = Record<string, any>;

export type TResponseHeaders = Record<string, string>;

export type TRequestHeaders = Record<string, string>;

export type TSafetyBuffers = {
  [key in EBinanceRateLimitType]?: number
}

export type TWeightConfig = number | ((params: TRequestParams) => number);

export type TWeights = {
  [key in TMethod | '*']?: Record<string, TWeightConfig>
}
