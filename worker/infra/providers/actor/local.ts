/**
 * Local Actor Provider
 *
 * In-process actor implementation for non-Cloudflare runtimes.
 * Each actor gets:
 *   - A dedicated SQLite database at {dataDir}/actors/{namespace}/{id}.sqlite
 *   - JSON-serialized persistent state
 *   - WebSocket connection tracking
 *
 * Only loaded when JELLY_RUNTIME !== 'cloudflare'.
 */

import type { ActorProvider, ActorHandle, ActorSqlExecutor } from '../../types';
import type { SqlValue } from '../../../agents/git/fs-adapter';

interface LocalActorInstance {
	id: string;
	namespace: string;
	state: Record<string, unknown>;
	sqliteDb: unknown; // better-sqlite3 Database instance
	webSockets: WebSocket[];
}

export class LocalActorProvider implements ActorProvider {
	private readonly dataDir: string;
	private readonly actors = new Map<string, LocalActorInstance>();

	constructor(dataDir: string) {
		this.dataDir = dataDir;
	}

	private actorKey(namespace: string, id: string): string {
		return `${namespace}:${id}`;
	}

	private async ensureActor(namespace: string, id: string): Promise<LocalActorInstance> {
		const key = this.actorKey(namespace, id);
		const existing = this.actors.get(key);
		if (existing) return existing;

		const { default: Database } = await import('better-sqlite3');
		const { mkdir, readFile, writeFile } = await import('node:fs/promises');

		const actorDir = `${this.dataDir}/actors/${namespace}`;
		await mkdir(actorDir, { recursive: true });

		const dbPath = `${actorDir}/${id}.sqlite`;
		const sqliteDb = new Database(dbPath);
		sqliteDb.pragma('journal_mode = WAL');
		sqliteDb.pragma('foreign_keys = ON');

		// Load persisted state
		let state: Record<string, unknown> = {};
		const statePath = `${actorDir}/${id}.state.json`;
		try {
			const raw = await readFile(statePath, 'utf-8');
			state = JSON.parse(raw) as Record<string, unknown>;
		} catch {
			// No saved state yet -- start fresh
			await writeFile(statePath, '{}');
		}

		const instance: LocalActorInstance = {
			id,
			namespace,
			state,
			sqliteDb,
			webSockets: [],
		};

		this.actors.set(key, instance);
		return instance;
	}

	async getActor<TState = unknown>(namespace: string, id: string): Promise<ActorHandle<TState>> {
		const instance = await this.ensureActor(namespace, id);
		const dataDir = this.dataDir;

		const sql: ActorSqlExecutor = Object.assign(
			function sqlExec<T = unknown>(query: TemplateStringsArray, ...values: SqlValue[]): T[] {
				const sqliteDb = instance.sqliteDb as {
					prepare(sql: string): { all(...params: SqlValue[]): T[] };
				};
				const sqlString = query.reduce((acc, part, i) => {
					return acc + part + (i < values.length ? '?' : '');
				}, '');
				const stmt = sqliteDb.prepare(sqlString);
				return stmt.all(...values);
			},
			{} as ActorSqlExecutor,
		) as ActorSqlExecutor;

		return {
			id: instance.id,
			get state(): TState {
				return instance.state as TState;
			},
			set state(val: TState) {
				instance.state = val as Record<string, unknown>;
			},
			setState(patch: Partial<TState>) {
				Object.assign(instance.state, patch);
				// Persist state to disk asynchronously
				const statePath = `${dataDir}/actors/${namespace}/${id}.state.json`;
				import('node:fs/promises').then(({ writeFile }) => {
					writeFile(statePath, JSON.stringify(instance.state)).catch(() => {
						// Best-effort persistence
					});
				});
			},
			sql,
			getWebSockets(): WebSocket[] {
				return instance.webSockets;
			},
			broadcast(message: string) {
				for (const ws of instance.webSockets) {
					try {
						ws.send(message);
					} catch {
						// Socket may be closed
					}
				}
			},
		};
	}
}
