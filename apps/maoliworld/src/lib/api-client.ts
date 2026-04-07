/**
 * Typed API client for kernel endpoints.
 * All kernel API calls go through this module.
 */

// --- Types ---

export interface KernelUser {
    user_id: string;
    email?: string;
    display_name: string | null;
    avatar_r2_key: string | null;
    profile: Record<string, unknown>;
}

export type Visibility = 'private' | 'relationships' | 'public';

export interface KernelObject {
    object_id: string;
    owner_id: string;
    object_type: string;
    payload: Record<string, unknown>;
    visibility: Visibility;
    parent_id: string | null;
    created_at: number;
    updated_at: number;
}

export interface KernelEdge {
    from_user: string;
    to_user: string;
    rel_type: string;
    metadata: Record<string, unknown>;
    created_at: number;
}

export interface MediaUploadResult {
    key: string;
    url: string;
    size: number;
    contentType: string;
}

interface PaginatedResponse<T> {
    cursor?: string;
    data: T;
}

// --- Internal helpers ---

const BASE = '/api/kernel';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
            ...(init?.headers ?? {}),
            ...(!init?.body || init.body instanceof FormData
                ? {}
                : { 'Content-Type': 'application/json' }),
        },
        credentials: 'include',
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
        throw new ApiError(res.status, body.error ?? res.statusText);
    }

    return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
    const entries = Object.entries(params).filter(
        (entry): entry is [string, string | number | boolean] => entry[1] !== undefined
    );
    if (entries.length === 0) return '';
    return '?' + new URLSearchParams(
        entries.map(([k, v]) => [k, String(v)])
    ).toString();
}

export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// --- Auth ---

export const auth = {
    async getMe(): Promise<KernelUser | null> {
        try {
            return await apiFetch<KernelUser>('/auth/me');
        } catch (e) {
            if (e instanceof ApiError && e.status === 401) return null;
            throw e;
        }
    },

    async updateProfile(updates: {
        display_name?: string;
        profile?: Record<string, unknown>;
        avatar_r2_key?: string;
    }): Promise<KernelUser> {
        return apiFetch<KernelUser>('/users/me', {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    async getUser(userId: string): Promise<KernelUser | null> {
        try {
            return await apiFetch<KernelUser>(`/users/${userId}`);
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null;
            throw e;
        }
    },
};

// --- Graph ---

export const graph = {
    async link(toUser: string, relType: string, metadata?: Record<string, unknown>): Promise<void> {
        await apiFetch('/graph', {
            method: 'POST',
            body: JSON.stringify({ to_user: toUser, rel_type: relType, metadata }),
        });
    },

    async unlink(toUser: string, relType: string): Promise<void> {
        await apiFetch('/graph', {
            method: 'DELETE',
            body: JSON.stringify({ to_user: toUser, rel_type: relType }),
        });
    },

    async query(params: {
        from?: string;
        to?: string;
        type?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{ edges: KernelEdge[]; cursor?: string }> {
        return apiFetch(
            `/graph${qs(params)}`
        );
    },

    async count(params: {
        from?: string;
        to?: string;
        type?: string;
    }): Promise<number> {
        const result = await apiFetch<{ count: number }>(
            `/graph/count${qs(params)}`
        );
        return result.count;
    },

    async batchCheck(nodeIds: string[], edgeType: string): Promise<Record<string, boolean>> {
        return apiFetch('/graph/check', {
            method: 'POST',
            body: JSON.stringify({ node_ids: nodeIds, edge_type: edgeType }),
        });
    },
};

// --- Objects ---

export const objects = {
    async create(params: {
        type: string;
        payload: Record<string, unknown>;
        visibility?: Visibility;
        parent_id?: string;
    }): Promise<KernelObject> {
        return apiFetch('/objects', {
            method: 'POST',
            body: JSON.stringify(params),
        });
    },

    async get(objectId: string): Promise<KernelObject | null> {
        try {
            return await apiFetch<KernelObject>(`/objects/${objectId}`);
        } catch (e) {
            if (e instanceof ApiError && e.status === 404) return null;
            throw e;
        }
    },

    async update(objectId: string, updates: {
        payload?: Record<string, unknown>;
        visibility?: Visibility;
    }): Promise<KernelObject> {
        return apiFetch(`/objects/${objectId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        });
    },

    async delete(objectId: string): Promise<void> {
        await apiFetch(`/objects/${objectId}`, { method: 'DELETE' });
    },

    async query(params: {
        type?: string;
        owner?: string;
        visibility?: string;
        parent?: string;
        q?: string;
        limit?: number;
        cursor?: string;
    }): Promise<{ objects: KernelObject[]; cursor?: string }> {
        return apiFetch(
            `/objects${qs(params)}`
        );
    },
};

// --- Media ---

export const media = {
    async upload(file: File): Promise<MediaUploadResult> {
        const formData = new FormData();
        formData.append('file', file);
        return apiFetch('/media', {
            method: 'POST',
            body: formData,
        });
    },

    async delete(key: string): Promise<void> {
        await apiFetch(`/media/${encodeURIComponent(key)}`, { method: 'DELETE' });
    },

    url(key: string): string {
        return `${BASE}/media/${encodeURIComponent(key)}`;
    },
};

// --- Ledger ---

export const ledger = {
    async balance(): Promise<number> {
        const result = await apiFetch<{ balance: number }>('/ledger/balance');
        return result.balance;
    },

    async transfer(toUser: string, amount: number, reference?: string): Promise<void> {
        await apiFetch('/ledger/transfer', {
            method: 'POST',
            body: JSON.stringify({ to_user: toUser, amount, reference }),
        });
    },

    async history(params?: {
        limit?: number;
        cursor?: string;
    }): Promise<{ entries: Array<Record<string, unknown>>; cursor?: string }> {
        return apiFetch(`/ledger/history${qs(params ?? {})}`);
    },
};

// --- Feed (app-layer assembly) ---

export const feed = {
    /**
     * Assemble an activity feed for the current user.
     * Queries recent public objects and sorts by created_at.
     * Designed to be replaced by a server-side feed service later.
     */
    async getGlobal(params?: {
        limit?: number;
        cursor?: string;
    }): Promise<{ objects: KernelObject[]; cursor?: string }> {
        return objects.query({
            visibility: 'public',
            limit: params?.limit ?? 20,
            cursor: params?.cursor,
        });
    },

    async getPersonal(userId: string, params?: {
        limit?: number;
        cursor?: string;
    }): Promise<{ objects: KernelObject[]; cursor?: string }> {
        return objects.query({
            owner: userId,
            limit: params?.limit ?? 20,
            cursor: params?.cursor,
        });
    },
};
