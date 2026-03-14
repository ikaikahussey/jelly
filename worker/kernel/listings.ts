/**
 * Kernel Listings Service
 * Manages monetization listings for apps, components, and templates.
 * Handles listing creation, purchase recording, and access verification.
 */

import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';
import { createLogger } from '../logger';

const logger = createLogger('KernelListings');

export type ListingItemType = 'app' | 'component' | 'template';
export type PricingModel = 'one_time' | 'monthly' | 'usage';
export type PurchaseStatus = 'active' | 'refunded' | 'expired';

export interface CreateListingParams {
    sellerId: string;
    itemType: ListingItemType;
    itemId: string;
    priceCents: number | null;
    pricingModel?: PricingModel;
}

export interface ListingWithSeller extends schema.KernelListing {
    sellerName?: string | null;
    itemTitle?: string | null;
}

export class KernelListingsService extends BaseService {

    /**
     * Create a new listing for an app, component, or template.
     */
    async createListing(params: CreateListingParams): Promise<schema.KernelListing> {
        const [listing] = await this.database
            .insert(schema.kernelListings)
            .values({
                listingId: generateId(),
                sellerId: params.sellerId,
                itemType: params.itemType,
                itemId: params.itemId,
                priceCents: params.priceCents,
                pricingModel: params.pricingModel ?? 'one_time',
                active: 1,
                createdAt: Date.now(),
            })
            .returning();
        return listing;
    }

    /**
     * Get a listing by ID with seller info.
     */
    async getListing(listingId: string): Promise<ListingWithSeller | null> {
        const rows = await this.getReadDb()
            .select({
                listingId: schema.kernelListings.listingId,
                sellerId: schema.kernelListings.sellerId,
                itemType: schema.kernelListings.itemType,
                itemId: schema.kernelListings.itemId,
                priceCents: schema.kernelListings.priceCents,
                pricingModel: schema.kernelListings.pricingModel,
                active: schema.kernelListings.active,
                createdAt: schema.kernelListings.createdAt,
                sellerName: schema.kernelUsers.displayName,
            })
            .from(schema.kernelListings)
            .leftJoin(schema.kernelUsers, eq(schema.kernelListings.sellerId, schema.kernelUsers.userId))
            .where(eq(schema.kernelListings.listingId, listingId))
            .limit(1);

        if (rows.length === 0) return null;
        return rows[0] as ListingWithSeller;
    }

    /**
     * Update a listing (owner only).
     */
    async updateListing(listingId: string, sellerId: string, updates: {
        priceCents?: number | null;
        pricingModel?: PricingModel;
        active?: boolean;
    }): Promise<schema.KernelListing | null> {
        const set: Record<string, unknown> = {};
        if (updates.priceCents !== undefined) set.priceCents = updates.priceCents;
        if (updates.pricingModel !== undefined) set.pricingModel = updates.pricingModel;
        if (updates.active !== undefined) set.active = updates.active ? 1 : 0;

        if (Object.keys(set).length === 0) return null;

        const [updated] = await this.database
            .update(schema.kernelListings)
            .set(set)
            .where(and(
                eq(schema.kernelListings.listingId, listingId),
                eq(schema.kernelListings.sellerId, sellerId)
            ))
            .returning();

        return updated ?? null;
    }

    /**
     * Get listings by seller
     */
    async getSellerListings(sellerId: string, params: {
        limit?: number;
        cursor?: string;
    } = {}): Promise<{ listings: schema.KernelListing[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 20, 100);
        const conditions = [eq(schema.kernelListings.sellerId, sellerId)];

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelListings.createdAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const listings = await this.getReadDb()
            .select()
            .from(schema.kernelListings)
            .where(where)
            .orderBy(desc(schema.kernelListings.createdAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (listings.length > limit) {
            listings.pop();
            const last = listings[listings.length - 1];
            nextCursor = String(last.createdAt);
        }

        return { listings, cursor: nextCursor };
    }

    /**
     * Record a purchase after successful payment.
     */
    async recordPurchase(params: {
        buyerId: string;
        listingId: string;
        externalPaymentId?: string;
        amountCents: number;
        platformFeeCents: number;
    }): Promise<schema.KernelPurchase> {
        const [purchase] = await this.database
            .insert(schema.kernelPurchases)
            .values({
                purchaseId: generateId(),
                buyerId: params.buyerId,
                listingId: params.listingId,
                externalPaymentId: params.externalPaymentId ?? null,
                amountCents: params.amountCents,
                platformFeeCents: params.platformFeeCents,
                status: 'active',
                purchasedAt: Date.now(),
            })
            .returning();
        return purchase;
    }

    /**
     * Check if a user has an active purchase for a listing.
     */
    async hasActivePurchase(buyerId: string, listingId: string): Promise<boolean> {
        const rows = await this.getReadDb()
            .select({ purchaseId: schema.kernelPurchases.purchaseId })
            .from(schema.kernelPurchases)
            .where(and(
                eq(schema.kernelPurchases.buyerId, buyerId),
                eq(schema.kernelPurchases.listingId, listingId),
                eq(schema.kernelPurchases.status, 'active')
            ))
            .limit(1);
        return rows.length > 0;
    }

    /**
     * Get listing for an app by looking up the app registry.
     * Returns null if the app has no listing (free).
     */
    async getListingForApp(appId: string): Promise<schema.KernelListing | null> {
        const rows = await this.getReadDb()
            .select({
                listingId: schema.kernelAppRegistry.listingId,
            })
            .from(schema.kernelAppRegistry)
            .where(eq(schema.kernelAppRegistry.appId, appId))
            .limit(1);

        if (!rows[0]?.listingId) return null;

        const listings = await this.getReadDb()
            .select()
            .from(schema.kernelListings)
            .where(and(
                eq(schema.kernelListings.listingId, rows[0].listingId),
                eq(schema.kernelListings.active, 1)
            ))
            .limit(1);

        return listings[0] ?? null;
    }

    /**
     * Link a listing to an app in the registry.
     */
    async linkListingToApp(appId: string, listingId: string, ownerId: string): Promise<boolean> {
        const result = await this.database
            .update(schema.kernelAppRegistry)
            .set({ listingId })
            .where(and(
                eq(schema.kernelAppRegistry.appId, appId),
                eq(schema.kernelAppRegistry.ownerId, ownerId)
            ))
            .returning();
        return result.length > 0;
    }

    /**
     * Get a user's purchases with cursor pagination.
     */
    async getUserPurchases(buyerId: string, params: {
        limit?: number;
        cursor?: string;
    } = {}): Promise<{ purchases: schema.KernelPurchase[]; cursor?: string }> {
        const limit = Math.min(params.limit ?? 20, 100);
        const conditions = [eq(schema.kernelPurchases.buyerId, buyerId)];

        if (params.cursor) {
            const cursorTs = parseInt(params.cursor, 10);
            if (!isNaN(cursorTs)) {
                conditions.push(sql`${schema.kernelPurchases.purchasedAt} < ${cursorTs}`);
            }
        }

        const where = this.buildWhereConditions(conditions);

        const purchases = await this.getReadDb()
            .select()
            .from(schema.kernelPurchases)
            .where(where)
            .orderBy(desc(schema.kernelPurchases.purchasedAt))
            .limit(limit + 1);

        let nextCursor: string | undefined;
        if (purchases.length > limit) {
            purchases.pop();
            const last = purchases[purchases.length - 1];
            nextCursor = String(last.purchasedAt);
        }

        return { purchases, cursor: nextCursor };
    }

    /**
     * Refund a purchase (update status).
     */
    async refundPurchase(purchaseId: string, buyerId: string): Promise<schema.KernelPurchase | null> {
        const [updated] = await this.database
            .update(schema.kernelPurchases)
            .set({ status: 'refunded' })
            .where(and(
                eq(schema.kernelPurchases.purchaseId, purchaseId),
                eq(schema.kernelPurchases.buyerId, buyerId),
                eq(schema.kernelPurchases.status, 'active')
            ))
            .returning();
        return updated ?? null;
    }
}

/**
 * Kernel Payment Accounts Service
 * Manages external payment provider accounts linked to users.
 */
export class KernelPaymentAccountsService extends BaseService {

    /**
     * Save or update a payment account for a user.
     */
    async saveAccount(userId: string, provider: string, externalAccountId: string): Promise<schema.KernelPaymentAccount> {
        const [account] = await this.database
            .insert(schema.kernelPaymentAccounts)
            .values({
                userId,
                provider,
                externalAccountId,
                onboardingComplete: 0,
                payoutEnabled: 0,
                createdAt: Date.now(),
            })
            .onConflictDoUpdate({
                target: schema.kernelPaymentAccounts.userId,
                set: {
                    provider,
                    externalAccountId,
                },
            })
            .returning();
        return account;
    }

    /**
     * Get a user's payment account.
     */
    async getAccount(userId: string): Promise<schema.KernelPaymentAccount | null> {
        const rows = await this.getReadDb()
            .select()
            .from(schema.kernelPaymentAccounts)
            .where(eq(schema.kernelPaymentAccounts.userId, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    /**
     * Update onboarding/payout status.
     */
    async updateStatus(userId: string, updates: {
        onboardingComplete?: boolean;
        payoutEnabled?: boolean;
    }): Promise<void> {
        const set: Record<string, unknown> = {};
        if (updates.onboardingComplete !== undefined) {
            set.onboardingComplete = updates.onboardingComplete ? 1 : 0;
        }
        if (updates.payoutEnabled !== undefined) {
            set.payoutEnabled = updates.payoutEnabled ? 1 : 0;
        }

        await this.database
            .update(schema.kernelPaymentAccounts)
            .set(set)
            .where(eq(schema.kernelPaymentAccounts.userId, userId));
    }
}
