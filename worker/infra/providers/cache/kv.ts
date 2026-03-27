/**
 * KV Cache Provider
 *
 * Wraps Cloudflare KV namespace for key-value caching.
 */

import type { CacheProvider, CachePutOptions } from '../../types';

export class KVCacheProvider implements CacheProvider {
	private readonly kv: KVNamespace;

	constructor(env: Record<string, unknown>) {
		this.kv = env.VibecoderStore as KVNamespace;
	}

	async get(key: string): Promise<string | null> {
		return this.kv.get(key);
	}

	async put(key: string, value: string, options?: CachePutOptions): Promise<void> {
		await this.kv.put(key, value, {
			expirationTtl: options?.expirationTtl,
		});
	}

	async delete(key: string): Promise<void> {
		await this.kv.delete(key);
	}

	async list(prefix?: string): Promise<string[]> {
		const keys: string[] = [];
		let cursor: string | undefined;
		let done = false;

		while (!done) {
			const result = await this.kv.list({ prefix, cursor });
			for (const key of result.keys) {
				keys.push(key.name);
			}
			if (result.list_complete) {
				done = true;
			} else {
				cursor = result.cursor;
			}
		}

		return keys;
	}
}
