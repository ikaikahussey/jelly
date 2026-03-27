/**
 * Static Preview Sandbox Provider
 *
 * Lightweight sandbox for frontend-only apps that skips containers entirely.
 * Runs `vite build` in a temp directory and serves output via a static file server.
 *
 * Selection criteria: Used when the project blueprint has no server-side code
 * (no Express, FastAPI, etc.) -- determined by the sandbox factory.
 *
 * This is a provider-level type definition. The full BaseSandboxService
 * implementation will be created in Phase 5 when the sandbox factory
 * is updated to support this strategy.
 */

export interface StaticPreviewConfig {
	/** Temporary directory for builds */
	buildDir: string;
	/** Port to serve previews on (auto-assigned if 0) */
	port: number;
	/** Base URL for preview URLs */
	baseUrl: string;
}

export interface StaticPreviewResult {
	url: string;
	buildDir: string;
	cleanup: () => Promise<void>;
}

/**
 * Builds a Vite project in a temp directory and returns a URL to the output.
 * The actual serve step uses sirv or a minimal HTTP file server.
 */
export interface StaticPreviewProvider {
	/** Check if a blueprint can be served statically (no backend) */
	canHandleStatic(blueprint: { hasBackend?: boolean; template?: string }): boolean;

	/** Build and serve a static preview */
	buildAndServe(
		files: Map<string, string>,
		config?: Partial<StaticPreviewConfig>,
	): Promise<StaticPreviewResult>;

	/** Stop a running preview */
	stop(buildDir: string): Promise<void>;
}
