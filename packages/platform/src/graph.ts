/**
 * @jllly/platform - Graph module
 * Relationship management between users.
 */

import type { Relationship } from './types';

interface GraphQueryParams {
    from?: string;
    to?: string;
    type?: string;
    limit?: number;
    cursor?: string;
}

interface GraphQueryResult {
    edges: Relationship[];
    cursor?: string;
}

export class GraphClient {
    async link(toUser: string, type: string, metadata?: Record<string, unknown>): Promise<void> {
        const res = await fetch('/api/kernel/graph', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user: toUser, rel_type: type, metadata }),
        });
        if (!res.ok) throw new Error(`Failed to link: ${res.status}`);
    }

    async unlink(toUser: string, type: string): Promise<void> {
        const res = await fetch('/api/kernel/graph', {
            method: 'DELETE',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user: toUser, rel_type: type }),
        });
        if (!res.ok) throw new Error(`Failed to unlink: ${res.status}`);
    }

    async query(params: GraphQueryParams): Promise<GraphQueryResult> {
        const searchParams = new URLSearchParams();
        if (params.from) searchParams.set('from', params.from);
        if (params.to) searchParams.set('to', params.to);
        if (params.type) searchParams.set('type', params.type);
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);

        const res = await fetch(`/api/kernel/graph?${searchParams}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to query graph: ${res.status}`);

        const body = await res.json() as { data: GraphQueryResult };
        return body.data;
    }
}
