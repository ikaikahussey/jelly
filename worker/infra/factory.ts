/**
 * Infrastructure Registry Factory
 *
 * Reads JELLY_RUNTIME env var and instantiates the appropriate
 * provider implementations for each infrastructure concern.
 *
 * JELLY_RUNTIME values:
 *   - "cloudflare" (default): D1 + R2 + KV + DurableObjects + CF Sandbox + Dispatch
 *   - "local": SQLite + Filesystem + Memory + LocalActor + Docker/Static + Static Deploy
 *   - "docker": SQLite + Filesystem + Memory + LocalActor + Docker + Docker Deploy
 */

import { InfraRegistry, type InfraRegistryConfig } from './registry';
import type { SandboxType } from './types';

import { D1DatabaseProvider } from './providers/database/d1';
import { SqliteDatabaseProvider } from './providers/database/sqlite';
import { R2StorageProvider } from './providers/storage/r2';
import { FileSystemStorageProvider } from './providers/storage/filesystem';
import { KVCacheProvider } from './providers/cache/kv';
import { MemoryCacheProvider } from './providers/cache/memory';
import { DurableObjectActorProvider } from './providers/actor/durable-object';
import { LocalActorProvider } from './providers/actor/local';
import { DispatchDeploymentProvider } from './providers/deployment/dispatch';
import { HybridDeploymentProvider } from './providers/deployment/hybrid';

type Runtime = 'cloudflare' | 'local' | 'docker';

function resolveRuntime(env: Record<string, unknown>): Runtime {
	const raw = (env.JELLY_RUNTIME as string) || 'cloudflare';
	if (raw === 'local' || raw === 'docker') return raw;
	return 'cloudflare';
}

/**
 * Create a fully-configured InfraRegistry from environment variables.
 *
 * On Cloudflare, `env` is the Workers Env binding object.
 * On local/Docker, `env` is process.env or a similar record.
 */
export function createInfraRegistry(env: Record<string, unknown>): InfraRegistry {
	const runtime = resolveRuntime(env);

	const config: InfraRegistryConfig = runtime === 'cloudflare'
		? buildCloudflareConfig(env)
		: buildPortableConfig(env, runtime);

	return new InfraRegistry(config);
}

function buildCloudflareConfig(env: Record<string, unknown>): InfraRegistryConfig {
	return {
		runtime: 'cloudflare',
		database: new D1DatabaseProvider(env),
		storage: new R2StorageProvider(env),
		cache: new KVCacheProvider(env),
		actor: new DurableObjectActorProvider(env),
		deployment: new DispatchDeploymentProvider(env),
		sandboxType: (env.SANDBOX_SERVICE_TYPE as SandboxType) || 'cloudflare',
	};
}

function buildPortableConfig(env: Record<string, unknown>, runtime: 'local' | 'docker'): InfraRegistryConfig {
	const dataDir = (env.JELLY_DATA_DIR as string) || './data';

	return {
		runtime,
		database: new SqliteDatabaseProvider(dataDir),
		storage: new FileSystemStorageProvider(dataDir),
		cache: new MemoryCacheProvider(),
		actor: new LocalActorProvider(dataDir),
		deployment: new HybridDeploymentProvider(dataDir),
		sandboxType: runtime === 'docker' ? 'docker' : 'static',
	};
}
