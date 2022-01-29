# @pxtrn/binance-rate-limit

node.js rate limit tracker for binance. Let's you verify that you won't hit
a rate limit before you send your api request.

## Installation

`npm install --save @pxtrn/binance-rate-limit`

## Usage

Also see the full [axios example](examples/axios.ts)

```ts
import { createSpotLimiter, IRequest, IResponse } from '@pxtrn/binance-rate-limit';

const request = async (req: IRequest): Promise<IResponse> => {
  // dispatch request with your preferred request library
}

const req: IRequest = {
  method: 'GET',
  endpoint: '/api/v3/exchangeInfo',
  params: {symbol: 'BTCUSDT'},
  uid: 'xxx' // binance accountId or hashed apiKey if accountId is not available
};

const limiter = createSpotLimiter();
const retryIn = limiter.mayDispatchRequest(req);

if (retryIn === 0) {
  // if retryIn === 0 dispatch the request immediately.
  const response = await request(req);

  const { statusCode, headers } = response;
  const res: IResponse = {statusCode, headers};

  // update counters, make sure to call this as well if you got
  // a response with a status code other then 2xx or any error during request
  limiter.completeRequest(res, req);
} else {
  // if retryIn > 0 throw and reschedule call
  throw new Error(`Rate limit exceeded retry in ${retryIn}`);
}
```
