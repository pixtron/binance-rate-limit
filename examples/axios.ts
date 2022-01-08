/* eslint no-console: "off" */

import { setTimeout as setTimeoutP } from 'timers/promises';

import axios, { AxiosResponse } from 'axios';
import { createSpotLimiter, EBinanceRateLimitType, IRequest, IResponse } from '@pxtrn/binance-rate-limit';

const limiter = createSpotLimiter();

limiter.setSafetyBuffers({
  [EBinanceRateLimitType.REQUEST_WEIGHT]: 20,
  [EBinanceRateLimitType.ORDERS]: 2,
});

const dispatchRequest = async (): Promise<AxiosResponse> => {
  const req: IRequest = {
    method: 'GET',
    endpoint: '/api/v3/exchangeInfo',
    params: { symbol: 'BTCUSDT' },
    uid: 'xxx' // binance accountId or hashed apiKey if accountId is not available
  };

  // wait to get a free slot (retryIn === 0)
  while (true) { // eslint-disable-line no-constant-condition
    const retryIn = limiter.mayDispatchRequest(req);
    if (retryIn === 0) break; // save to dispatch the request

    console.log(`retrying request in ${retryIn / 1e3}s at ${new Date(Date.now() + retryIn)}`);
    await setTimeoutP(retryIn);
  }

  const res: IResponse = {};

  try {
    const response = await axios({
      baseURL: 'https://api.binance.com',
      method: req.method,
      url: req.endpoint,
      params: req.params,
    });

    res.statusCode = response.status;
    res.headers = response.headers;

    return response;
  } catch(err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    res.statusCode = err.status;
    res.headers = err.headers;

    throw err;
  } finally {
    // update used weight from headers, and remove req weight from pendingWeight
    limiter.completeRequest(res, req);

    console.log('completed request, current usage', limiter.currentUsage);
  }
}

(async () => {
  try {
    const response = await dispatchRequest();
    console.log('Got response', response.status, response.data);
  } catch(err : any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    console.log('ERR', err.message);
  }
})()
