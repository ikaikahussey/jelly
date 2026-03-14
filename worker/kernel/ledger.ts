/**
 * Kernel Ledger - Append-only financial ledger.
 * Every transfer produces debit + credit entries atomically.
 * Enforces non-negative balances.
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, sql, desc } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';
import { createLogger } from '../logger';

const logger = createLogger('KernelLedger');

export interface LedgerHistoryParams {
    limit?: number;
    cursor?: string;
}

export interface LedgerHistoryResult {
    entries: schema.KernelLedgerEntry[];
    cursor?: string;
}

export class KernelLedgerService extends BaseService {

    /**
     * Get current balance for a user.
     * Uses the most recent balance_after value for O(1) reads.
     */
    async getBalance(userId: string): Promise<number> {
        const rows = await this.getReadDb()
            .select({ balanceAfter: schema.kernelLedger.balanceAfter })
            .from(schema.kernelLedger)
            .where(eq(schema.kernelLedger.userId, userId))
            .orderBy(desc(schema.kernelLedger.createdAt))
            .limit(1);

        return rows[0]?.balanceAfter ?? 0;
    }

    /**
     * Transfer credits between users with optional platform fee.
     * Atomic: all entries written in a single D1 batch.
     * Throws if sender has insufficient balance.
     */
    async transfer(
        fromUserId: string,
        toUserId: string,
        amount: number,
        platformFeePercent: number,
        referenceId?: string,
        platformUserId?: string
    ): Promise<void> {
        if (amount <= 0) {
            throw new Error('Transfer amount must be positive');
        }

        const fromBalance = await this.getBalance(fromUserId);
        if (fromBalance < amount) {
            throw new InsufficientFundsError(fromBalance, amount);
        }

        const platformFee = Math.floor(amount * platformFeePercent / 100);
        const sellerAmount = amount - platformFee;
        const toBalance = await this.getBalance(toUserId);
        const now = Date.now();

        const entries: schema.NewKernelLedgerEntry[] = [
            {
                entryId: generateId(),
                userId: fromUserId,
                amount: -amount,
                balanceAfter: fromBalance - amount,
                entryType: 'purchase',
                referenceId: referenceId ?? null,
                counterpartyId: toUserId,
                createdAt: now,
            },
            {
                entryId: generateId(),
                userId: toUserId,
                amount: sellerAmount,
                balanceAfter: toBalance + sellerAmount,
                entryType: 'sale',
                referenceId: referenceId ?? null,
                counterpartyId: fromUserId,
                createdAt: now,
            },
        ];

        if (platformFee > 0 && platformUserId) {
            const platformBalance = await this.getBalance(platformUserId);
            entries.push({
                entryId: generateId(),
                userId: platformUserId,
                amount: platformFee,
                balanceAfter: platformBalance + platformFee,
                entryType: 'platform_fee',
                referenceId: referenceId ?? null,
                counterpartyId: null,
                createdAt: now,
            });
        }

        // Atomic batch insert
        await this.database.insert(schema.kernelLedger).values(entries);
    }

    /**
     * Add credits to a user's account (deposit, grant, refund).
     */
    async credit(
        userId: string,
        amount: number,
        entryType: string,
        referenceId?: string
    ): Promise<schema.KernelLedgerEntry> {
        if (amount <= 0) {
            throw new Error('Credit amount must be positive');
        }

        const currentBalance = await this.getBalance(userId);
        const [entry] = await this.database
            .insert(schema.kernelLedger)
            .values({
                entryId: generateId(),
                userId,
                amount,
                balanceAfter: currentBalance + amount,
                entryType,
                referenceId: referenceId ?? null,
                counterpartyId: null,
                createdAt: Date.now(),
            })
            .returning();
        return entry;
    }

    /**
     * Debit credits from a user's account (withdrawal).
     * Throws if insufficient balance.
     */
    async debit(
        userId: string,
        amount: number,
        entryType: string,
        referenceId?: string
    ): Promise<schema.KernelLedgerEntry> {
        if (amount <= 0) {
            throw new Error('Debit amount must be positive');
        }

        const currentBalance = await this.getBalance(userId);
        if (currentBalance < amount) {
            throw new InsufficientFundsError(currentBalance, amount);
        }

        const [entry] = await this.database
            .insert(schema.kernelLedger)
            .values({
                entryId: generateId(),
                userId,
                amount: -amount,
                balanceAfter: currentBalance - amount,
                entryType,
                referenceId: referenceId ?? null,
                counterpartyId: null,
                createdAt: Date.now(),
            })
            .returning();
        return entry;
    }

    /**
     * Get transaction history with cursor-based pagination
     */
    async history(userId: string, params: LedgerHistoryParams): Promise<LedgerHistoryResult> {
        const limit = Math.min(params.limit ?? 50, 100);
        const conditions = [eq(schema.kernelLedger.userId, userId)];

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelLedger.createdAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const entries = await this.getReadDb()
            .select()
            .from(schema.kernelLedger)
            .where(where)
            .orderBy(desc(schema.kernelLedger.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (entries.length > limit) {
            entries.pop();
            const last = entries[entries.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { entries, cursor: nextCursor };
    }
}

export class InsufficientFundsError extends Error {
    public readonly currentBalance: number;
    public readonly requestedAmount: number;

    constructor(currentBalance: number, requestedAmount: number) {
        super(`Insufficient funds: balance ${currentBalance}, requested ${requestedAmount}`);
        this.name = 'InsufficientFundsError';
        this.currentBalance = currentBalance;
        this.requestedAmount = requestedAmount;
    }
}
