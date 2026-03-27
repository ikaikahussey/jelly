/**
 * SQLite Database Provider
 *
 * Uses better-sqlite3 (Node) or bun:sqlite (Bun) with Drizzle ORM.
 * Database file lives at {dataDir}/jllly.sqlite.
 *
 * Note: The actual driver import is deferred to avoid bundling
 * native modules in the Cloudflare build. This file is only
 * loaded when JELLY_RUNTIME !== 'cloudflare'.
 */

import type { DatabaseProvider } from '../../types';

export class SqliteDatabaseProvider implements DatabaseProvider {
	private db: unknown = null;
	private readonly dbPath: string;

	constructor(dataDir: string) {
		this.dbPath = `${dataDir}/jllly.sqlite`;
	}

	/**
	 * Lazily initialize the database connection.
	 * Uses dynamic import to avoid pulling native deps into CF bundle.
	 */
	private async ensureDb(): Promise<unknown> {
		if (this.db) return this.db;

		// Dynamic import -- resolved at runtime, not bundle time
		const { default: Database } = await import('better-sqlite3');
		const { drizzle } = await import('drizzle-orm/better-sqlite3');
		const schema = await import('../../../database/schema');

		const sqlite = new Database(this.dbPath);
		sqlite.pragma('journal_mode = WAL');
		sqlite.pragma('foreign_keys = ON');

		this.db = drizzle(sqlite, { schema });
		return this.db;
	}

	getDb(): unknown {
		if (!this.db) {
			throw new Error('SqliteDatabaseProvider: call ensureDb() before getDb(). Use getDbAsync() for lazy init.');
		}
		return this.db;
	}

	getReadDb(): unknown {
		// SQLite has no read replicas -- return the same connection
		return this.getDb();
	}

	/**
	 * Async accessor that ensures the DB is initialized.
	 * Consumers should call this once at startup, then use getDb().
	 */
	async getDbAsync(): Promise<unknown> {
		return this.ensureDb();
	}

	async getHealthStatus(): Promise<{ healthy: boolean; timestamp: string }> {
		try {
			await this.ensureDb();
			return { healthy: true, timestamp: new Date().toISOString() };
		} catch {
			return { healthy: false, timestamp: new Date().toISOString() };
		}
	}
}
