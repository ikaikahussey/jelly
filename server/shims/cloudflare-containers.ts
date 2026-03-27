/**
 * Shim for `@cloudflare/containers` on non-CF runtimes.
 */

export function switchPort(_port: number): string {
	throw new Error('@cloudflare/containers is not available on this runtime.');
}
