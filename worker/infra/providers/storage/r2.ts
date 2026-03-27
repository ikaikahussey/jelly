/**
 * R2 Storage Provider
 *
 * Wraps Cloudflare R2 bucket access for binary object storage.
 */

import type { StorageProvider, StorageObject, StoragePutOptions } from '../../types';

export class R2StorageProvider implements StorageProvider {
	private readonly bucket: R2Bucket;
	private readonly publicUrlBase: string;

	constructor(env: Record<string, unknown>) {
		this.bucket = env.TEMPLATES_BUCKET as R2Bucket;
		const domain = (env.CUSTOM_DOMAIN as string) || '';
		this.publicUrlBase = domain ? `https://${domain}/storage` : '';
	}

	async get(key: string): Promise<StorageObject | null> {
		const obj = await this.bucket.get(key);
		if (!obj) return null;

		return {
			body: obj.body,
			contentType: obj.httpMetadata?.contentType,
			size: obj.size,
		};
	}

	async put(key: string, data: ArrayBuffer | ReadableStream, options?: StoragePutOptions): Promise<void> {
		await this.bucket.put(key, data, {
			httpMetadata: options?.contentType ? { contentType: options.contentType } : undefined,
			customMetadata: options?.customMetadata,
		});
	}

	async delete(key: string): Promise<void> {
		await this.bucket.delete(key);
	}

	getPublicUrl(key: string): string {
		return `${this.publicUrlBase}/${key}`;
	}
}
