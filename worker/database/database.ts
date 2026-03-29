/**
 * Core Database Service
 * Provides database connection, core utilities, and base operations∂ƒ
 */

import { drizzle } from 'drizzle-orm/d1';
import * as Sentry from '@sentry/cloudflare';
import * as schema from './schema';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

import type { HealthStatusResult } from './types';

// ========================================
// TYPE DEFINITIONS AND INTERFACES
// ========================================

export type {
    User, NewUser, Session, NewSession,
    App, NewApp,
    AppLike, NewAppLike, AppComment, NewAppComment,
    AppView, NewAppView, OAuthState, NewOAuthState,
    SystemSetting, NewSystemSetting,
    UserModelConfig, NewUserModelConfig,
} from './schema';


/**
 * Core Database Service - Connection and Base Operations
 *
 * Provides database connection, shared utilities, and core operations.
 * Domain-specific operations are handled by dedicated service classes.
 */
export class DatabaseService {
    // Using 'any' for db type to support both D1 and better-sqlite3 Drizzle instances
    public readonly db: DrizzleD1Database<typeof schema>;
    private readonly d1: D1Database | null;
    private readonly enableReplicas: boolean;

    constructor(env: Env) {
        const runtime = (env as Record<string, unknown>).JELLY_RUNTIME as string | undefined;
        if (runtime === 'local' || runtime === 'docker') {
            // On portable runtimes, use the pre-initialized Drizzle instance from env.__DRIZZLE_DB
            const drizzleDb = (env as Record<string, unknown>).__DRIZZLE_DB;
            if (!drizzleDb) {
                throw new Error('DatabaseService: __DRIZZLE_DB not found in env. Ensure server/index.ts initializes the database.');
            }
            this.db = drizzleDb as DrizzleD1Database<typeof schema>;
            this.d1 = null;
            this.enableReplicas = false;
        } else {
            const instrumented = Sentry.instrumentD1WithSentry(env.DB);
            this.d1 = instrumented;
            this.db = drizzle(instrumented, { schema });
            this.enableReplicas = env.ENABLE_READ_REPLICAS === 'true';
        }
    }

    /**
     * Get a read-optimized database connection using D1 Sessions API
     * This routes queries to read replicas for lower global latency
     * 
     * @param strategy - Session strategy:
     *   - 'fast' (default): Routes to any replica for lowest latency
     *   - 'fresh': Routes first query to primary for latest data
     * @returns Drizzle database instance configured for read operations
     */
    public getReadDb(strategy: 'fast' | 'fresh' = 'fast'): DrizzleD1Database<typeof schema> {
        // Return regular db if replicas are disabled or no D1 binding (local runtime)
        if (!this.enableReplicas || !this.d1) {
            return this.db;
        }

        const sessionType = strategy === 'fresh' ? 'first-primary' : 'first-unconstrained';
        const session = this.d1.withSession(sessionType);
        // D1DatabaseSession is compatible with D1Database for Drizzle operations
        return drizzle(session as unknown as D1Database, { schema });
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async getHealthStatus(): Promise<HealthStatusResult> {
        try {
            await this.db.select().from(schema.systemSettings).limit(1);
            return {
                healthy: true,
                timestamp: new Date().toISOString(),
            };
        } catch (error) {
            return {
                healthy: false,
                timestamp: new Date().toISOString(),
            };
        }
    }
}

/**
 * Factory function to create database service instance
 */
export function createDatabaseService(env: Env): DatabaseService {
    return new DatabaseService(env);
}