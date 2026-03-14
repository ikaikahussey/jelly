/**
 * @jelly/platform - Ledger module
 * Balance and transaction management.
 */

import type { LedgerEntry } from './types';

interface LedgerHistoryParams {
    limit?: number;
    cursor?: string;
}

interface LedgerHistoryResult {
    entries: LedgerEntry[];
    cursor?: string;
}

export class LedgerClient {
    async balance(): Promise<{ balance: number }> {
        const res = await fetch('/api/kernel/ledger/balance', {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get balance: ${res.status}`);

        const body = await res.json() as { data: { balance: number } };
        return body.data;
    }

    async transfer(toUser: string, amount: number, reference?: string): Promise<void> {
        const res = await fetch('/api/kernel/ledger/transfer', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ to_user: toUser, amount, reference }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { message?: string };
            throw new Error(body.message ?? `Transfer failed: ${res.status}`);
        }
    }

    async history(params: LedgerHistoryParams = {}): Promise<LedgerHistoryResult> {
        const searchParams = new URLSearchParams();
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);

        const res = await fetch(`/api/kernel/ledger/history?${searchParams}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get history: ${res.status}`);

        const body = await res.json() as { data: LedgerHistoryResult };
        return body.data;
    }
}
