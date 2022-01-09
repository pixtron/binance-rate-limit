import { RetryTimeout } from '../../src/utils/index';

describe('RetryTimeout', () => {
  beforeEach(() => {
    jest
      .useFakeTimers()
      .setSystemTime(new Date('1970-01-01T00:01:00.000Z').getTime());
  });

  describe('reset', () => {
    it('resets a running timeout without emitting', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(30e3);

      timeout.reset();
      expect(timeout.elapsed).toEqual(true);

      jest.advanceTimersByTime(30e3);
      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(true);
    });
  });

  describe('retryAfter', () => {
    it('returns the correct date', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      expect(timeout.retryAfter.getTime()).toEqual(120001);
    });
  });

  describe('backoff', () => {
    it('emits elapsed when timeout is reached', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(60e3);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('increases timeout when a second higher timeout is passed', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      jest.advanceTimersByTime(30e3);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      timeout.backoff(new Date('1970-01-01T00:03:00.000Z'));
      jest.advanceTimersByTime(30e3);
      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(60e3);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('does not increase timeout when a second lower timeout is passed', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      jest.advanceTimersByTime(30e3);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      timeout.backoff(new Date('1970-01-01T00:01:30.000Z'));
      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(90e3);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('immediately emits elapsed if date is in past', () => {
      const timeout = new RetryTimeout();
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:00:59.000Z'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });
  });

  describe('backoff lowest', () => {
    it('emits elapsed when timeout is reached', () => {
      const timeout = new RetryTimeout(true);
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(60e3);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('does not decrease timeout when a second higher timeout is passed', () => {
      const timeout = new RetryTimeout(true);
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      jest.advanceTimersByTime(30e3);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      timeout.backoff(new Date('1970-01-01T00:03:00.000Z'));
      jest.advanceTimersByTime(30e3);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('decreases timeout when a second lower timeout is passed', () => {
      const timeout = new RetryTimeout(true);
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      jest.advanceTimersByTime(30e3);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      timeout.backoff(new Date('1970-01-01T00:01:45.000Z'));
      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      jest.advanceTimersByTime(15e3);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('immediately emits elapsed if date is in past', () => {
      const timeout = new RetryTimeout(true);
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:00:59.000Z'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });

    it('immediately emits elapsed if date is in past and there is an active timeout', () => {
      const timeout = new RetryTimeout(true);
      const listener = jest.fn(() => { });
      timeout.once('elapsed', listener);

      timeout.backoff(new Date('1970-01-01T00:02:00.000Z'));
      jest.advanceTimersByTime(30e3);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(timeout.elapsed).toEqual(false);

      timeout.backoff(new Date('1970-01-01T00:01:29.000Z'));

      expect(listener).toHaveBeenCalledTimes(1);
      expect(timeout.elapsed).toEqual(true);
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });
});
