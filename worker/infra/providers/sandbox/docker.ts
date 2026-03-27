/**
 * Docker Sandbox Provider
 *
 * Full container-based sandbox for apps with server-side code.
 * Uses the Docker Engine API (via Dockerode) to manage containers.
 *
 * Selection criteria: Used when the project blueprint has backend code
 * (Express, FastAPI, Flask, etc.) -- determined by the sandbox factory.
 *
 * This is a provider-level type definition. The full BaseSandboxService
 * implementation will be created in Phase 5 when the sandbox factory
 * is updated to support the Docker strategy.
 */

export interface DockerSandboxConfig {
	/** Docker socket path (default: /var/run/docker.sock) */
	socketPath: string;
	/** Base image for sandbox containers */
	baseImage: string;
	/** Port range for container port mapping */
	portRange: { min: number; max: number };
	/** Container resource limits */
	limits: {
		memoryMb: number;
		cpuShares: number;
		timeoutMs: number;
	};
}

export interface DockerSandboxInstance {
	containerId: string;
	port: number;
	url: string;
	cleanup: () => Promise<void>;
}

/**
 * Manages Docker containers for full-stack app sandboxing.
 * Handles container lifecycle, port allocation, and cleanup.
 */
export interface DockerSandboxProvider {
	/** Create and start a new sandbox container */
	create(
		files: Map<string, string>,
		config?: Partial<DockerSandboxConfig>,
	): Promise<DockerSandboxInstance>;

	/** Execute a command inside a running container */
	exec(containerId: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;

	/** Stop and remove a container */
	destroy(containerId: string): Promise<void>;

	/** List active sandbox containers */
	list(): Promise<DockerSandboxInstance[]>;
}
