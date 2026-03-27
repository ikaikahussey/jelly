/**
 * Shim for `@cloudflare/sandbox` on non-CF runtimes.
 *
 * Provides no-op stubs for sandbox SDK classes.
 * The actual sandbox logic is handled by DockerSandboxService
 * or StaticPreviewService via the provider system.
 */

export class Sandbox {
	constructor() {
		throw new Error('Cloudflare Sandbox is not available on this runtime. Use DockerSandboxService or StaticPreviewService instead.');
	}
}

export function getSandbox(_binding: unknown, _id: string): Sandbox {
	throw new Error('Cloudflare Sandbox is not available on this runtime.');
}

export function parseSSEStream(_stream: ReadableStream): AsyncIterable<unknown> {
	throw new Error('Cloudflare Sandbox SSE parsing is not available on this runtime.');
}

export type LogEvent = {
	type: string;
	data: string;
};

export type ExecResult = {
	exitCode: number;
	stdout: string;
	stderr: string;
};
