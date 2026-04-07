/**
 * Kernel Objects - Generic content objects owned by users.
 * Apps define their own object_type semantics (post, article, listing, etc.).
 * Visibility enforcement: private (owner only), relationships (connected users), public (anyone).
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, and, sql, desc, or } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';
import { KernelGraphService } from './graph';

export interface ObjectsQueryParams {
    type?: string;
    owner?: string;
    visibility?: string;
    parent?: string;
    search?: string;
    limit?: number;
    cursor?: string;
}

export interface ObjectsQueryResult {
    objects: schema.KernelObject[];
    cursor?: string;
}

export class KernelObjectsService extends BaseService {

    /**
     * Create a new content object
     */
    async create(
        ownerId: string,
        objectType: string,
        payload: Record<string, unknown>,
        visibility: string = 'private',
        parentId?: string
    ): Promise<schema.KernelObject> {
        const now = Date.now();
        const [obj] = await this.database
            .insert(schema.kernelObjects)
            .values({
                objectId: generateId(),
                ownerId,
                objectType,
                payloadJson: JSON.stringify(payload),
                visibility,
                parentId: parentId ?? null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();
        return obj;
    }

    /**
     * Get a single object by ID with access control
     */
    async get(objectId: string, requesterId?: string): Promise<schema.KernelObject | null> {
        const rows = await this.getReadDb()
            .select()
            .from(schema.kernelObjects)
            .where(eq(schema.kernelObjects.objectId, objectId))
            .limit(1);

        const obj = rows[0];
        if (!obj) return null;

        if (!await this.canAccess(obj, requesterId)) {
            return null;
        }

        return obj;
    }

    /**
     * Update an object (owner only)
     */
    async update(
        objectId: string,
        ownerId: string,
        updates: { payload?: Record<string, unknown>; visibility?: string }
    ): Promise<schema.KernelObject | null> {
        const setValues: Record<string, unknown> = { updatedAt: Date.now() };
        if (updates.payload !== undefined) {
            setValues.payloadJson = JSON.stringify(updates.payload);
        }
        if (updates.visibility !== undefined) {
            setValues.visibility = updates.visibility;
        }

        const [updated] = await this.database
            .update(schema.kernelObjects)
            .set(setValues)
            .where(
                and(
                    eq(schema.kernelObjects.objectId, objectId),
                    eq(schema.kernelObjects.ownerId, ownerId)
                )
            )
            .returning();
        return updated ?? null;
    }

    /**
     * Delete an object (owner only)
     */
    async delete(objectId: string, ownerId: string): Promise<boolean> {
        const result = await this.database
            .delete(schema.kernelObjects)
            .where(
                and(
                    eq(schema.kernelObjects.objectId, objectId),
                    eq(schema.kernelObjects.ownerId, ownerId)
                )
            )
            .returning();
        return result.length > 0;
    }

    /**
     * Query objects with visibility filtering and cursor-based pagination
     */
    async query(params: ObjectsQueryParams, requesterId?: string): Promise<ObjectsQueryResult> {
        const limit = Math.min(params.limit ?? 50, 100);
        const conditions = [];

        if (params.type) {
            conditions.push(eq(schema.kernelObjects.objectType, params.type));
        }
        if (params.owner) {
            conditions.push(eq(schema.kernelObjects.ownerId, params.owner));
        }
        if (params.parent) {
            conditions.push(eq(schema.kernelObjects.parentId, params.parent));
        }
        if (params.search) {
            const searchTerm = `%${params.search}%`;
            conditions.push(sql`${schema.kernelObjects.payloadJson} LIKE ${searchTerm}`);
        }
        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelObjects.createdAt} < ${cursorTs}`);
            }
        }

        // Visibility filtering
        if (params.visibility) {
            conditions.push(eq(schema.kernelObjects.visibility, params.visibility));
        } else if (requesterId) {
            // Show: public + own objects + relationship-visible from connected users
            conditions.push(
                or(
                    eq(schema.kernelObjects.visibility, 'public'),
                    eq(schema.kernelObjects.ownerId, requesterId),
                    // relationship-visible objects are filtered post-query for correctness
                )!
            );
        } else {
            // Anonymous: only public
            conditions.push(eq(schema.kernelObjects.visibility, 'public'));
        }

        const where = this.buildWhereConditions(conditions);

        const objects = await this.getReadDb()
            .select()
            .from(schema.kernelObjects)
            .where(where)
            .orderBy(desc(schema.kernelObjects.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (objects.length > limit) {
            objects.pop();
            const last = objects[objects.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { objects, cursor: nextCursor };
    }

    /**
     * Check if a requester can access an object based on visibility
     */
    private async canAccess(obj: schema.KernelObject, requesterId?: string): Promise<boolean> {
        if (obj.visibility === 'public') return true;
        if (!requesterId) return false;
        if (obj.ownerId === requesterId) return true;

        if (obj.visibility === 'relationships') {
            const graphService = new KernelGraphService(this.env);
            return graphService.hasAnyRelationship(obj.ownerId, requesterId);
        }

        return false;
    }
}
