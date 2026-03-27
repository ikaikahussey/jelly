/**
 * Functional shim for the `agents` SDK on non-CF runtimes.
 *
 * Unlike the stub version, this provides a real working Agent base class
 * backed by better-sqlite3 for SQL and JSON files for state persistence.
 * CodeGeneratorAgent extends this directly -- no code changes needed.
 *
 * Usage: Loaded via ESM loader hook (server/loader.ts)
 */

import type { SqlValue } from '../../worker/agents/git/fs-adapter';

// ---------------------------------------------------------------------------
// Lazy better-sqlite3 initialization
// ---------------------------------------------------------------------------

let Database: typeof import('better-sqlite3').default | null = null;

async function getDatabase(): Promise<typeof import('better-sqlite3').default> {
	if (!Database) {
		const mod = await import('better-sqlite3');
		Database = mod.default;
	}
	return Database;
}

// ---------------------------------------------------------------------------
// Agent instance registry (in-process singleton)
// ---------------------------------------------------------------------------

const agentRegistry = new Map<string, Agent<unknown, unknown>>();

function getDataDir(): string {
	return process.env.JELLY_DATA_DIR || './data';
}

// ---------------------------------------------------------------------------
// Connection class
// ---------------------------------------------------------------------------

export class Connection {
	id: string;
	private _ws: WebSocket | null;

	constructor(id?: string, ws?: WebSocket) {
		this.id = id || 'local';
		this._ws = ws || null;
	}

	send(message: string | ArrayBuffer): void {
		if (this._ws && this._ws.readyState === 1 /* OPEN */) {
			this._ws.send(message);
		}
	}

	close(code?: number, reason?: string): void {
		if (this._ws) {
			this._ws.close(code, reason);
		}
	}
}

// ---------------------------------------------------------------------------
// Agent context (mimics CF AgentContext)
// ---------------------------------------------------------------------------

class LocalAgentContext {
	private webSockets: WebSocket[] = [];

	getWebSockets(): WebSocket[] {
		return this.webSockets.filter(
			(ws) => ws.readyState === 1 /* OPEN */
		);
	}

	addWebSocket(ws: WebSocket): void {
		this.webSockets.push(ws);
	}

	removeWebSocket(ws: WebSocket): void {
		const idx = this.webSockets.indexOf(ws);
		if (idx !== -1) this.webSockets.splice(idx, 1);
	}
}

// ---------------------------------------------------------------------------
// Agent base class
// ---------------------------------------------------------------------------

export type AgentContext = LocalAgentContext;
export type ConnectionContext = { request: Request };

export class Agent<TEnv = unknown, TState = unknown> {
	env: TEnv;
	ctx: LocalAgentContext;

	// State management
	private _state: TState | undefined;
	private _statePath: string | undefined;
	private _agentKey: string | undefined;

	// SQL executor backed by better-sqlite3
	private _db: import('better-sqlite3').Database | null = null;

	/**
	 * Override in subclass to define initial state shape.
	 * The agents SDK reads this as a property, not a method.
	 */
	initialState: TState = {} as TState;

	constructor(ctx: AgentContext, env: TEnv) {
		this.ctx = ctx;
		this.env = env;
	}

	// -- State ----------------------------------------------------------------

	get state(): TState {
		if (this._state === undefined) {
			this._state = structuredClone(this.initialState);
		}
		return this._state;
	}

	setState(newState: TState): void {
		this._state = newState;
		this._persistState();
	}

	private _persistState(): void {
		if (!this._statePath) return;
		const path = this._statePath;
		const data = JSON.stringify(this._state);
		import('node:fs/promises').then(({ writeFile }) => {
			writeFile(path, data).catch(() => {
				// Best-effort persistence
			});
		});
	}

	// -- SQL ------------------------------------------------------------------

	/**
	 * Tagged-template SQL executor.
	 * Compatible with the agents SDK's this.sql`...` pattern.
	 */
	sql<T = unknown>(query: TemplateStringsArray, ...values: SqlValue[]): T[] {
		if (!this._db) {
			return [] as T[];
		}
		const sqlString = query.reduce((acc, part, i) => {
			return acc + part + (i < values.length ? '?' : '');
		}, '');

		try {
			// Check if it's a write statement
			const trimmed = sqlString.trimStart().toUpperCase();
			if (
				trimmed.startsWith('CREATE') ||
				trimmed.startsWith('INSERT') ||
				trimmed.startsWith('UPDATE') ||
				trimmed.startsWith('DELETE') ||
				trimmed.startsWith('DROP') ||
				trimmed.startsWith('ALTER')
			) {
				this._db.prepare(sqlString).run(...values);
				return [] as T[];
			}
			return this._db.prepare(sqlString).all(...values) as T[];
		} catch (err) {
			// Log but don't crash -- matches CF behavior of failing gracefully
			console.error('[LocalAgent SQL Error]', sqlString, err);
			return [] as T[];
		}
	}

	// -- Lifecycle hooks (overridden by subclasses) ---------------------------

	onStart(_props?: Record<string, unknown>): void | Promise<void> {}
	onConnect(_connection: Connection, _ctx: ConnectionContext): void | Promise<void> {}
	onMessage(_connection: Connection, _message: string | ArrayBuffer): void | Promise<void> {}
	onClose(_connection: Connection, _code?: number, _reason?: string): void | Promise<void> {}
	onError(_connection: Connection, _error: unknown): void | Promise<void> {}

	/**
	 * Called once after first creation. Subclasses override to set up initial state.
	 */
	async initialize(..._args: unknown[]): Promise<TState> {
		return this.state;
	}

	// -- Internal initialization (called by getAgentByName) -------------------

	async _localInit(agentKey: string, props?: Record<string, unknown>): Promise<void> {
		this._agentKey = agentKey;
		const dataDir = getDataDir();
		const actorDir = `${dataDir}/actors/agents`;

		const { mkdir, readFile } = await import('node:fs/promises');
		await mkdir(actorDir, { recursive: true });

		// Initialize SQLite database
		const Db = await getDatabase();
		const dbPath = `${actorDir}/${agentKey}.sqlite`;
		this._db = new Db(dbPath);
		this._db.pragma('journal_mode = WAL');
		this._db.pragma('foreign_keys = ON');

		// Load persisted state
		this._statePath = `${actorDir}/${agentKey}.state.json`;
		try {
			const raw = await readFile(this._statePath, 'utf-8');
			const parsed = JSON.parse(raw) as TState;
			if (parsed && typeof parsed === 'object') {
				this._state = parsed;
			}
		} catch {
			// No saved state -- use initialState (set by subclass constructor)
		}

		// Call onStart lifecycle hook
		await this.onStart(props);
	}
}

// ---------------------------------------------------------------------------
// getAgentByName -- creates or retrieves a local agent instance
// ---------------------------------------------------------------------------

/**
 * Local implementation of getAgentByName from the agents SDK.
 *
 * On CF, this returns a Durable Object stub that communicates via RPC.
 * Locally, we create the actual agent instance in-process and return it
 * directly. Since the caller typically calls methods on the stub (which
 * on CF are RPC calls), returning the real instance works because
 * method calls go directly to the object.
 */
export async function getAgentByName<TEnv, TAgent extends Agent<TEnv, unknown>>(
	namespace: unknown,
	name: string,
	options?: { props?: Record<string, unknown> },
): Promise<TAgent> {
	const key = `agent:${name}`;
	const existing = agentRegistry.get(key);
	if (existing) {
		return existing as unknown as TAgent;
	}

	// We need to create a new instance. The challenge is that we don't have
	// the class reference here -- the caller passes a DO namespace binding.
	// On local runtime, we use a deferred registration pattern.
	const factory = agentClassRegistry.get('CodeGeneratorAgent') || agentClassRegistry.get('default');
	if (!factory) {
		throw new Error(
			`getAgentByName: No agent class registered for local runtime. ` +
			`Call registerAgentClass() before using getAgentByName.`,
		);
	}

	const ctx = new LocalAgentContext();
	const env = (process.env as unknown) as TEnv;
	const agent = factory(ctx, env) as TAgent;

	agentRegistry.set(key, agent as unknown as Agent<unknown, unknown>);
	await agent._localInit(name, options?.props);

	return agent;
}

// ---------------------------------------------------------------------------
// Agent class registration for local runtime
// ---------------------------------------------------------------------------

type AgentFactory = (ctx: LocalAgentContext, env: unknown) => Agent<unknown, unknown>;
const agentClassRegistry = new Map<string, AgentFactory>();

/**
 * Register an agent class so getAgentByName can instantiate it locally.
 * Call this at module load time from the server entry point.
 */
export function registerAgentClass(name: string, factory: AgentFactory): void {
	agentClassRegistry.set(name, factory);
}

/**
 * Get an existing agent instance by key (for WebSocket routing).
 */
export function getLocalAgent(name: string): Agent<unknown, unknown> | undefined {
	return agentRegistry.get(`agent:${name}`);
}
