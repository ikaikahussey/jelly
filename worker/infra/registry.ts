/**
 * Infrastructure Registry
 *
 * Central holder for all pluggable infrastructure providers.
 * Created once at startup via createInfraRegistry() and threaded
 * through the application via Hono context or constructor injection.
 */

import type {
	DatabaseProvider,
	StorageProvider,
	CacheProvider,
	ActorProvider,
	DeploymentProvider,
	SandboxType,
} from './types';

export interface InfraRegistryConfig {
	database: DatabaseProvider;
	storage: StorageProvider;
	cache: CacheProvider;
	actor: ActorProvider;
	deployment: DeploymentProvider;
	sandboxType: SandboxType;
	runtime: 'cloudflare' | 'local' | 'docker';
}

export class InfraRegistry {
	readonly database: DatabaseProvider;
	readonly storage: StorageProvider;
	readonly cache: CacheProvider;
	readonly actor: ActorProvider;
	readonly deployment: DeploymentProvider;
	readonly sandboxType: SandboxType;
	readonly runtime: 'cloudflare' | 'local' | 'docker';

	constructor(config: InfraRegistryConfig) {
		this.database = config.database;
		this.storage = config.storage;
		this.cache = config.cache;
		this.actor = config.actor;
		this.deployment = config.deployment;
		this.sandboxType = config.sandboxType;
		this.runtime = config.runtime;
	}

	isCloudflare(): boolean {
		return this.runtime === 'cloudflare';
	}

	isLocal(): boolean {
		return this.runtime === 'local';
	}
}
