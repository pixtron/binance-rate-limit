import { getHeaderValue } from '../../src/index';

describe('utils', () => {
  describe('getHeaderValue', () => {
    it('gets a header value', () => {
      const headers = {'x-mbx-used-weight-1m': '10'};
      const result = getHeaderValue('x-mbx-used-weight-1m', headers);
      expect(result).toEqual('10');
    });

    it('key is case insensitive', () => {
      const headers = {'X-MBX-USED-WEIGHT-1M': '10'};
      const result = getHeaderValue('x-mbx-used-weight-1m', headers);
      expect(result).toEqual('10');
    });

    it('can handle undefined headers', () => {
      const result = getHeaderValue('x-mbx-used-weight-1m');
      expect(result).toEqual(undefined);
    });
  });
});
