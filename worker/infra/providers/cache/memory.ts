/**
 * In-Memory Cache Provider
 *
 * LRU-style in-process cache with TTL support.
 * Suitable for single-server deployments (local, VPS).
 * Data does not survive process restarts.
 */

import type { CacheProvider, CachePutOptions } from '../../types';

interface CacheEntry {
	value: string;
	expiresAt: number | null;
}

const DEFAULT_MAX_ENTRIES = 10_000;

export class MemoryCacheProvider implements CacheProvider {
	private readonly store = new Map<string, CacheEntry>();
	private readonly maxEntries: number;

	constructor(maxEntries = DEFAULT_MAX_ENTRIES) {
		this.maxEntries = maxEntries;
	}

	async get(key: string): Promise<string | null> {
		const entry = this.store.get(key);
		if (!entry) return null;

		if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}

		return entry.value;
	}

	async put(key: string, value: string, options?: CachePutOptions): Promise<void> {
		// Evict oldest entries if at capacity
		if (this.store.size >= this.maxEntries && !this.store.has(key)) {
			const firstKey = this.store.keys().next().value;
			if (firstKey !== undefined) {
				this.store.delete(firstKey);
			}
		}

		this.store.set(key, {
			value,
			expiresAt: options?.expirationTtl
				? Date.now() + options.expirationTtl * 1000
				: null,
		});
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async list(prefix?: string): Promise<string[]> {
		const now = Date.now();
		const keys: string[] = [];

		for (const [key, entry] of this.store) {
			if (entry.expiresAt !== null && now > entry.expiresAt) {
				this.store.delete(key);
				continue;
			}
			if (!prefix || key.startsWith(prefix)) {
				keys.push(key);
			}
		}

		return keys;
	}
}
