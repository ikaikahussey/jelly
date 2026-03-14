/**
 * Kernel Dashboard Service
 * Queries for "Apps I Use" and App Registry browsing.
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, and, sql, desc, ne } from 'drizzle-orm';

export interface AppAccessEntry {
    userId: string;
    appId: string;
    role: string;
    pinned: number | null;
    firstAccessedAt: number;
    lastAccessedAt: number;
    // Joined from app registry
    title?: string;
    description?: string | null;
    thumbnailR2Key?: string | null;
    subdomain?: string | null;
}

export interface AppRegistryEntry {
    appId: string;
    ownerId: string;
    title: string;
    description: string | null;
    visibility: string;
    thumbnailR2Key: string | null;
    subdomain: string | null;
    listingId: string | null;
    forkedFrom: string | null;
    deployedAt: number | null;
    createdAt: number;
    // Joined owner info
    ownerName?: string | null;
}

export class KernelDashboardService extends BaseService {

    /**
     * Get apps the user has accessed ("Apps I Use"), ordered by last access.
     */
    async getAppsIUse(userId: string, params: {
        limit?: number;
        cursor?: string;
        pinnedOnly?: boolean;
    } = {}): Promise<{ apps: AppAccessEntry[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 20, 100);
        const conditions = [
            eq(schema.kernelUserAppAccess.userId, userId),
        ];

        if (params.pinnedOnly) {
            conditions.push(eq(schema.kernelUserAppAccess.pinned, 1));
        }

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelUserAppAccess.lastAccessedAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const rows = await this.getReadDb()
            .select({
                userId: schema.kernelUserAppAccess.userId,
                appId: schema.kernelUserAppAccess.appId,
                role: schema.kernelUserAppAccess.role,
                pinned: schema.kernelUserAppAccess.pinned,
                firstAccessedAt: schema.kernelUserAppAccess.firstAccessedAt,
                lastAccessedAt: schema.kernelUserAppAccess.lastAccessedAt,
                title: schema.kernelAppRegistry.title,
                description: schema.kernelAppRegistry.description,
                thumbnailR2Key: schema.kernelAppRegistry.thumbnailR2Key,
                subdomain: schema.kernelAppRegistry.subdomain,
            })
            .from(schema.kernelUserAppAccess)
            .leftJoin(
                schema.kernelAppRegistry,
                eq(schema.kernelUserAppAccess.appId, schema.kernelAppRegistry.appId)
            )
            .where(where)
            .orderBy(desc(schema.kernelUserAppAccess.lastAccessedAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (rows.length > limit) {
            rows.pop();
            const last = rows[rows.length - 1];
            nextCursor = String(last.lastAccessedAt);
        }

        return { apps: rows, cursor: nextCursor };
    }

    /**
     * Pin or unpin an app
     */
    async togglePin(userId: string, appId: string, pinned: boolean): Promise<void> {
        await this.database
            .update(schema.kernelUserAppAccess)
            .set({ pinned: pinned ? 1 : 0 })
            .where(
                and(
                    eq(schema.kernelUserAppAccess.userId, userId),
                    eq(schema.kernelUserAppAccess.appId, appId)
                )
            );
    }

    /**
     * Browse public app registry
     */
    async browseRegistry(params: {
        search?: string;
        limit?: number;
        cursor?: string;
    } = {}): Promise<{ apps: AppRegistryEntry[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 20, 100);
        const conditions = [
            eq(schema.kernelAppRegistry.visibility, 'public'),
        ];

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelAppRegistry.createdAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const rows = await this.getReadDb()
            .select({
                appId: schema.kernelAppRegistry.appId,
                ownerId: schema.kernelAppRegistry.ownerId,
                title: schema.kernelAppRegistry.title,
                description: schema.kernelAppRegistry.description,
                visibility: schema.kernelAppRegistry.visibility,
                thumbnailR2Key: schema.kernelAppRegistry.thumbnailR2Key,
                subdomain: schema.kernelAppRegistry.subdomain,
                listingId: schema.kernelAppRegistry.listingId,
                forkedFrom: schema.kernelAppRegistry.forkedFrom,
                deployedAt: schema.kernelAppRegistry.deployedAt,
                createdAt: schema.kernelAppRegistry.createdAt,
                ownerName: schema.kernelUsers.displayName,
            })
            .from(schema.kernelAppRegistry)
            .leftJoin(
                schema.kernelUsers,
                eq(schema.kernelAppRegistry.ownerId, schema.kernelUsers.userId)
            )
            .where(where)
            .orderBy(desc(schema.kernelAppRegistry.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (rows.length > limit) {
            rows.pop();
            const last = rows[rows.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { apps: rows, cursor: nextCursor };
    }

    /**
     * Register an app in the registry (called when deploying)
     */
    async registerApp(data: {
        appId: string;
        ownerId: string;
        title: string;
        description?: string;
        visibility?: string;
        subdomain?: string;
    }): Promise<schema.KernelAppRegistryEntry> {
        const now = Date.now();
        const [entry] = await this.database
            .insert(schema.kernelAppRegistry)
            .values({
                appId: data.appId,
                ownerId: data.ownerId,
                title: data.title,
                description: data.description ?? null,
                visibility: data.visibility ?? 'private',
                subdomain: data.subdomain ?? null,
                deployedAt: now,
                createdAt: now,
            })
            .onConflictDoUpdate({
                target: schema.kernelAppRegistry.appId,
                set: {
                    title: data.title,
                    description: data.description ?? null,
                    visibility: data.visibility ?? 'private',
                    deployedAt: now,
                },
            })
            .returning();
        return entry;
    }
}
