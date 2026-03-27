/**
 * Jelly Server Entry Point (Bun/Node)
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

// Build env-like object from process.env for provider initialization
function buildEnv(): Record<string, unknown> {
	return {
		...process.env,
		JELLY_RUNTIME: process.env.JELLY_RUNTIME,
		JELLY_DATA_DIR: DATA_DIR,
		CUSTOM_DOMAIN: process.env.CUSTOM_DOMAIN || `localhost:${PORT}`,
		CUSTOM_PREVIEW_DOMAIN: process.env.CUSTOM_PREVIEW_DOMAIN || `localhost:${PORT}`,
	};
}

async function ensureDataDirs() {
	const { mkdir } = await import('node:fs/promises');
	const dirs = [
		DATA_DIR,
		`${DATA_DIR}/storage`,
		`${DATA_DIR}/actors`,
		`${DATA_DIR}/deployments`,
	];
	for (const dir of dirs) {
		await mkdir(dir, { recursive: true });
	}
}

async function main() {
	await ensureDataDirs();

	const env = buildEnv();
	const registry = createInfraRegistry(env);

	logger.info('Infrastructure registry created', {
		runtime: registry.runtime,
		sandboxType: registry.sandboxType,
	});

	// Initialize database
	const dbHealth = await registry.database.getHealthStatus();
	logger.info('Database status', dbHealth);

	// Create Hono app with registry
	// Pass a minimal Env shim -- on non-CF runtimes, CF-specific bindings are unavailable
	const envShim = env as unknown as Env;
	const app = createApp(envShim, registry);

	logger.info(`Starting Jelly server on port ${PORT}`);

	// Use Bun.serve if available, otherwise fall back to node:http
	if (typeof globalThis.Bun !== 'undefined') {
		Bun.serve({
			port: PORT,
			fetch: (request: Request) => app.fetch(request, envShim),
		});
		logger.info(`Jelly server running at http://localhost:${PORT} (Bun)`);
	} else {
		// Node.js fallback using @hono/node-server
		const { serve } = await import('@hono/node-server');
		serve({
			fetch: (request: Request) => app.fetch(request, envShim),
			port: PORT,
		});
		logger.info(`Jelly server running at http://localhost:${PORT} (Node)`);
	}
}

main().catch((err) => {
	logger.error('Failed to start server', err);
	process.exit(1);
});
