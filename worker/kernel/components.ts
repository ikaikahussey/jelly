/**
 * Kernel Components Service
 * Manages reusable components extracted from generated apps.
 * Components are ES module bundles stored in R2 with metadata in D1.
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, and, sql, desc, like } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';
import { createLogger } from '../logger';

const logger = createLogger('KernelComponents');

export interface ComponentInterface {
    provides: string[];
    consumes: string[];
}

export interface CreateComponentParams {
    ownerId: string;
    name: string;
    description?: string;
    r2BundleKey: string;
    interfaceSpec?: ComponentInterface;
    sourceAppId?: string;
}

export interface ComponentWithOwner extends schema.KernelComponent {
    ownerName?: string | null;
}

export class KernelComponentsService extends BaseService {

    /**
     * Register a new component in the registry.
     */
    async create(params: CreateComponentParams): Promise<schema.KernelComponent> {
        const now = Date.now();
        const [component] = await this.database
            .insert(schema.kernelComponents)
            .values({
                componentId: generateId(),
                ownerId: params.ownerId,
                name: params.name,
                description: params.description ?? null,
                r2BundleKey: params.r2BundleKey,
                interfaceJson: params.interfaceSpec
                    ? JSON.stringify(params.interfaceSpec)
                    : null,
                sourceAppId: params.sourceAppId ?? null,
                listingId: null,
                createdAt: now,
                updatedAt: now,
            })
            .returning();
        return component;
    }

    /**
     * Get a component by ID with owner info.
     */
    async get(componentId: string): Promise<ComponentWithOwner | null> {
        const rows = await this.getReadDb()
            .select({
                componentId: schema.kernelComponents.componentId,
                ownerId: schema.kernelComponents.ownerId,
                name: schema.kernelComponents.name,
                description: schema.kernelComponents.description,
                r2BundleKey: schema.kernelComponents.r2BundleKey,
                interfaceJson: schema.kernelComponents.interfaceJson,
                sourceAppId: schema.kernelComponents.sourceAppId,
                listingId: schema.kernelComponents.listingId,
                createdAt: schema.kernelComponents.createdAt,
                updatedAt: schema.kernelComponents.updatedAt,
                ownerName: schema.kernelUsers.displayName,
            })
            .from(schema.kernelComponents)
            .leftJoin(schema.kernelUsers, eq(schema.kernelComponents.ownerId, schema.kernelUsers.userId))
            .where(eq(schema.kernelComponents.componentId, componentId))
            .limit(1);

        if (rows.length === 0) return null;
        return rows[0] as ComponentWithOwner;
    }

    /**
     * Update a component (owner only).
     */
    async update(componentId: string, ownerId: string, updates: {
        name?: string;
        description?: string;
        r2BundleKey?: string;
        interfaceSpec?: ComponentInterface;
    }): Promise<schema.KernelComponent | null> {
        const set: Record<string, unknown> = { updatedAt: Date.now() };
        if (updates.name !== undefined) set.name = updates.name;
        if (updates.description !== undefined) set.description = updates.description;
        if (updates.r2BundleKey !== undefined) set.r2BundleKey = updates.r2BundleKey;
        if (updates.interfaceSpec !== undefined) {
            set.interfaceJson = JSON.stringify(updates.interfaceSpec);
        }

        const [updated] = await this.database
            .update(schema.kernelComponents)
            .set(set)
            .where(and(
                eq(schema.kernelComponents.componentId, componentId),
                eq(schema.kernelComponents.ownerId, ownerId)
            ))
            .returning();

        return updated ?? null;
    }

    /**
     * Delete a component (owner only).
     */
    async delete(componentId: string, ownerId: string): Promise<boolean> {
        const result = await this.database
            .delete(schema.kernelComponents)
            .where(and(
                eq(schema.kernelComponents.componentId, componentId),
                eq(schema.kernelComponents.ownerId, ownerId)
            ))
            .returning();
        return result.length > 0;
    }

    /**
     * Search components by name or description.
     * Used by the AI agent to find reusable components.
     */
    async search(params: {
        query?: string;
        ownerId?: string;
        limit?: number;
        cursor?: string;
    } = {}): Promise<{ components: ComponentWithOwner[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 20, 100);
        const conditions: (ReturnType<typeof eq>)[] = [];

        if (params.query) {
            conditions.push(
                sql`(${schema.kernelComponents.name} LIKE ${'%' + params.query + '%'} OR ${schema.kernelComponents.description} LIKE ${'%' + params.query + '%'})` as ReturnType<typeof eq>
            );
        }

        if (params.ownerId) {
            conditions.push(eq(schema.kernelComponents.ownerId, params.ownerId));
        }

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(
                    sql`${schema.kernelComponents.createdAt} < ${cursorTs}` as ReturnType<typeof eq>
                );
            }
        }

        const where = this.buildWhereConditions(conditions);

        const rows = await this.getReadDb()
            .select({
                componentId: schema.kernelComponents.componentId,
                ownerId: schema.kernelComponents.ownerId,
                name: schema.kernelComponents.name,
                description: schema.kernelComponents.description,
                r2BundleKey: schema.kernelComponents.r2BundleKey,
                interfaceJson: schema.kernelComponents.interfaceJson,
                sourceAppId: schema.kernelComponents.sourceAppId,
                listingId: schema.kernelComponents.listingId,
                createdAt: schema.kernelComponents.createdAt,
                updatedAt: schema.kernelComponents.updatedAt,
                ownerName: schema.kernelUsers.displayName,
            })
            .from(schema.kernelComponents)
            .leftJoin(schema.kernelUsers, eq(schema.kernelComponents.ownerId, schema.kernelUsers.userId))
            .where(where)
            .orderBy(desc(schema.kernelComponents.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (rows.length > limit) {
            rows.pop();
            const last = rows[rows.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { components: rows as ComponentWithOwner[], cursor: nextCursor };
    }

    /**
     * Link a listing to a component for monetization.
     */
    async linkListing(componentId: string, ownerId: string, listingId: string): Promise<boolean> {
        const result = await this.database
            .update(schema.kernelComponents)
            .set({ listingId, updatedAt: Date.now() })
            .where(and(
                eq(schema.kernelComponents.componentId, componentId),
                eq(schema.kernelComponents.ownerId, ownerId)
            ))
            .returning();
        return result.length > 0;
    }

    /**
     * Get components from a specific source app.
     */
    async getBySourceApp(sourceAppId: string): Promise<schema.KernelComponent[]> {
        return this.getReadDb()
            .select()
            .from(schema.kernelComponents)
            .where(eq(schema.kernelComponents.sourceAppId, sourceAppId))
            .orderBy(desc(schema.kernelComponents.createdAt));
    }
}
