/**
 * D1Database-compatible shim backed by better-sqlite3.
 *
 * Provides the subset of the D1 API used by the codebase:
 *   - db.prepare(sql).bind(...args).first<T>()
 *   - db.prepare(sql).bind(...args).run()
 *   - db.prepare(sql).bind(...args).all<T>()
 *   - db.exec(sql)
 *
 * This lets code that accesses env.DB directly (kernel middleware,
 * aigateway-proxy, etc.) work on the portable runtime without changes.
 */

type SqliteDb = {
	prepare(sql: string): {
		run(...params: unknown[]): unknown;
		get(...params: unknown[]): unknown;
		all(...params: unknown[]): unknown[];
	};
	exec(sql: string): void;
};

class D1PreparedStatementShim {
	private params: unknown[] = [];
	constructor(private sqlite: SqliteDb, private sql: string) {}

	bind(...values: unknown[]): D1PreparedStatementShim {
		this.params = values;
		return this;
	}

	async first<T = Record<string, unknown>>(column?: string): Promise<T | null> {
		const row = this.sqlite.prepare(this.sql).get(...this.params) as Record<string, unknown> | undefined;
		if (!row) return null;
		if (column) return (row[column] as T) ?? null;
		return row as T;
	}

	async run(): Promise<{ success: boolean; meta: Record<string, unknown> }> {
		const result = this.sqlite.prepare(this.sql).run(...this.params) as { changes: number };
		return {
			success: true,
			meta: { changes: result?.changes ?? 0 },
		};
	}

	async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
		const rows = this.sqlite.prepare(this.sql).all(...this.params) as T[];
		return { results: rows, success: true };
	}
}

export class D1DatabaseShim {
	constructor(private sqlite: SqliteDb) {}

	prepare(sql: string): D1PreparedStatementShim {
		return new D1PreparedStatementShim(this.sqlite, sql);
	}

	async exec(sql: string): Promise<{ success: boolean }> {
		this.sqlite.exec(sql);
		return { success: true };
	}

	async batch<T = unknown>(statements: D1PreparedStatementShim[]): Promise<T[]> {
		const results: T[] = [];
		for (const stmt of statements) {
			results.push(await stmt.all() as T);
		}
		return results;
	}

	/** No-op: SQLite has no read replicas */
	withSession(_type: string): D1DatabaseShim {
		return this;
	}
}
