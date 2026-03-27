/**
 * @jllly/platform - Type definitions
 * Zero dependencies. These types mirror the kernel API responses.
 */

export interface User {
    user_id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    profile: Record<string, unknown>;
}

export type Visibility = 'private' | 'relationships' | 'public';

export interface Relationship {
    from_user: string;
    to_user: string;
    rel_type: string;
    metadata: Record<string, unknown>;
    created_at: number;
}

export interface PlatformObject {
    object_id: string;
    owner_id: string;
    object_type: string;
    payload: Record<string, unknown>;
    visibility: Visibility;
    parent_id: string | null;
    created_at: number;
    updated_at: number;
}

export interface LedgerEntry {
    entry_id: string;
    user_id: string;
    amount: number;
    balance_after: number;
    entry_type: string;
    reference_id: string | null;
    counterparty_id: string | null;
    created_at: number;
}
