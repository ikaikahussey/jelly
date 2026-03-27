/**
 * Infrastructure Provider Interfaces
 *
 * These interfaces decouple JLLLY from Cloudflare-specific services.
 * Each provider has at least two implementations:
 *   - A Cloudflare implementation (wrapping existing D1/R2/KV/DO/etc.)
 *   - A portable implementation (SQLite/filesystem/in-memory/Docker)
 *
 * Provider selection is driven by the JELLY_RUNTIME env var.
 */

import type { SqlValue } from '../agents/git/fs-adapter';

// Re-export for convenience
export type { SqlValue };

// ========================================
// 1. DATABASE PROVIDER
// ========================================

/**
 * Abstracts the relational database backend.
 * Drizzle ORM sits on top -- only the driver changes.
 *
 * The generic DrizzleDatabase type is intentionally loose here
 * because D1 and better-sqlite3 produce different Drizzle types.
 * Consumers cast to their specific schema type.
 */
export interface DatabaseProvider {
	/** Primary read-write database instance (Drizzle) */
	getDb(): unknown;
	/** Read-optimized instance (may route to replica or return same as getDb) */
	getReadDb(strategy?: 'fast' | 'fresh'): unknown;
	/** Health check */
	getHealthStatus(): Promise<{ healthy: boolean; timestamp: string }>;
}

// ========================================
// 2. STORAGE PROVIDER
// ========================================

export interface StorageObject {
	body: ReadableStream | ArrayBuffer;
	contentType?: string;
	size?: number;
}

export interface StoragePutOptions {
	contentType?: string;
	customMetadata?: Record<string, string>;
}

/**
 * Abstracts binary object storage (templates, images, screenshots).
 * Replaces direct R2 bucket access.
 */
export interface StorageProvider {
	get(key: string): Promise<StorageObject | null>;
	put(key: string, data: ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void>;
	delete(key: string): Promise<void>;
	/** Get a publicly-accessible URL for the object */
	getPublicUrl(key: string): string;
}

// ========================================
// 3. CACHE PROVIDER
// ========================================

export interface CachePutOptions {
	/** TTL in seconds */
	expirationTtl?: number;
}

/**
 * Abstracts key-value caching (config store, rate limiting, ephemeral data).
 * Replaces KV namespace access.
 */
export interface CacheProvider {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: CachePutOptions): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix?: string): Promise<string[]>;
}

// ========================================
// 4. ACTOR PROVIDER
// ========================================

/**
 * Tagged-template SQL executor for actor-local SQLite.
 * Same interface as SqlExecutor from git/fs-adapter.ts.
 */
export interface ActorSqlExecutor {
	<T = unknown>(query: TemplateStringsArray, ...values: SqlValue[]): T[];
}

/**
 * Abstracts persistent actor lifecycle (replaces Durable Objects).
 *
 * Each actor has:
 *  - An identity (namespace + id)
 *  - Persistent state (JSON, survives restarts)
 *  - A dedicated SQLite database (for git, conversations, etc.)
 *  - WebSocket connections
 */
export interface ActorHandle<TState = unknown> {
	readonly id: string;
	state: TState;
	setState(patch: Partial<TState>): void;
	readonly sql: ActorSqlExecutor;
	getWebSockets(): WebSocket[];
	broadcast(message: string): void;
}

export interface ActorProvider {
	/**
	 * Get or create an actor instance by namespace and ID.
	 * On Cloudflare, this returns a Durable Object stub.
	 * Locally, this returns an in-process instance with a dedicated SQLite file.
	 */
	getActor<TState = unknown>(namespace: string, id: string): Promise<ActorHandle<TState>>;
}

// ========================================
// 5. SANDBOX PROVIDER
// ========================================

// Sandbox is already abstracted via BaseSandboxService.
// The provider interface here is just for factory selection.

export type SandboxType = 'cloudflare' | 'docker' | 'static' | 'runner';

// ========================================
// 6. DEPLOYMENT PROVIDER
// ========================================

export interface DeployResult {
	success: boolean;
	url?: string;
	error?: string;
}

/**
 * Abstracts deployed-app hosting (replaces Workers for Platforms dispatch namespace).
 */
export interface DeploymentProvider {
	/** Deploy an app's built files */
	deploy(appName: string, files: Map<string, ArrayBuffer>, hasBackend: boolean): Promise<DeployResult>;
	/** Route an incoming request to a deployed app */
	route(appName: string, request: Request): Promise<Response>;
	/** Remove a deployed app */
	undeploy(appName: string): Promise<void>;
}
