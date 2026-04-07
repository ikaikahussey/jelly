/**
 * Kernel Graph - Relationship edges between users.
 * Directional, app-defined semantics (follow, friend, subscribe, blocked, etc.).
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, and, or, sql, desc } from 'drizzle-orm';

export interface GraphQueryParams {
    from?: string;
    to?: string;
    type?: string;
    limit?: number;
    cursor?: string; // created_at timestamp for cursor-based pagination
}

export interface GraphQueryResult {
    edges: schema.KernelRelationship[];
    cursor?: string;
}

export class KernelGraphService extends BaseService {

    /**
     * Create a relationship edge
     */
    async link(
        fromUser: string,
        toUser: string,
        relType: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        const now = Date.now();
        await this.database
            .insert(schema.kernelRelationships)
            .values({
                fromUser,
                toUser,
                relType,
                metadataJson: metadata ? JSON.stringify(metadata) : '{}',
                createdAt: now,
            })
            .onConflictDoUpdate({
                target: [
                    schema.kernelRelationships.fromUser,
                    schema.kernelRelationships.toUser,
                    schema.kernelRelationships.relType,
                ],
                set: {
                    metadataJson: metadata ? JSON.stringify(metadata) : '{}',
                },
            });
    }

    /**
     * Remove a relationship edge
     */
    async unlink(fromUser: string, toUser: string, relType: string): Promise<boolean> {
        const result = await this.database
            .delete(schema.kernelRelationships)
            .where(
                and(
                    eq(schema.kernelRelationships.fromUser, fromUser),
                    eq(schema.kernelRelationships.toUser, toUser),
                    eq(schema.kernelRelationships.relType, relType)
                )
            )
            .returning();
        return result.length > 0;
    }

    /**
     * Query relationships with cursor-based pagination
     */
    async query(params: GraphQueryParams): Promise<GraphQueryResult> {
        const limit = Math.min(params.limit ?? 50, 100);
        const conditions = [];

        if (params.from) {
            conditions.push(eq(schema.kernelRelationships.fromUser, params.from));
        }
        if (params.to) {
            conditions.push(eq(schema.kernelRelationships.toUser, params.to));
        }
        if (params.type) {
            conditions.push(eq(schema.kernelRelationships.relType, params.type));
        }
        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelRelationships.createdAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const edges = await this.getReadDb()
            .select()
            .from(schema.kernelRelationships)
            .where(where)
            .orderBy(desc(schema.kernelRelationships.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (edges.length > limit) {
            edges.pop();
            const last = edges[edges.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { edges, cursor: nextCursor };
    }

    /**
     * Check if a specific relationship exists
     */
    async hasRelationship(fromUser: string, toUser: string, relType?: string): Promise<boolean> {
        const conditions = [
            eq(schema.kernelRelationships.fromUser, fromUser),
            eq(schema.kernelRelationships.toUser, toUser),
        ];
        if (relType) {
            conditions.push(eq(schema.kernelRelationships.relType, relType));
        }

        const rows = await this.getReadDb()
            .select({ count: sql<number>`count(*)` })
            .from(schema.kernelRelationships)
            .where(and(...conditions));

        return (rows[0]?.count ?? 0) > 0;
    }

    /**
     * Check if any relationship exists between two users (either direction)
     */
    async hasAnyRelationship(userA: string, userB: string): Promise<boolean> {
        const rows = await this.getReadDb()
            .select({ count: sql<number>`count(*)` })
            .from(schema.kernelRelationships)
            .where(
                or(
                    and(
                        eq(schema.kernelRelationships.fromUser, userA),
                        eq(schema.kernelRelationships.toUser, userB)
                    ),
                    and(
                        eq(schema.kernelRelationships.fromUser, userB),
                        eq(schema.kernelRelationships.toUser, userA)
                    )
                )
            );

        return (rows[0]?.count ?? 0) > 0;
    }

    /**
     * Count edges from/to a node filtered by rel_type.
     * Direction is determined by which param is provided.
     */
    async countEdges(params: { from?: string; to?: string; type?: string }): Promise<number> {
        const conditions = [];
        if (params.from) {
            conditions.push(eq(schema.kernelRelationships.fromUser, params.from));
        }
        if (params.to) {
            conditions.push(eq(schema.kernelRelationships.toUser, params.to));
        }
        if (params.type) {
            conditions.push(eq(schema.kernelRelationships.relType, params.type));
        }

        const where = this.buildWhereConditions(conditions);

        const rows = await this.getReadDb()
            .select({ count: sql<number>`count(*)` })
            .from(schema.kernelRelationships)
            .where(where);

        return rows[0]?.count ?? 0;
    }

    /**
     * Batch check whether edges exist between a source node and multiple target nodes.
     * Returns a map of nodeId -> boolean.
     */
    async batchCheckEdges(
        fromUser: string,
        nodeIds: string[],
        relType: string
    ): Promise<Record<string, boolean>> {
        if (nodeIds.length === 0) return {};

        // Query all matching edges in a single call
        const edges = await this.getReadDb()
            .select({ toUser: schema.kernelRelationships.toUser })
            .from(schema.kernelRelationships)
            .where(
                and(
                    eq(schema.kernelRelationships.fromUser, fromUser),
                    eq(schema.kernelRelationships.relType, relType),
                    sql`${schema.kernelRelationships.toUser} IN (${sql.join(
                        nodeIds.map(id => sql`${id}`),
                        sql`, `
                    )})`
                )
            );

        const existingSet = new Set(edges.map(e => e.toUser));
        const result: Record<string, boolean> = {};
        for (const nodeId of nodeIds) {
            result[nodeId] = existingSet.has(nodeId);
        }
        return result;
    }
}
