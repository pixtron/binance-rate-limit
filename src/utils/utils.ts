import { TResponseHeaders, TRequestHeaders } from '../types';

export const getHeaderValue = (
  key: string,
  headers?: TResponseHeaders | TRequestHeaders
): string | undefined => {
  if (!headers) return;
  const hKey = Object.keys(headers).find(k => k.toLowerCase() === key);

  if (!hKey) return;
  return headers[hKey];
}
