/**
 * Durable Object Actor Provider
 *
 * Wraps Cloudflare Durable Objects for persistent actor lifecycle.
 * Each actor is a DO instance with SQLite storage, state, and WebSocket support.
 *
 * This provider delegates to the existing DO infrastructure --
 * it does not replace the Agent class, but provides a uniform
 * way to obtain actor handles across runtimes.
 */

import type { ActorProvider, ActorHandle } from '../../types';

export class DurableObjectActorProvider implements ActorProvider {
	private readonly env: Record<string, unknown>;

	constructor(env: Record<string, unknown>) {
		this.env = env;
	}

	async getActor<TState = unknown>(namespace: string, id: string): Promise<ActorHandle<TState>> {
		// Map namespace to the corresponding DO binding
		const binding = this.resolveBinding(namespace);
		if (!binding) {
			throw new Error(`No Durable Object binding found for namespace "${namespace}"`);
		}

		const doNamespace = binding as DurableObjectNamespace;
		const doId = doNamespace.idFromName(id);
		const stub = doNamespace.get(doId);

		// Return a handle that proxies to the DO stub.
		// The actual state/sql/websocket access happens inside the DO class itself.
		// This handle is primarily used for routing requests to the right DO.
		return {
			id,
			get state() {
				throw new Error('Direct state access not available on DO stubs. Send a request to the DO instead.');
			},
			setState() {
				throw new Error('Direct setState not available on DO stubs. Send a request to the DO instead.');
			},
			get sql() {
				throw new Error('Direct SQL access not available on DO stubs. Send a request to the DO instead.');
			},
			getWebSockets() {
				throw new Error('WebSocket access not available on DO stubs. Connect via the DO URL instead.');
			},
			broadcast() {
				throw new Error('Broadcast not available on DO stubs. Send a request to the DO instead.');
			},
			/** Access the raw DO stub for making fetch/RPC calls */
			_stub: stub,
		} as ActorHandle<TState> & { _stub: DurableObjectStub };
	}

	private resolveBinding(namespace: string): unknown {
		const bindingMap: Record<string, string> = {
			'code-generator': 'CodeGenObject',
			'secrets': 'UserSecretsStore',
			'rate-limit': 'DORateLimitStore',
		};

		const bindingName = bindingMap[namespace] || namespace;
		return this.env[bindingName];
	}
}
