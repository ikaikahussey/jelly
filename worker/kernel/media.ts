/**
 * Kernel Media Service - Upload, serve, and delete media files via R2.
 * Tracks metadata in D1 for access control and listing.
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB default

const ALLOWED_CONTENT_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'video/mp4',
    'video/webm',
    'video/ogg',
]);

export interface MediaUploadResult {
    key: string;
    url: string;
    size: number;
    contentType: string;
}

export interface MediaRecord {
    key: string;
    ownerId: string;
    contentType: string;
    size: number;
    filename: string | null;
    createdAt: number;
}

export class KernelMediaService extends BaseService {
    private getBucket(): R2Bucket {
        if (!this.env.MEDIA_BUCKET) {
            throw new Error('MEDIA_BUCKET R2 binding is not configured');
        }
        return this.env.MEDIA_BUCKET;
    }

    /**
     * Upload a file to R2 and record metadata in D1
     */
    async upload(
        ownerId: string,
        file: ArrayBuffer,
        contentType: string,
        filename: string | null
    ): Promise<MediaUploadResult> {
        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            throw new MediaValidationError(`Content type '${contentType}' is not allowed`);
        }

        const maxSize = parseInt(
            String((this.env as Env & { MAX_MEDIA_SIZE?: string }).MAX_MEDIA_SIZE ?? MAX_FILE_SIZE),
            10
        );
        if (file.byteLength > maxSize) {
            throw new MediaValidationError(
                `File size ${file.byteLength} exceeds maximum ${maxSize} bytes`
            );
        }

        const key = `media/${ownerId}/${generateId()}`;
        const bucket = this.getBucket();

        await bucket.put(key, file, {
            httpMetadata: { contentType },
            customMetadata: {
                ownerId,
                ...(filename ? { filename } : {}),
            },
        });

        const now = Date.now();
        await this.database
            .insert(schema.kernelMedia)
            .values({
                key,
                ownerId,
                contentType,
                size: file.byteLength,
                filename: filename ?? null,
                createdAt: now,
            });

        return {
            key,
            url: `/api/kernel/media/${encodeURIComponent(key)}`,
            size: file.byteLength,
            contentType,
        };
    }

    /**
     * Retrieve a file from R2. Returns null if not found.
     */
    async serve(key: string): Promise<{ body: ReadableStream; contentType: string; size: number } | null> {
        const bucket = this.getBucket();
        const object = await bucket.get(key);
        if (!object) return null;

        return {
            body: object.body,
            contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
            size: object.size,
        };
    }

    /**
     * Delete a file from R2 and D1 (owner only)
     */
    async delete(key: string, requesterId: string): Promise<boolean> {
        // Verify ownership
        const rows = await this.getReadDb()
            .select({ ownerId: schema.kernelMedia.ownerId })
            .from(schema.kernelMedia)
            .where(eq(schema.kernelMedia.key, key))
            .limit(1);

        if (rows.length === 0) return false;
        if (rows[0].ownerId !== requesterId) return false;

        const bucket = this.getBucket();
        await bucket.delete(key);

        await this.database
            .delete(schema.kernelMedia)
            .where(eq(schema.kernelMedia.key, key));

        return true;
    }

    /**
     * List media files for an owner
     */
    async listByOwner(
        ownerId: string,
        params: { limit?: number; cursor?: string }
    ): Promise<{ items: MediaRecord[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 50, 100);
        const conditions = [eq(schema.kernelMedia.ownerId, ownerId)];

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelMedia.createdAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const rows = await this.getReadDb()
            .select()
            .from(schema.kernelMedia)
            .where(where)
            .orderBy(desc(schema.kernelMedia.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (rows.length > limit) {
            rows.pop();
            const last = rows[rows.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { items: rows, cursor: nextCursor };
    }
}

export class MediaValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'MediaValidationError';
    }
}
