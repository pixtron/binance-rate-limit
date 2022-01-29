import {
  AbstractQueue,
  IQueueOptions,
  IQueueRequestConfig,
  IResponse,
  TQueueDispatchFn
} from '../../src/index';

import { LimiterImplementation } from '../__mocks/mock-limiter';

const createLimiter = (): LimiterImplementation => {
  return new LimiterImplementation();
}

export class QueueImplementation<
  RC extends IQueueRequestConfig
> extends AbstractQueue<
  RC,
  ReturnType<typeof createLimiter>
> {
  constructor(options: Partial<IQueueOptions> = {}) {
    super(createLimiter, {
      maxConcurrentRequests: 2,
      maxQueueSize: 5,
      ...options,
    });
  }
}

const mockRequestFactory = (config: Partial<IQueueRequestConfig> = {}, response: IResponse = {}): {
  config: IQueueRequestConfig,
  dispatchFn: TQueueDispatchFn,
} => {
  const dispatchFn = jest.fn(async(_: IQueueRequestConfig): Promise<{
    response: IResponse,
    data: any
  }> => {
    if (!response.headers) response.headers = {};

    return {
      response: {
        statusCode: response.statusCode || 200,
        headers: {
          'DATE': 'Thu, 01 Jan 1970 00:00:01 GMT',
          'X-MBX-USED-WEIGHT-1M': '10',
          ...response.headers
        },

      },
      data: {res: 'ok'}
    }
  });

  return {
    config: {
      'method': 'GET',
      'endpoint': '/api/v3/exchangeInfo',
      ...config
    },
    dispatchFn
  }
}

describe('AbstractQueue', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:00:01.000Z').getTime());
  });

  describe('limiter', () => {
    it('allows to access the limiter', async () => {
      const queue = new QueueImplementation();
      expect(queue.limiter).toBeInstanceOf(LimiterImplementation);
    });
  });

  describe('enqueue', () => {
    it('queues requests exceeding rate limit', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req2.config, req2.dispatchFn);
      queue.enqueue(req3.config, req3.dispatchFn);

      await Promise.all([p1, p2]);

      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(60e3);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(1);
    });

    it('throws when max queue size is exceeded', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req2.config, req2.dispatchFn);
      // fill queue
      const pQ = [...new Array(5)].map(() => queue.enqueue(req3.config, req3.dispatchFn));

      await expect(queue.enqueue(req3.config, req3.dispatchFn))
      .rejects
      .toThrow('Queue max size of 5 queued requests exceeded');

      await Promise.all([p1, p2]);

      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(60e3);
      await Promise.all(pQ);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(5);
    });

    it('throws retry in error when skipQueue request exceeds rate limit', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping', skipQueue: true}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req2.config, req2.dispatchFn);


      await Promise.all([p1, p2]);

      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);

      await expect(queue.enqueue(req3.config, req3.dispatchFn))
      .rejects
      .toThrow('Retry in 59000ms');

      jest.advanceTimersByTime(60e3);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);
    });

    it('throws max concurrent requests error when skipQueue exceeds max concurrent requests', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ping', skipQueue: true}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req1.config, req1.dispatchFn);
      await expect(queue.enqueue(req2.config, req2.dispatchFn))
      .rejects
      .toThrow('Max concurrent requests of 2 requests exceeded');

      await Promise.all([p1, p2]);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(2);
    });

    it('throws timeout error when maxQueueUntil elapses', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping', maxQueueUntil: new Date('1970-01-01T00:00:30.000Z')}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req2.config, req2.dispatchFn);


      await Promise.all([p1, p2]);

      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);

      const p3 = expect(queue.enqueue(req3.config, req3.dispatchFn))
      .rejects
      .toThrow('Request timed out. Could not dispatch request before 1970-01-01T00:00:30.000Z');

      jest.advanceTimersByTime(60e3);
      await p3;
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);
    });
  });

  describe('_parserErrorResponse', () => {
    it('parses axios error responses', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const err2 = new Error('Request ended with status code 429');
      (err2 as any).isAxiosError = true;
      (err2 as any).response = {
        status: 429,
        headers: {
          'DATE': 'Thu, 01 Jan 1970 00:00:01 GMT',
          'X-MBX-USED-WEIGHT-1M': '50',
          'RETRY-AFTER': '120',
        }
      };

      req2.dispatchFn = jest.fn(async () => { throw err2 });
      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = expect(queue.enqueue(req2.config, req2.dispatchFn))
        .rejects
        .toThrow(err2);

      const p3 = queue.enqueue(req3.config, req3.dispatchFn);

      await Promise.all([p1, p2]);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(90e3);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(31e3);
      await p3;
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(1);
    });

    it('allows to set custom error parser', async () => {
      const queue = new QueueImplementation({
        errorResponseParser: (): IResponse => {
          return {
            statusCode: 429,
            headers: {
              'DATE': 'Thu, 01 Jan 1970 00:00:01 GMT',
              'X-MBX-USED-WEIGHT-1M': '50',
              'RETRY-AFTER': '120',
            }
          }
        }
      });
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const err2 = new Error('Custom response error');
      req2.dispatchFn = jest.fn(async () => { throw err2 });
      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = expect(queue.enqueue(req2.config, req2.dispatchFn))
        .rejects
        .toThrow(err2);

      const p3 = queue.enqueue(req3.config, req3.dispatchFn);

      await Promise.all([p1, p2]);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(90e3);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);

      jest.advanceTimersByTime(31e3);
      await p3;
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('_assignUid', () => {
    it('keeps configured uid', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory({uid: 'customuid'});
      await queue.enqueue(req1.config, req1.dispatchFn);

      expect(req1.dispatchFn).toHaveBeenCalledWith(req1.config);
    });

    it('gets uid alias from header', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory({headers: {'X-MBX-APIKEY': 'mykey'}});
      await queue.enqueue(req1.config, req1.dispatchFn);

      expect(req1.dispatchFn).toHaveBeenCalledWith({
        uid: '816cc20437d859538736e1ef46558b7bda486c06',
        ...req1.config
      });
    });
  });

  describe('flushQueue', () => {
    it('empties queue', async () => {
      const queue = new QueueImplementation();
      const req1 = mockRequestFactory();
      const req2 = mockRequestFactory({ endpoint: '/api/v3/ticker/24hr'}, {headers: {'X-MBX-USED-WEIGHT-1M': '50'}});
      const req3 = mockRequestFactory({ endpoint: '/api/v3/ping'}, {headers: {'X-MBX-USED-WEIGHT-1M': '1'}});

      const p1 = queue.enqueue(req1.config, req1.dispatchFn);
      const p2 = queue.enqueue(req2.config, req2.dispatchFn);
      const pQ = [...new Array(5)].map(() => {
        expect(queue.enqueue(req3.config, req3.dispatchFn))
        .rejects
        .toThrow('Request has been canceled')
      });

      expect(queue.queue.length).toEqual(5);
      queue.flush();
      expect(queue.queue.length).toEqual(0);
      expect(queue.queue).toEqual([]);
      await Promise.all(pQ);

      await Promise.all([p1, p2]);

      jest.advanceTimersByTime(60e3);
      expect(req1.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req2.dispatchFn).toHaveBeenCalledTimes(1);
      expect(req3.dispatchFn).toHaveBeenCalledTimes(0);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
