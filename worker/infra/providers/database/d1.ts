/**
 * D1 Database Provider
 *
 * Wraps Cloudflare D1 with Drizzle ORM.
 * This is a thin adapter over the existing DatabaseService pattern.
 */

import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../../database/schema';
import type { DatabaseProvider } from '../../types';

export class D1DatabaseProvider implements DatabaseProvider {
	private readonly db;
	private readonly d1: D1Database;
	private readonly enableReplicas: boolean;

	constructor(env: Record<string, unknown>) {
		this.d1 = env.DB as D1Database;
		this.db = drizzle(this.d1, { schema });
		this.enableReplicas = (env.ENABLE_READ_REPLICAS as string) === 'true';
	}

	getDb(): unknown {
		return this.db;
	}

	getReadDb(strategy: 'fast' | 'fresh' = 'fast'): unknown {
		if (!this.enableReplicas) {
			return this.db;
		}
		const sessionType = strategy === 'fresh' ? 'first-primary' : 'first-unconstrained';
		const session = this.d1.withSession(sessionType);
		return drizzle(session as unknown as D1Database, { schema });
	}

	async getHealthStatus(): Promise<{ healthy: boolean; timestamp: string }> {
		try {
			const db = this.getDb() as ReturnType<typeof drizzle>;
			await db.select().from(schema.systemSettings).limit(1);
			return { healthy: true, timestamp: new Date().toISOString() };
		} catch {
			return { healthy: false, timestamp: new Date().toISOString() };
		}
	}
}
