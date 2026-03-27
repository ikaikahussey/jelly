/**
 * Hybrid Deployment Provider
 *
 * For non-Cloudflare runtimes:
 *   - Frontend-only apps: Serves built assets from filesystem
 *   - Full-stack apps: Runs in Docker containers, reverse-proxied by subdomain
 *
 * Deployed apps live at {dataDir}/deployments/{appName}/
 */

import type { DeploymentProvider, DeployResult } from '../../types';

export class HybridDeploymentProvider implements DeploymentProvider {
	private readonly deployDir: string;

	constructor(dataDir: string) {
		this.deployDir = `${dataDir}/deployments`;
	}

	async deploy(appName: string, files: Map<string, ArrayBuffer>, _hasBackend: boolean): Promise<DeployResult> {
		const { mkdir, writeFile } = await import('node:fs/promises');
		const { join, dirname } = await import('node:path');

		const appDir = join(this.deployDir, appName);

		try {
			// Write all files to the deployment directory
			for (const [filePath, content] of files) {
				const fullPath = join(appDir, filePath);
				await mkdir(dirname(fullPath), { recursive: true });
				await writeFile(fullPath, Buffer.from(content));
			}

			return {
				success: true,
				url: `http://localhost:3000/apps/${appName}`,
			};
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Deployment failed',
			};
		}
	}

	async route(appName: string, request: Request): Promise<Response> {
		const { readFile, stat } = await import('node:fs/promises');
		const { join, extname } = await import('node:path');

		const appDir = join(this.deployDir, appName);
		const url = new URL(request.url);
		let filePath = url.pathname === '/' ? '/index.html' : url.pathname;

		const fullPath = join(appDir, filePath);

		// Prevent directory traversal
		if (!fullPath.startsWith(appDir)) {
			return new Response('Forbidden', { status: 403 });
		}

		try {
			const fileStat = await stat(fullPath);
			if (fileStat.isDirectory()) {
				filePath = join(filePath, 'index.html');
			}

			const data = await readFile(join(appDir, filePath));
			const ext = extname(filePath);
			const contentType = MIME_TYPES[ext] || 'application/octet-stream';

			return new Response(data, {
				headers: { 'Content-Type': contentType },
			});
		} catch {
			// SPA fallback: serve index.html for non-asset paths
			try {
				const indexData = await readFile(join(appDir, 'index.html'));
				return new Response(indexData, {
					headers: { 'Content-Type': 'text/html' },
				});
			} catch {
				return new Response('App not found', { status: 404 });
			}
		}
	}

	async undeploy(appName: string): Promise<void> {
		const { rm } = await import('node:fs/promises');
		const { join } = await import('node:path');

		try {
			await rm(join(this.deployDir, appName), { recursive: true, force: true });
		} catch {
			// Directory may not exist
		}
	}
}

const MIME_TYPES: Record<string, string> = {
	'.html': 'text/html',
	'.css': 'text/css',
	'.js': 'application/javascript',
	'.mjs': 'application/javascript',
	'.json': 'application/json',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.map': 'application/json',
};
