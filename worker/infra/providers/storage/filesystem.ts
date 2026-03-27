/**
 * Filesystem Storage Provider
 *
 * Stores binary objects on the local filesystem under {dataDir}/storage/.
 * Metadata (content type, custom metadata) stored in a companion .meta.json file.
 *
 * Only loaded when JELLY_RUNTIME !== 'cloudflare'.
 */

import type { StorageProvider, StorageObject, StoragePutOptions } from '../../types';

interface StorageMeta {
	contentType?: string;
	size?: number;
	customMetadata?: Record<string, string>;
}

export class FileSystemStorageProvider implements StorageProvider {
	private readonly storageDir: string;
	private readonly baseUrl: string;

	constructor(dataDir: string, baseUrl?: string) {
		this.storageDir = `${dataDir}/storage`;
		this.baseUrl = baseUrl || 'http://localhost:3000/storage';
	}

	private filePath(key: string): string {
		// Sanitize key to prevent directory traversal
		const safe = key.replace(/\.\./g, '_');
		return `${this.storageDir}/${safe}`;
	}

	private metaPath(key: string): string {
		return `${this.filePath(key)}.meta.json`;
	}

	private async ensureDir(filePath: string): Promise<void> {
		const { mkdir } = await import('node:fs/promises');
		const { dirname } = await import('node:path');
		await mkdir(dirname(filePath), { recursive: true });
	}

	async get(key: string): Promise<StorageObject | null> {
		const { readFile } = await import('node:fs/promises');

		try {
			const data = await readFile(this.filePath(key));
			let meta: StorageMeta = {};
			try {
				const metaRaw = await readFile(this.metaPath(key), 'utf-8');
				meta = JSON.parse(metaRaw) as StorageMeta;
			} catch {
				// No metadata file -- that's fine
			}

			return {
				body: data.buffer as ArrayBuffer,
				contentType: meta.contentType,
				size: data.byteLength,
			};
		} catch {
			return null;
		}
	}

	async put(key: string, data: ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
		const { writeFile } = await import('node:fs/promises');
		const path = this.filePath(key);
		await this.ensureDir(path);

		let buffer: Buffer;
		if (data instanceof ArrayBuffer) {
			buffer = Buffer.from(data);
		} else {
			// ReadableStream -> Buffer
			const chunks: Uint8Array[] = [];
			const reader = (data as ReadableStream<Uint8Array>).getReader();
			let done = false;
			while (!done) {
				const result = await reader.read();
				done = result.done;
				if (result.value) chunks.push(result.value);
			}
			buffer = Buffer.concat(chunks);
		}

		await writeFile(path, buffer);

		const meta: StorageMeta = {
			contentType: options?.contentType,
			size: buffer.byteLength,
			customMetadata: options?.customMetadata,
		};
		await writeFile(this.metaPath(key), JSON.stringify(meta));
	}

	async delete(key: string): Promise<void> {
		const { unlink } = await import('node:fs/promises');
		try {
			await unlink(this.filePath(key));
			await unlink(this.metaPath(key));
		} catch {
			// File may not exist
		}
	}

	getPublicUrl(key: string): string {
		return `${this.baseUrl}/${key}`;
	}
}
