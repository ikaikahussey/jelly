/**
 * JLLLY Server Entry Point (Bun/Node)
 *
 * Alternative to the Cloudflare Workers entry point (worker/index.ts).
 * Runs the same Hono app with portable infrastructure providers.
 *
 * Usage:
 *   JELLY_RUNTIME=local bun server/index.ts
 *   JELLY_RUNTIME=docker bun server/index.ts
 *
 * Environment variables:
 *   JELLY_RUNTIME     - "local" or "docker" (required)
 *   JELLY_DATA_DIR    - Directory for SQLite, storage, actors (default: ./data)
 *   PORT              - HTTP server port (default: 3000)
 *   JWT_SECRET        - Secret for JWT tokens (required)
 *   ANTHROPIC_API_KEY - Anthropic API key
 *   OPENAI_API_KEY    - OpenAI API key
 *   (see worker-configuration.d.ts for full env var list)
 */

import { createApp } from '../worker/app';
import { createInfraRegistry } from '../worker/infra/factory';
import { createLogger } from '../worker/logger';

const logger = createLogger('Server');

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = process.env.JELLY_DATA_DIR || './data';

// Ensure runtime is set
if (!process.env.JELLY_RUNTIME) {
	process.env.JELLY_RUNTIME = 'local';
}

/**
 * Build env-like object from process.env for provider initialization.
 * Includes local DO namespace shims so env.DORateLimitStore etc. work.
 */
async function buildEnv(): Promise<Record<string, unknown>> {
	const baseEnv: Record<string, unknown> = {
		...process.env,
		JELLY_RUNTIME: process.env.JELLY_RUNTIME,
		JELLY_DATA_DIR: DATA_DIR,
		ENVIRONMENT: process.env.ENVIRONMENT || 'local',
		CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || `localhost:${PORT}`,
		CUSTOM_PREVIEW_DOMAIN: process.env.CUSTOM_PREVIEW_DOMAIN || `localhost:${PORT}`,
	};

	// Create local DO namespace shims for services that use env.XxxStore
	const { LocalDurableObjectNamespace } = await import('./shims/cloudflare-workers');
	const { DORateLimitStore } = await import('../worker/services/rate-limit/DORateLimitStore');
	const { UserSecretsStore } = await import('../worker/services/secrets/UserSecretsStore');

	baseEnv.DORateLimitStore = new LocalDurableObjectNamespace(
		DORateLimitStore as unknown as new (...args: unknown[]) => InstanceType<typeof DORateLimitStore>,
		baseEnv,
	);
	baseEnv.UserSecretsStore = new LocalDurableObjectNamespace(
		UserSecretsStore as unknown as new (...args: unknown[]) => InstanceType<typeof UserSecretsStore>,
		baseEnv,
	);

	// Register the CodeGeneratorAgent class for local getAgentByName
	const { registerAgentClass } = await import('./shims/agents');
	const { CodeGeneratorAgent } = await import('../worker/agents/core/codingAgent');
	registerAgentClass('CodeGeneratorAgent', (ctx, env) => {
		return new CodeGeneratorAgent(ctx as unknown, env as Env) as unknown as import('./shims/agents').Agent;
	});
	registerAgentClass('default', (ctx, env) => {
		return new CodeGeneratorAgent(ctx as unknown, env as Env) as unknown as import('./shims/agents').Agent;
	});

	return baseEnv;
}

async function ensureDataDirs() {
	const { mkdir } = await import('node:fs/promises');
	const dirs = [
		DATA_DIR,
		`${DATA_DIR}/storage`,
		`${DATA_DIR}/actors`,
		`${DATA_DIR}/actors/agents`,
		`${DATA_DIR}/deployments`,
	];
	for (const dir of dirs) {
		await mkdir(dir, { recursive: true });
	}
}

async function main() {
	await ensureDataDirs();

	const env = await buildEnv();
	const registry = createInfraRegistry(env);

	logger.info('Infrastructure registry created', {
		runtime: registry.runtime,
		sandboxType: registry.sandboxType,
	});

	// Initialize database
	const dbHealth = await registry.database.getHealthStatus();
	logger.info('Database status', dbHealth);

	// Create Hono app with registry
	const envShim = env as unknown as Env;
	const app = createApp(envShim, registry);

	logger.info(`Starting JLLLY server on port ${PORT}`);

	// Use Bun.serve if available, otherwise fall back to node:http
	if (typeof globalThis.Bun !== 'undefined') {
		Bun.serve({
			port: PORT,
			fetch: (request: Request) => app.fetch(request, envShim),
		});
		logger.info(`JLLLY server running at http://localhost:${PORT} (Bun)`);
	} else {
		// Node.js fallback using @hono/node-server
		const { serve } = await import('@hono/node-server');
		serve({
			fetch: (request: Request) => app.fetch(request, envShim),
			port: PORT,
		});
		logger.info(`JLLLY server running at http://localhost:${PORT} (Node)`);
	}
}

main().catch((err) => {
	logger.error('Failed to start server', err);
	process.exit(1);
});
