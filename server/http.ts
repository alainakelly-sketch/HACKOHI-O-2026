import { EnvHttpProxyAgent } from 'undici';
const dispatcher = new EnvHttpProxyAgent();
// Node fetch accepts an undici dispatcher. Keep the inherited proxy and CA trust.
export const networkFetch: typeof fetch = (input, init) => {
  const options = { ...init, dispatcher };
  return globalThis.fetch(input, options);
};
