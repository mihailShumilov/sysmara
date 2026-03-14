/**
 * @module database/registry
 * Adapter registry for managing database adapter implementations.
 * Provides registration and lookup of adapters by name.
 */

import type { AdapterName, DatabaseAdapter } from './adapter.js';

/** Internal store of registered database adapters, keyed by adapter name. */
const adapters = new Map<AdapterName, DatabaseAdapter>();

/**
 * Registers a database adapter implementation, making it available
 * for lookup by name. Overwrites any previously registered adapter
 * with the same name.
 *
 * @param adapter - The database adapter to register
 */
export function registerAdapter(adapter: DatabaseAdapter): void {
  adapters.set(adapter.name, adapter);
}

/**
 * Retrieves a registered database adapter by name.
 *
 * @param name - The adapter name to look up
 * @returns The registered adapter, or `undefined` if no adapter is registered with that name
 */
export function getAdapter(name: AdapterName): DatabaseAdapter | undefined {
  return adapters.get(name);
}

/**
 * Returns the names of all currently registered database adapters.
 *
 * @returns An array of registered adapter names
 */
export function listAdapters(): AdapterName[] {
  return [...adapters.keys()];
}
