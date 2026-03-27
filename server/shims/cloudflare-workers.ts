/**
 * Shim for `cloudflare:workers` module on non-CF runtimes.
 *
 * Provides functional implementations of DurableObject and other
 * CF-specific classes for local runtime. DurableObject subclasses
 * (DORateLimitStore, UserSecretsStore) can run against this shim
 * with in-memory storage.
 */

/**
 * In-memory storage that mimics DurableObjectStorage.
 * Sufficient for local development -- not durable across restarts.
 */
class LocalDurableObjectStorage {
	private store = new Map<string, unknown>();

	async get<T = unknown>(key: string): Promise<T | undefined> {
		return this.store.get(key) as T | undefined;
	}

	async put(key: string, value: unknown): Promise<void> {
		this.store.set(key, structuredClone(value));
	}

	async delete(key: string): Promise<boolean> {
		return this.store.delete(key);
	}

	async list(): Promise<Map<string, unknown>> {
		return new Map(this.store);
	}

	// Alarm support (no-op on local -- timers managed externally)
	private _alarm: number | null = null;

	async setAlarm(time: number | Date): Promise<void> {
		this._alarm = typeof time === 'number' ? time : time.getTime();
	}

	async getAlarm(): Promise<number | null> {
		return this._alarm;
	}

	async deleteAlarm(): Promise<void> {
		this._alarm = null;
	}

	// SQL support for DOs that use ctx.storage.sql.exec()
	sql = {
		exec: (query: string, ..._params: unknown[]): { results: unknown[] } => {
			// Stub -- DOs needing real SQL should use the Agent shim instead
			console.warn('[LocalDurableObjectStorage] sql.exec() is a stub:', query);
			return { results: [] };
		},
	};
}

/**
 * Local DurableObjectState that mimics the CF DurableObjectState API.
 */
class LocalDurableObjectState {
	readonly id: DurableObjectId;
	readonly storage: LocalDurableObjectStorage;

	constructor(id?: string) {
		this.id = { toString: () => id || 'local', name: id } as unknown as DurableObjectId;
		this.storage = new LocalDurableObjectStorage();
	}

	async blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T> {
		// On local runtime, just execute immediately (single-threaded)
		return await fn();
	}

	acceptWebSocket(_ws: WebSocket): void {
		// No-op on local runtime
	}

	getWebSockets(): WebSocket[] {
		return [];
	}
}

export class DurableObject {
	ctx: LocalDurableObjectState;
	env: unknown;

	constructor(ctx: unknown, env: unknown) {
		// If called with a real LocalDurableObjectState, use it;
		// otherwise create a new one for compatibility
		this.ctx = ctx instanceof LocalDurableObjectState
			? ctx
			: new LocalDurableObjectState();
		this.env = env;
	}
}

// Re-export the state class for use by the DO registry
export { LocalDurableObjectState };

/**
 * Local Durable Object namespace that creates in-process DO instances.
 * Used to make env.DORateLimitStore, env.UserSecretsStore, etc. work locally.
 */
export class LocalDurableObjectNamespace<T extends DurableObject> {
	private instances = new Map<string, T>();
	private factory: new (ctx: LocalDurableObjectState, env: unknown) => T;
	private env: unknown;

	constructor(
		factory: new (ctx: LocalDurableObjectState, env: unknown) => T,
		env: unknown,
	) {
		this.factory = factory;
		this.env = env;
	}

	idFromName(name: string): DurableObjectId {
		return { toString: () => name, name } as unknown as DurableObjectId;
	}

	get(id: DurableObjectId): T {
		const key = id.toString();
		let instance = this.instances.get(key);
		if (!instance) {
			const state = new LocalDurableObjectState(key);
			instance = new this.factory(state, this.env);
			this.instances.set(key, instance);
		}
		return instance;
	}

	/**
	 * Convenience method used by RateLimitService: env.DORateLimitStore.getByName(key)
	 */
	getByName(name: string): T {
		return this.get(this.idFromName(name));
	}
}

export function env(): Record<string, unknown> {
	return process.env as unknown as Record<string, unknown>;
}
