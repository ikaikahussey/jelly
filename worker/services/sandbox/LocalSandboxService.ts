/**
 * Local Sandbox Service
 *
 * BaseSandboxService implementation for non-Cloudflare runtimes.
 * Uses the local filesystem for file operations and child_process
 * for command execution.
 */

import {
	BootstrapResponse,
	BootstrapStatusResponse,
	ShutdownResponse,
	WriteFilesRequest,
	WriteFilesResponse,
	GetFilesResponse,
	ExecuteCommandsResponse,
	RuntimeErrorResponse,
	ClearErrorsResponse,
	StaticAnalysisResponse,
	DeploymentResult,
	GetInstanceResponse,
	GetLogsResponse,
	ListInstancesResponse,
	InstanceCreationRequest,
	RuntimeError,
} from './sandboxTypes';
import { BaseSandboxService } from './BaseSandboxService';
import { DeploymentTarget } from 'worker/agents/core/types';

interface LocalInstance {
	id: string;
	projectDir: string;
	projectName: string;
	logs: { stdout: string; stderr: string };
	errors: RuntimeError[];
	createdAt: Date;
}

export class LocalSandboxService extends BaseSandboxService {
	private dataDir: string;
	private instances = new Map<string, LocalInstance>();

	constructor(sandboxId: string, env?: Record<string, unknown>) {
		super(sandboxId, env);
		this.dataDir = (env?.JELLY_DATA_DIR as string) || './data';
	}

	async initialize(): Promise<void> {
		const { mkdir } = await import('node:fs/promises');
		await mkdir(`${this.dataDir}/sandboxes`, { recursive: true });
	}

	async createInstance(options: InstanceCreationRequest): Promise<BootstrapResponse> {
		const { mkdir } = await import('node:fs/promises');
		const instanceId = `local-${Date.now()}`;
		const projectDir = `${this.dataDir}/sandboxes/${instanceId}`;
		await mkdir(projectDir, { recursive: true });

		const instance: LocalInstance = {
			id: instanceId,
			projectDir,
			projectName: options.projectName,
			logs: { stdout: '', stderr: '' },
			errors: [],
			createdAt: new Date(),
		};

		this.instances.set(instanceId, instance);

		return {
			success: true,
			runId: instanceId,
		};
	}

	async listAllInstances(): Promise<ListInstancesResponse> {
		const instances = Array.from(this.instances.values()).map((i) => ({
			runId: i.id,
			directory: i.projectDir,
			serviceDirectory: i.projectDir,
			startTime: i.createdAt.toISOString(),
			uptime: Math.floor((Date.now() - i.createdAt.getTime()) / 1000),
		}));

		return {
			success: true,
			instances,
			count: instances.length,
		};
	}

	async getInstanceDetails(instanceId: string): Promise<GetInstanceResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, error: `Instance ${instanceId} not found` };
		}
		return {
			success: true,
			instance: {
				runId: instance.id,
				directory: instance.projectDir,
				serviceDirectory: instance.projectDir,
				startTime: instance.createdAt.toISOString(),
				uptime: Math.floor((Date.now() - instance.createdAt.getTime()) / 1000),
			},
		};
	}

	async getInstanceStatus(instanceId: string): Promise<BootstrapStatusResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, pending: false, isHealthy: false, error: `Instance ${instanceId} not found` };
		}
		return {
			success: true,
			pending: false,
			isHealthy: true,
			message: 'Instance ready',
		};
	}

	async shutdownInstance(instanceId: string): Promise<ShutdownResponse> {
		this.instances.delete(instanceId);
		return { success: true, message: `Instance ${instanceId} shut down` };
	}

	async writeFiles(
		instanceId: string,
		files: WriteFilesRequest['files'],
		_commitMessage?: string,
	): Promise<WriteFilesResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, results: [], error: `Instance ${instanceId} not found` };
		}

		const { writeFile, mkdir } = await import('node:fs/promises');
		const { dirname, join } = await import('node:path');
		const results: Array<{ file: string; success: boolean; error?: string }> = [];

		for (const file of files) {
			try {
				const fullPath = join(instance.projectDir, file.filePath);
				if (!fullPath.startsWith(instance.projectDir)) {
					results.push({ file: file.filePath, success: false, error: 'Path traversal' });
					continue;
				}
				await mkdir(dirname(fullPath), { recursive: true });
				await writeFile(fullPath, file.fileContents, 'utf-8');
				results.push({ file: file.filePath, success: true });
			} catch (err) {
				results.push({ file: file.filePath, success: false, error: String(err) });
			}
		}

		return { success: true, results };
	}

	async getFiles(instanceId: string, filePaths?: string[]): Promise<GetFilesResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, files: [], error: `Instance ${instanceId} not found` };
		}

		const { readFile } = await import('node:fs/promises');
		const { join } = await import('node:path');
		const files: Array<{ filePath: string; fileContents: string }> = [];

		if (filePaths) {
			for (const fp of filePaths) {
				try {
					const fullPath = join(instance.projectDir, fp);
					if (!fullPath.startsWith(instance.projectDir)) continue;
					const content = await readFile(fullPath, 'utf-8');
					files.push({ filePath: fp, fileContents: content });
				} catch {
					// File not found
				}
			}
		}

		return { success: true, files };
	}

	async getLogs(instanceId: string, _onlyRecent?: boolean, _durationSeconds?: number): Promise<GetLogsResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, logs: { stdout: '', stderr: '' }, error: `Instance ${instanceId} not found` };
		}
		return { success: true, logs: instance.logs };
	}

	async executeCommands(
		instanceId: string,
		commands: string[],
		timeout?: number,
	): Promise<ExecuteCommandsResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, results: [], error: `Instance ${instanceId} not found` };
		}

		const { execSync } = await import('node:child_process');
		const results: Array<{ command: string; success: boolean; output: string; error?: string; exitCode?: number }> = [];

		for (const cmd of commands) {
			try {
				const output = execSync(cmd, {
					cwd: instance.projectDir,
					timeout: timeout || 30000,
					encoding: 'utf-8',
					stdio: ['pipe', 'pipe', 'pipe'],
				});
				instance.logs.stdout += `$ ${cmd}\n${output}\n`;
				results.push({ command: cmd, success: true, output, exitCode: 0 });
			} catch (err: unknown) {
				const execErr = err as { stdout?: string; stderr?: string; status?: number };
				const stderr = execErr.stderr || String(err);
				instance.logs.stderr += `$ ${cmd}\n${stderr}\n`;
				results.push({
					command: cmd,
					success: false,
					output: execErr.stdout || '',
					error: stderr,
					exitCode: execErr.status ?? 1,
				});
			}
		}

		return { success: true, results };
	}

	async updateProjectName(instanceId: string, projectName: string): Promise<boolean> {
		const instance = this.instances.get(instanceId);
		if (instance) instance.projectName = projectName;
		return true;
	}

	async getInstanceErrors(instanceId: string, clear?: boolean): Promise<RuntimeErrorResponse> {
		const instance = this.instances.get(instanceId);
		if (!instance) {
			return { success: false, errors: [], hasErrors: false, error: `Instance ${instanceId} not found` };
		}
		const errors = [...instance.errors];
		if (clear) instance.errors = [];
		return { success: true, errors, hasErrors: errors.length > 0 };
	}

	async clearInstanceErrors(instanceId: string): Promise<ClearErrorsResponse> {
		const instance = this.instances.get(instanceId);
		if (instance) instance.errors = [];
		return { success: true, message: 'Errors cleared' };
	}

	async runStaticAnalysisCode(_instanceId: string, _lintFiles?: string[]): Promise<StaticAnalysisResponse> {
		return {
			success: true,
			lint: { issues: [] },
			typecheck: { issues: [] },
		};
	}

	async deployToCloudflareWorkers(_instanceId: string, _target?: DeploymentTarget): Promise<DeploymentResult> {
		return {
			success: false,
			message: 'Cloudflare Workers deployment is not available on local runtime.',
		};
	}
}
