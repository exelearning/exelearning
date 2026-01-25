/**
 * Data providers for different runtime modes.
 *
 * Usage:
 *   import { ServerDataProvider, StaticDataProvider } from './providers/index.js';
 *
 *   // Select provider based on capabilities
 *   const provider = isStaticMode
 *     ? new StaticDataProvider(staticData)
 *     : new ServerDataProvider(baseFunctions, endpoints);
 */

export { DataProvider } from './DataProvider.js';
export { ServerDataProvider } from './ServerDataProvider.js';
export { StaticDataProvider } from './StaticDataProvider.js';
