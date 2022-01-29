import {
  QueueCanceledError,
  QueueSizeExceededError,
  QueueRetryInError,
  QueueMaxConcurrentRequestsError,
  QueueTimeoutError
} from '../../src/index';

describe('QueueError toJSON', () => {
  describe('QueueCanceledError', () => {
    it('has correct properties', async () => {
      const err = new QueueCanceledError();
      const json = err.toJSON();
      expect(json.name).toEqual('QueueCanceledError');
      expect(json.code).toEqual('E_CANCELED');
      expect(json.message).toEqual('Request has been canceled.');
      expect(json.stack).toEqual(err.stack);
      expect(json.retryIn).toBeUndefined();
    });
  });

  describe('QueueSizeExceededError', () => {
    it('has correct properties', async () => {
      const err = new QueueSizeExceededError(10);
      const json = err.toJSON();
      expect(json.name).toEqual('QueueSizeExceededError');
      expect(json.code).toEqual('E_QUEUE_SIZE_EXCEEDED');
      expect(json.message).toEqual('Queue max size of 10 queued requests exceeded');
      expect(json.stack).toEqual(err.stack);
      expect(json.retryIn).toBeUndefined();
    });
  });

  describe('QueueRetryInError', () => {
    it('has correct properties', async () => {
      const err = new QueueRetryInError(120);
      const json = err.toJSON();
      expect(json.name).toEqual('QueueRetryInError');
      expect(json.code).toEqual('E_RETRY_IN');
      expect(json.message).toEqual('Retry in 120ms');
      expect(json.stack).toEqual(err.stack);
      expect(json.retryIn).toEqual(120);
    });
  });

  describe('QueueMaxConcurrentRequestsError', () => {
    it('has correct properties', async () => {
      const err = new QueueMaxConcurrentRequestsError(10);
      const json = err.toJSON();
      expect(json.name).toEqual('QueueMaxConcurrentRequestsError');
      expect(json.code).toEqual('E_MAX_CONCCURENT_REQUESTS');
      expect(json.message).toEqual('Max concurrent requests of 10 requests exceeded');
      expect(json.stack).toEqual(err.stack);
      expect(json.retryIn).toBeUndefined();
    });
  });

  describe('QueueTimeoutError', () => {
    it('has correct properties', async () => {
      const dateStr = '2022-01-01T01:03:01.000Z';
      const err = new QueueTimeoutError(new Date(dateStr));
      const json = err.toJSON();
      expect(json.name).toEqual('QueueTimeoutError');
      expect(json.code).toEqual('E_TIMEOUT');
      expect(json.message).toEqual(`Request timed out. Could not dispatch request before ${dateStr}`);
      expect(json.stack).toEqual(err.stack);
      expect(json.retryIn).toBeUndefined();
    });
  });
});
