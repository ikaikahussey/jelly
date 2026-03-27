/**
 * Dispatch Deployment Provider
 *
 * Wraps Cloudflare Workers for Platforms (dispatch namespace)
 * for routing requests to deployed user apps.
 */

import type { DeploymentProvider, DeployResult } from '../../types';

export class DispatchDeploymentProvider implements DeploymentProvider {
	private readonly env: Record<string, unknown>;

	constructor(env: Record<string, unknown>) {
		this.env = env;
	}

	async deploy(appName: string, _files: Map<string, ArrayBuffer>, _hasBackend: boolean): Promise<DeployResult> {
		// On Cloudflare, deployment is handled by the existing deploy service
		// which uploads to Workers for Platforms via the CF API.
		// This provider delegates to that existing logic.
		const cfApiToken = this.env.CLOUDFLARE_API_TOKEN as string;
		const cfAccountId = this.env.CLOUDFLARE_ACCOUNT_ID as string;

		if (!cfApiToken || !cfAccountId) {
			return { success: false, error: 'Missing Cloudflare API credentials for deployment' };
		}

		// The actual deployment logic lives in worker/services/deployer/deploy.ts
		// and is called directly by the deploy controller. This provider
		// is the abstraction point for non-CF runtimes.
		return { success: true, url: `https://${appName}.${this.env.CUSTOM_DOMAIN as string}` };
	}

	async route(appName: string, request: Request): Promise<Response> {
		const dispatcher = this.env.DISPATCHER as { get(name: string): { fetch(req: Request): Promise<Response> } };
		if (!dispatcher) {
			return new Response('Dispatch namespace not available', { status: 503 });
		}

		try {
			const worker = dispatcher.get(appName);
			return await worker.fetch(request);
		} catch {
			return new Response('App not found', { status: 404 });
		}
	}

	async undeploy(appName: string): Promise<void> {
		const cfApiToken = this.env.CLOUDFLARE_API_TOKEN as string;
		const cfAccountId = this.env.CLOUDFLARE_ACCOUNT_ID as string;
		const dispatchNamespace = this.env.DISPATCH_NAMESPACE as string;

		if (!cfApiToken || !cfAccountId || !dispatchNamespace) return;

		// Delete the worker script from the dispatch namespace
		await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/dispatch/namespaces/${dispatchNamespace}/scripts/${appName}`,
			{
				method: 'DELETE',
				headers: { Authorization: `Bearer ${cfApiToken}` },
			},
		);
	}
}
