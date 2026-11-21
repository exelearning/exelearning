/** fetch's call signature, without Bun's static extras (preconnect). */
type FetchFn = (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>;

/** globalThis typed so a test can install a plain async function as the global fetch. */
export const fetchHost = globalThis as unknown as { fetch: FetchFn };
