/**
 * Node.js ESM loader hook that redirects Cloudflare-specific
 * module imports to local shims on non-CF runtimes.
 *
 * Handles both resolve (bare specifier mapping) and load
 * (protocol scheme interception for cloudflare: URLs).
 *
 * Usage: node --import ./server/register.ts server/index.ts
 *        tsx --import ./server/register.ts server/index.ts
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHIMS_DIR = path.join(ROOT, 'server', 'shims');

const SHIM_MAP: Record<string, string> = {
	'cloudflare:workers': path.join(SHIMS_DIR, 'cloudflare-workers.ts'),
	'@cloudflare/sandbox': path.join(SHIMS_DIR, 'cloudflare-sandbox.ts'),
	'@cloudflare/containers': path.join(SHIMS_DIR, 'cloudflare-containers.ts'),
};

export async function resolve(
	specifier: string,
	context: { parentURL?: string; conditions: string[] },
	nextResolve: (specifier: string, context: unknown) => Promise<{ url: string }>,
): Promise<{ url: string; shortCircuit?: boolean }> {
	// Check if specifier matches a shim
	const shimPath = SHIM_MAP[specifier];
	if (shimPath) {
		return {
			url: `file://${shimPath}`,
			shortCircuit: true,
		};
	}

	// Handle @cloudflare/* sub-imports
	if (specifier.startsWith('@cloudflare/sandbox') || specifier.startsWith('@cloudflare/containers')) {
		const baseModule = specifier.startsWith('@cloudflare/sandbox') ? '@cloudflare/sandbox' : '@cloudflare/containers';
		const shimFile = SHIM_MAP[baseModule];
		if (shimFile) {
			return {
				url: `file://${shimFile}`,
				shortCircuit: true,
			};
		}
	}

	// Handle agents SDK (cloudflare-specific)
	if (specifier === 'agents' || specifier.startsWith('agents/')) {
		return {
			url: `file://${path.join(SHIMS_DIR, 'agents.ts')}`,
			shortCircuit: true,
		};
	}

	return nextResolve(specifier, context);
}

export async function load(
	url: string,
	context: { format?: string; conditions: string[] },
	nextLoad: (url: string, context: unknown) => Promise<{ format: string; source: string | ArrayBuffer }>,
): Promise<{ format: string; source: string | ArrayBuffer; shortCircuit?: boolean }> {
	// Intercept cloudflare: protocol URLs that slip through resolve
	if (url.startsWith('cloudflare:')) {
		const moduleName = url; // e.g., "cloudflare:workers"
		const shimPath = SHIM_MAP[moduleName];
		if (shimPath) {
			const source = readFileSync(shimPath, 'utf-8');
			return {
				format: 'module',
				source,
				shortCircuit: true,
			};
		}
		// Unknown cloudflare: module -- return empty module
		return {
			format: 'module',
			source: 'export default {};',
			shortCircuit: true,
		};
	}

	return nextLoad(url, context);
}
