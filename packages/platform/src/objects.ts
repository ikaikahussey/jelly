/**
 * @jllly/platform - Objects module
 * Generic content object CRUD with visibility control.
 */

import type { PlatformObject, Visibility } from './types';

interface ObjectsQueryParams {
    type?: string;
    owner?: string;
    visibility?: string;
    parent?: string;
    limit?: number;
    cursor?: string;
}

interface ObjectsQueryResult {
    objects: PlatformObject[];
    cursor?: string;
}

export class ObjectsClient {
    async create(
        type: string,
        payload: Record<string, unknown>,
        visibility: Visibility = 'private'
    ): Promise<PlatformObject> {
        const res = await fetch('/api/kernel/objects', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload, visibility }),
        });
        if (!res.ok) throw new Error(`Failed to create object: ${res.status}`);

        const body = await res.json() as { data: PlatformObject };
        return body.data;
    }

    async get(objectId: string): Promise<PlatformObject> {
        const res = await fetch(`/api/kernel/objects/${objectId}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get object: ${res.status}`);

        const body = await res.json() as { data: PlatformObject };
        return body.data;
    }

    async update(objectId: string, payload: Record<string, unknown>): Promise<PlatformObject> {
        const res = await fetch(`/api/kernel/objects/${objectId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload }),
        });
        if (!res.ok) throw new Error(`Failed to update object: ${res.status}`);

        const body = await res.json() as { data: PlatformObject };
        return body.data;
    }

    async delete(objectId: string): Promise<void> {
        const res = await fetch(`/api/kernel/objects/${objectId}`, {
            method: 'DELETE',
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to delete object: ${res.status}`);
    }

    async query(params: ObjectsQueryParams): Promise<ObjectsQueryResult> {
        const searchParams = new URLSearchParams();
        if (params.type) searchParams.set('type', params.type);
        if (params.owner) searchParams.set('owner', params.owner);
        if (params.visibility) searchParams.set('visibility', params.visibility);
        if (params.parent) searchParams.set('parent', params.parent);
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);

        const res = await fetch(`/api/kernel/objects?${searchParams}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to query objects: ${res.status}`);

        const body = await res.json() as { data: ObjectsQueryResult };
        return body.data;
    }
}
