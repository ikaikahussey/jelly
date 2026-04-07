/**
 * Kernel API Controller
 * Handles all /api/kernel/* routes for the four kernel primitives
 * plus listings, purchases, payments, and components.
 */

import { BaseController } from '../baseController';
import { RouteContext } from '../../types/route-context';
import { KernelAuthService } from '../../../kernel/auth';
import { KernelGraphService } from '../../../kernel/graph';
import { KernelObjectsService } from '../../../kernel/objects';
import { KernelLedgerService, InsufficientFundsError } from '../../../kernel/ledger';
import { KernelDashboardService } from '../../../kernel/dashboard';
import { KernelListingsService, KernelPaymentAccountsService } from '../../../kernel/listings';
import { KernelComponentsService } from '../../../kernel/components';
import { createPaymentProvider } from '../../../kernel/payments/factory';
import { KernelMediaService } from '../../../kernel/media';
import { createLogger } from '../../../logger';

const logger = createLogger('KernelController');

export class KernelController extends BaseController {
    static logger = logger;

    // ========================================
    // AUTH / USERS
    // ========================================

    /**
     * GET /api/kernel/auth/me - Current user profile
     */
    static async getMe(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const authService = new KernelAuthService(env);
            const kernelUser = await authService.getUser(user.id);

            if (!kernelUser) {
                return KernelController.createErrorResponse('Kernel user not found', 404);
            }

            return KernelController.createSuccessResponse({
                user_id: kernelUser.userId,
                email: kernelUser.email,
                display_name: kernelUser.displayName,
                avatar_r2_key: kernelUser.avatarR2Key,
                profile: JSON.parse(kernelUser.profileJson ?? '{}'),
            });
        } catch (error) {
            logger.error('Error getting kernel user', { error });
            return KernelController.createErrorResponse('Failed to get user', 500);
        }
    }

    /**
     * GET /api/kernel/users/:id - Public user profile
     */
    static async getUser(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const userId = context.pathParams.id;
            if (!userId) {
                return KernelController.createErrorResponse('User ID required', 400);
            }

            const authService = new KernelAuthService(env);
            const kernelUser = await authService.getUser(userId);

            if (!kernelUser) {
                return KernelController.createErrorResponse('User not found', 404);
            }

            return KernelController.createSuccessResponse({
                user_id: kernelUser.userId,
                display_name: kernelUser.displayName,
                avatar_r2_key: kernelUser.avatarR2Key,
                profile: JSON.parse(kernelUser.profileJson ?? '{}'),
            });
        } catch (error) {
            logger.error('Error getting user profile', { error });
            return KernelController.createErrorResponse('Failed to get user', 500);
        }
    }

    /**
     * PATCH /api/kernel/users/me - Update own profile
     */
    static async updateMe(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                display_name?: string;
                profile?: Record<string, unknown>;
                avatar_r2_key?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const updates: Record<string, string | undefined> = {};
            if (bodyResult.data!.display_name !== undefined) {
                updates.displayName = bodyResult.data!.display_name;
            }
            if (bodyResult.data!.profile !== undefined) {
                updates.profileJson = JSON.stringify(bodyResult.data!.profile);
            }
            if (bodyResult.data!.avatar_r2_key !== undefined) {
                updates.avatarR2Key = bodyResult.data!.avatar_r2_key;
            }

            const authService = new KernelAuthService(env);
            const updated = await authService.updateProfile(user.id, updates);
            if (!updated) {
                return KernelController.createErrorResponse('User not found', 404);
            }

            return KernelController.createSuccessResponse({
                user_id: updated.userId,
                email: updated.email,
                display_name: updated.displayName,
                avatar_r2_key: updated.avatarR2Key,
                profile: JSON.parse(updated.profileJson ?? '{}'),
            });
        } catch (error) {
            logger.error('Error updating profile', { error });
            return KernelController.createErrorResponse('Failed to update profile', 500);
        }
    }

    // ========================================
    // GRAPH (Relationships)
    // ========================================

    /**
     * POST /api/kernel/graph - Create relationship
     */
    static async createRelationship(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                to_user: string;
                rel_type: string;
                metadata?: Record<string, unknown>;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { to_user, rel_type, metadata } = bodyResult.data!;
            if (!to_user || !rel_type) {
                return KernelController.createErrorResponse('to_user and rel_type are required', 400);
            }

            const graphService = new KernelGraphService(env);
            await graphService.link(user.id, to_user, rel_type, metadata);

            return KernelController.createSuccessResponse({ created: true });
        } catch (error) {
            logger.error('Error creating relationship', { error });
            return KernelController.createErrorResponse('Failed to create relationship', 500);
        }
    }

    /**
     * DELETE /api/kernel/graph - Remove relationship
     */
    static async deleteRelationship(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                to_user: string;
                rel_type: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { to_user, rel_type } = bodyResult.data!;
            if (!to_user || !rel_type) {
                return KernelController.createErrorResponse('to_user and rel_type are required', 400);
            }

            const graphService = new KernelGraphService(env);
            const deleted = await graphService.unlink(user.id, to_user, rel_type);

            if (!deleted) {
                return KernelController.createErrorResponse('Relationship not found', 404);
            }

            return KernelController.createSuccessResponse({ deleted: true });
        } catch (error) {
            logger.error('Error deleting relationship', { error });
            return KernelController.createErrorResponse('Failed to delete relationship', 500);
        }
    }

    /**
     * GET /api/kernel/graph - Query relationships
     */
    static async queryRelationships(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const params = context.queryParams;
            const graphService = new KernelGraphService(env);
            const result = await graphService.query({
                from: params.get('from') ?? undefined,
                to: params.get('to') ?? undefined,
                type: params.get('type') ?? undefined,
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse(result);
        } catch (error) {
            logger.error('Error querying relationships', { error });
            return KernelController.createErrorResponse('Failed to query relationships', 500);
        }
    }

    /**
     * GET /api/kernel/graph/count - Count edges by type
     */
    static async countEdges(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const params = context.queryParams;
            const graphService = new KernelGraphService(env);
            const count = await graphService.countEdges({
                from: params.get('from') ?? undefined,
                to: params.get('to') ?? undefined,
                type: params.get('type') ?? undefined,
            });

            return KernelController.createSuccessResponse({ count });
        } catch (error) {
            logger.error('Error counting edges', { error });
            return KernelController.createErrorResponse('Failed to count edges', 500);
        }
    }

    /**
     * POST /api/kernel/graph/check - Batch check edge existence
     */
    static async batchCheckEdges(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                node_ids: string[];
                edge_type: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { node_ids, edge_type } = bodyResult.data!;
            if (!node_ids || !Array.isArray(node_ids) || !edge_type) {
                return KernelController.createErrorResponse('node_ids (array) and edge_type are required', 400);
            }

            if (node_ids.length > 100) {
                return KernelController.createErrorResponse('Maximum 100 node_ids per request', 400);
            }

            const graphService = new KernelGraphService(env);
            const result = await graphService.batchCheckEdges(user.id, node_ids, edge_type);

            return KernelController.createSuccessResponse(result);
        } catch (error) {
            logger.error('Error batch checking edges', { error });
            return KernelController.createErrorResponse('Failed to check edges', 500);
        }
    }

    // ========================================
    // OBJECTS (Content)
    // ========================================

    /**
     * POST /api/kernel/objects - Create object
     */
    static async createObject(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                type: string;
                payload: Record<string, unknown>;
                visibility?: string;
                parent_id?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { type, payload, visibility, parent_id } = bodyResult.data!;
            if (!type || !payload) {
                return KernelController.createErrorResponse('type and payload are required', 400);
            }

            const objectsService = new KernelObjectsService(env);
            const obj = await objectsService.create(user.id, type, payload, visibility, parent_id);

            return KernelController.createSuccessResponse(formatObject(obj));
        } catch (error) {
            logger.error('Error creating object', { error });
            return KernelController.createErrorResponse('Failed to create object', 500);
        }
    }

    /**
     * GET /api/kernel/objects/:id - Get single object
     */
    static async getObject(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const objectId = context.pathParams.id;
            if (!objectId) {
                return KernelController.createErrorResponse('Object ID required', 400);
            }

            const requesterId = context.user?.id;
            const objectsService = new KernelObjectsService(env);
            const obj = await objectsService.get(objectId, requesterId);

            if (!obj) {
                return KernelController.createErrorResponse('Object not found', 404);
            }

            return KernelController.createSuccessResponse(formatObject(obj));
        } catch (error) {
            logger.error('Error getting object', { error });
            return KernelController.createErrorResponse('Failed to get object', 500);
        }
    }

    /**
     * PATCH /api/kernel/objects/:id - Update object (owner only)
     */
    static async updateObject(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const objectId = context.pathParams.id;
            if (!objectId) {
                return KernelController.createErrorResponse('Object ID required', 400);
            }

            const bodyResult = await KernelController.parseJsonBody<{
                payload?: Record<string, unknown>;
                visibility?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const objectsService = new KernelObjectsService(env);
            const updated = await objectsService.update(objectId, user.id, bodyResult.data!);

            if (!updated) {
                return KernelController.createErrorResponse('Object not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse(formatObject(updated));
        } catch (error) {
            logger.error('Error updating object', { error });
            return KernelController.createErrorResponse('Failed to update object', 500);
        }
    }

    /**
     * DELETE /api/kernel/objects/:id - Delete object (owner only)
     */
    static async deleteObject(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const objectId = context.pathParams.id;
            if (!objectId) {
                return KernelController.createErrorResponse('Object ID required', 400);
            }

            const objectsService = new KernelObjectsService(env);
            const deleted = await objectsService.delete(objectId, user.id);

            if (!deleted) {
                return KernelController.createErrorResponse('Object not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse({ deleted: true });
        } catch (error) {
            logger.error('Error deleting object', { error });
            return KernelController.createErrorResponse('Failed to delete object', 500);
        }
    }

    /**
     * GET /api/kernel/objects - Query objects
     */
    static async queryObjects(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const params = context.queryParams;
            const requesterId = context.user?.id;
            const objectsService = new KernelObjectsService(env);
            const result = await objectsService.query(
                {
                    type: params.get('type') ?? undefined,
                    owner: params.get('owner') ?? undefined,
                    visibility: params.get('visibility') ?? undefined,
                    parent: params.get('parent') ?? undefined,
                    search: params.get('q') ?? undefined,
                    limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                    cursor: params.get('cursor') ?? undefined,
                },
                requesterId
            );

            return KernelController.createSuccessResponse({
                objects: result.objects.map(formatObject),
                cursor: result.cursor,
            });
        } catch (error) {
            logger.error('Error querying objects', { error });
            return KernelController.createErrorResponse('Failed to query objects', 500);
        }
    }

    // ========================================
    // LEDGER
    // ========================================

    /**
     * GET /api/kernel/ledger/balance - Get current balance
     */
    static async getBalance(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const ledgerService = new KernelLedgerService(env);
            const balance = await ledgerService.getBalance(user.id);

            return KernelController.createSuccessResponse({ balance });
        } catch (error) {
            logger.error('Error getting balance', { error });
            return KernelController.createErrorResponse('Failed to get balance', 500);
        }
    }

    /**
     * POST /api/kernel/ledger/transfer - Transfer credits
     */
    static async transfer(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                to_user: string;
                amount: number;
                reference?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { to_user, amount, reference } = bodyResult.data!;
            if (!to_user || !amount || amount <= 0) {
                return KernelController.createErrorResponse('to_user and positive amount are required', 400);
            }

            const platformFeePercent = parseInt(env.PLATFORM_FEE_PCT ?? '10', 10);
            const ledgerService = new KernelLedgerService(env);

            await ledgerService.transfer(
                user.id,
                to_user,
                amount,
                platformFeePercent,
                reference
            );

            return KernelController.createSuccessResponse({ transferred: true });
        } catch (error) {
            if (error instanceof InsufficientFundsError) {
                return KernelController.createErrorResponse('Insufficient funds', 400);
            }
            logger.error('Error transferring credits', { error });
            return KernelController.createErrorResponse('Failed to transfer', 500);
        }
    }

    /**
     * GET /api/kernel/ledger/history - Transaction history
     */
    static async getHistory(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const params = context.queryParams;
            const ledgerService = new KernelLedgerService(env);
            const result = await ledgerService.history(user.id, {
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse(result);
        } catch (error) {
            logger.error('Error getting ledger history', { error });
            return KernelController.createErrorResponse('Failed to get history', 500);
        }
    }

    // ========================================
    // DASHBOARD
    // ========================================

    /**
     * GET /api/kernel/dashboard/apps-i-use - Apps the user has accessed
     */
    static async getAppsIUse(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const params = context.queryParams;
            const dashboardService = new KernelDashboardService(env);
            const result = await dashboardService.getAppsIUse(user.id, {
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
                pinnedOnly: params.get('pinned') === 'true',
            });

            return KernelController.createSuccessResponse(result);
        } catch (error) {
            logger.error('Error getting apps I use', { error });
            return KernelController.createErrorResponse('Failed to get apps', 500);
        }
    }

    /**
     * POST /api/kernel/dashboard/pin - Pin/unpin an app
     */
    static async togglePin(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                app_id: string;
                pinned: boolean;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { app_id, pinned } = bodyResult.data!;
            if (!app_id) {
                return KernelController.createErrorResponse('app_id is required', 400);
            }

            const dashboardService = new KernelDashboardService(env);
            await dashboardService.togglePin(user.id, app_id, pinned);

            return KernelController.createSuccessResponse({ pinned });
        } catch (error) {
            logger.error('Error toggling pin', { error });
            return KernelController.createErrorResponse('Failed to toggle pin', 500);
        }
    }

    /**
     * GET /api/kernel/registry - Browse public app registry
     */
    static async browseRegistry(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const params = context.queryParams;
            const dashboardService = new KernelDashboardService(env);
            const result = await dashboardService.browseRegistry({
                search: params.get('search') ?? undefined,
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse(result);
        } catch (error) {
            logger.error('Error browsing registry', { error });
            return KernelController.createErrorResponse('Failed to browse registry', 500);
        }
    }

    // ========================================
    // LISTINGS (Monetization)
    // ========================================

    /**
     * POST /api/kernel/listings - Create a listing
     */
    static async createListing(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                item_type: string;
                item_id: string;
                price_cents: number | null;
                pricing_model?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { item_type, item_id, price_cents, pricing_model } = bodyResult.data!;
            if (!item_type || !item_id) {
                return KernelController.createErrorResponse('item_type and item_id are required', 400);
            }

            const listingsService = new KernelListingsService(env);
            const listing = await listingsService.createListing({
                sellerId: user.id,
                itemType: item_type as 'app' | 'component' | 'template',
                itemId: item_id,
                priceCents: price_cents,
                pricingModel: (pricing_model as 'one_time' | 'monthly' | 'usage') ?? undefined,
            });

            return KernelController.createSuccessResponse(formatListing(listing));
        } catch (error) {
            logger.error('Error creating listing', { error });
            return KernelController.createErrorResponse('Failed to create listing', 500);
        }
    }

    /**
     * GET /api/kernel/listings/:id - Get a listing
     */
    static async getListing(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const listingId = context.pathParams.id;
            if (!listingId) {
                return KernelController.createErrorResponse('Listing ID required', 400);
            }

            const listingsService = new KernelListingsService(env);
            const listing = await listingsService.getListing(listingId);

            if (!listing) {
                return KernelController.createErrorResponse('Listing not found', 404);
            }

            return KernelController.createSuccessResponse({
                ...formatListing(listing),
                seller_name: listing.sellerName ?? null,
            });
        } catch (error) {
            logger.error('Error getting listing', { error });
            return KernelController.createErrorResponse('Failed to get listing', 500);
        }
    }

    /**
     * PATCH /api/kernel/listings/:id - Update a listing (seller only)
     */
    static async updateListing(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const listingId = context.pathParams.id;
            if (!listingId) {
                return KernelController.createErrorResponse('Listing ID required', 400);
            }

            const bodyResult = await KernelController.parseJsonBody<{
                price_cents?: number | null;
                pricing_model?: string;
                active?: boolean;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const listingsService = new KernelListingsService(env);
            const updated = await listingsService.updateListing(listingId, user.id, {
                priceCents: bodyResult.data!.price_cents,
                pricingModel: bodyResult.data!.pricing_model as 'one_time' | 'monthly' | 'usage' | undefined,
                active: bodyResult.data!.active,
            });

            if (!updated) {
                return KernelController.createErrorResponse('Listing not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse(formatListing(updated));
        } catch (error) {
            logger.error('Error updating listing', { error });
            return KernelController.createErrorResponse('Failed to update listing', 500);
        }
    }

    /**
     * GET /api/kernel/listings/mine - Get seller's own listings
     */
    static async getMyListings(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const params = context.queryParams;
            const listingsService = new KernelListingsService(env);
            const result = await listingsService.getSellerListings(user.id, {
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse({
                listings: result.listings.map(formatListing),
                cursor: result.cursor,
            });
        } catch (error) {
            logger.error('Error getting my listings', { error });
            return KernelController.createErrorResponse('Failed to get listings', 500);
        }
    }

    /**
     * POST /api/kernel/listings/:id/link-app - Link listing to app in registry
     */
    static async linkListingToApp(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const listingId = context.pathParams.id;
            if (!listingId) {
                return KernelController.createErrorResponse('Listing ID required', 400);
            }

            const bodyResult = await KernelController.parseJsonBody<{ app_id: string }>(request);
            if (!bodyResult.success) return bodyResult.response!;

            const { app_id } = bodyResult.data!;
            if (!app_id) {
                return KernelController.createErrorResponse('app_id is required', 400);
            }

            const listingsService = new KernelListingsService(env);
            const linked = await listingsService.linkListingToApp(app_id, listingId, user.id);

            if (!linked) {
                return KernelController.createErrorResponse('App not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse({ linked: true });
        } catch (error) {
            logger.error('Error linking listing to app', { error });
            return KernelController.createErrorResponse('Failed to link listing', 500);
        }
    }

    // ========================================
    // PURCHASES
    // ========================================

    /**
     * POST /api/kernel/purchases/checkout - Initiate a purchase checkout
     */
    static async initiateCheckout(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                listing_id: string;
                success_url: string;
                cancel_url: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const { listing_id, success_url, cancel_url } = bodyResult.data!;
            if (!listing_id || !success_url || !cancel_url) {
                return KernelController.createErrorResponse('listing_id, success_url, and cancel_url are required', 400);
            }

            const listingsService = new KernelListingsService(env);
            const listing = await listingsService.getListing(listing_id);
            if (!listing || !listing.active) {
                return KernelController.createErrorResponse('Listing not found or inactive', 404);
            }

            // Check if already purchased
            const alreadyPurchased = await listingsService.hasActivePurchase(user.id, listing_id);
            if (alreadyPurchased) {
                return KernelController.createErrorResponse('Already purchased', 400);
            }

            // Free listings: record purchase directly
            if (!listing.priceCents || listing.priceCents === 0) {
                const purchase = await listingsService.recordPurchase({
                    buyerId: user.id,
                    listingId: listing_id,
                    amountCents: 0,
                    platformFeeCents: 0,
                });
                return KernelController.createSuccessResponse({
                    purchase_id: purchase.purchaseId,
                    free: true,
                });
            }

            // Paid listing: create checkout via payment provider
            const platformFeePercent = parseInt(env.PLATFORM_FEE_PCT ?? '10', 10);
            const platformFeeCents = Math.floor(listing.priceCents * platformFeePercent / 100);
            const paymentProvider = createPaymentProvider(env);

            // Get seller's external account
            const accountsService = new KernelPaymentAccountsService(env);
            const sellerAccount = await accountsService.getAccount(listing.sellerId);
            if (!sellerAccount) {
                return KernelController.createErrorResponse('Seller has not set up payments', 400);
            }

            const checkout = await paymentProvider.createCheckout({
                buyerId: user.id,
                sellerId: sellerAccount.externalAccountId,
                listingId: listing_id,
                amountCents: listing.priceCents,
                platformFeeCents,
                successUrl: success_url,
                cancelUrl: cancel_url,
            });

            return KernelController.createSuccessResponse({
                checkout_url: checkout.checkoutUrl,
                external_payment_id: checkout.externalPaymentId,
            });
        } catch (error) {
            logger.error('Error initiating checkout', { error });
            return KernelController.createErrorResponse('Failed to initiate checkout', 500);
        }
    }

    /**
     * GET /api/kernel/purchases/mine - Get user's purchases
     */
    static async getMyPurchases(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const params = context.queryParams;
            const listingsService = new KernelListingsService(env);
            const result = await listingsService.getUserPurchases(user.id, {
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse({
                purchases: result.purchases.map(formatPurchase),
                cursor: result.cursor,
            });
        } catch (error) {
            logger.error('Error getting purchases', { error });
            return KernelController.createErrorResponse('Failed to get purchases', 500);
        }
    }

    /**
     * POST /api/kernel/purchases/:id/refund - Refund a purchase
     */
    static async refundPurchase(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const purchaseId = context.pathParams.id;
            if (!purchaseId) {
                return KernelController.createErrorResponse('Purchase ID required', 400);
            }

            const listingsService = new KernelListingsService(env);
            const refunded = await listingsService.refundPurchase(purchaseId, user.id);

            if (!refunded) {
                return KernelController.createErrorResponse('Purchase not found or already refunded', 404);
            }

            return KernelController.createSuccessResponse({ refunded: true });
        } catch (error) {
            logger.error('Error refunding purchase', { error });
            return KernelController.createErrorResponse('Failed to refund', 500);
        }
    }

    // ========================================
    // PAYMENTS (Seller account management)
    // ========================================

    /**
     * POST /api/kernel/payments/connect - Set up seller payment account
     */
    static async connectPayment(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const paymentProvider = createPaymentProvider(env);
            const result = await paymentProvider.createSellerAccount(user.id);

            // Save the external account ID
            const accountsService = new KernelPaymentAccountsService(env);
            const providerName = (env as Record<string, string>).PAYMENT_PROVIDER ?? 'none';
            await accountsService.saveAccount(user.id, providerName, result.accountId);

            return KernelController.createSuccessResponse({
                account_id: result.accountId,
                onboarding_url: result.onboardingUrl,
            });
        } catch (error) {
            logger.error('Error connecting payment', { error });
            return KernelController.createErrorResponse('Failed to connect payment', 500);
        }
    }

    /**
     * GET /api/kernel/payments/status - Get payment account status
     */
    static async getPaymentStatus(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const accountsService = new KernelPaymentAccountsService(env);
            const account = await accountsService.getAccount(user.id);

            if (!account) {
                return KernelController.createSuccessResponse({
                    connected: false,
                    onboarding_complete: false,
                    payout_enabled: false,
                });
            }

            // Check live status from provider if connected
            let payoutEnabled = !!account.payoutEnabled;
            let onboardingComplete = !!account.onboardingComplete;

            if (account.externalAccountId && !payoutEnabled) {
                const paymentProvider = createPaymentProvider(env);
                const ready = await paymentProvider.isSellerReady(account.externalAccountId);
                if (ready) {
                    payoutEnabled = true;
                    onboardingComplete = true;
                    await accountsService.updateStatus(user.id, {
                        onboardingComplete: true,
                        payoutEnabled: true,
                    });
                }
            }

            return KernelController.createSuccessResponse({
                connected: true,
                onboarding_complete: onboardingComplete,
                payout_enabled: payoutEnabled,
                provider: account.provider,
            });
        } catch (error) {
            logger.error('Error getting payment status', { error });
            return KernelController.createErrorResponse('Failed to get payment status', 500);
        }
    }

    /**
     * POST /api/kernel/payments/webhook - Handle payment provider webhooks
     */
    static async handleWebhook(request: Request, env: Env, _ctx: ExecutionContext, _context: RouteContext): Promise<Response> {
        try {
            const paymentProvider = createPaymentProvider(env);
            const event = await paymentProvider.verifyWebhook(request);

            switch (event.type) {
                case 'checkout.completed': {
                    if (!event.buyerId || !event.listingId) break;

                    const platformFeePercent = parseInt(env.PLATFORM_FEE_PCT ?? '10', 10);
                    const platformFeeCents = Math.floor(event.amountCents * platformFeePercent / 100);

                    const listingsService = new KernelListingsService(env);
                    await listingsService.recordPurchase({
                        buyerId: event.buyerId,
                        listingId: event.listingId,
                        externalPaymentId: event.externalId,
                        amountCents: event.amountCents,
                        platformFeeCents,
                    });

                    // Credit seller and debit platform fee in ledger
                    if (event.sellerId) {
                        const ledgerService = new KernelLedgerService(env);
                        const sellerAmount = event.amountCents - platformFeeCents;
                        await ledgerService.credit(event.sellerId, sellerAmount, 'sale', event.listingId);
                    }
                    break;
                }
                case 'refund.completed': {
                    // Refund handling done via purchase status update
                    break;
                }
                default:
                    logger.info('Unhandled payment event type', { type: event.type });
            }

            return new Response('ok', { status: 200 });
        } catch (error) {
            logger.error('Webhook processing error', { error });
            return new Response('Webhook error', { status: 400 });
        }
    }

    // ========================================
    // COMPONENTS
    // ========================================

    /**
     * POST /api/kernel/components - Register a component
     */
    static async createComponent(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const bodyResult = await KernelController.parseJsonBody<{
                name: string;
                description?: string;
                r2_bundle_key: string;
                interface?: { provides: string[]; consumes: string[] };
                source_app_id?: string;
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const data = bodyResult.data!;
            if (!data.name || !data.r2_bundle_key) {
                return KernelController.createErrorResponse('name and r2_bundle_key are required', 400);
            }

            const componentsService = new KernelComponentsService(env);
            const component = await componentsService.create({
                ownerId: user.id,
                name: data.name,
                description: data.description,
                r2BundleKey: data.r2_bundle_key,
                interfaceSpec: data.interface,
                sourceAppId: data.source_app_id,
            });

            return KernelController.createSuccessResponse(formatComponent(component));
        } catch (error) {
            logger.error('Error creating component', { error });
            return KernelController.createErrorResponse('Failed to create component', 500);
        }
    }

    /**
     * GET /api/kernel/components/:id - Get a component
     */
    static async getComponent(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const componentId = context.pathParams.id;
            if (!componentId) {
                return KernelController.createErrorResponse('Component ID required', 400);
            }

            const componentsService = new KernelComponentsService(env);
            const component = await componentsService.get(componentId);

            if (!component) {
                return KernelController.createErrorResponse('Component not found', 404);
            }

            return KernelController.createSuccessResponse({
                ...formatComponent(component),
                owner_name: component.ownerName ?? null,
            });
        } catch (error) {
            logger.error('Error getting component', { error });
            return KernelController.createErrorResponse('Failed to get component', 500);
        }
    }

    /**
     * PATCH /api/kernel/components/:id - Update a component (owner only)
     */
    static async updateComponent(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const componentId = context.pathParams.id;
            if (!componentId) {
                return KernelController.createErrorResponse('Component ID required', 400);
            }

            const bodyResult = await KernelController.parseJsonBody<{
                name?: string;
                description?: string;
                r2_bundle_key?: string;
                interface?: { provides: string[]; consumes: string[] };
            }>(request);

            if (!bodyResult.success) return bodyResult.response!;

            const data = bodyResult.data!;
            const componentsService = new KernelComponentsService(env);
            const updated = await componentsService.update(componentId, user.id, {
                name: data.name,
                description: data.description,
                r2BundleKey: data.r2_bundle_key,
                interfaceSpec: data.interface,
            });

            if (!updated) {
                return KernelController.createErrorResponse('Component not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse(formatComponent(updated));
        } catch (error) {
            logger.error('Error updating component', { error });
            return KernelController.createErrorResponse('Failed to update component', 500);
        }
    }

    /**
     * DELETE /api/kernel/components/:id - Delete a component (owner only)
     */
    static async deleteComponent(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const componentId = context.pathParams.id;
            if (!componentId) {
                return KernelController.createErrorResponse('Component ID required', 400);
            }

            const componentsService = new KernelComponentsService(env);
            const deleted = await componentsService.delete(componentId, user.id);

            if (!deleted) {
                return KernelController.createErrorResponse('Component not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse({ deleted: true });
        } catch (error) {
            logger.error('Error deleting component', { error });
            return KernelController.createErrorResponse('Failed to delete component', 500);
        }
    }

    /**
     * GET /api/kernel/components - Search components
     */
    static async searchComponents(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const params = context.queryParams;
            const componentsService = new KernelComponentsService(env);
            const result = await componentsService.search({
                query: params.get('q') ?? undefined,
                ownerId: params.get('owner') ?? undefined,
                limit: params.has('limit') ? parseInt(params.get('limit')!, 10) : undefined,
                cursor: params.get('cursor') ?? undefined,
            });

            return KernelController.createSuccessResponse({
                components: result.components.map(c => ({
                    ...formatComponent(c),
                    owner_name: c.ownerName ?? null,
                })),
                cursor: result.cursor,
            });
        } catch (error) {
            logger.error('Error searching components', { error });
            return KernelController.createErrorResponse('Failed to search components', 500);
        }
    }

    // ========================================
    // MEDIA
    // ========================================

    /**
     * POST /api/kernel/media - Upload a file
     * Accepts multipart/form-data with a 'file' field
     */
    static async uploadMedia(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const contentType = request.headers.get('Content-Type') ?? '';

            if (!contentType.includes('multipart/form-data')) {
                return KernelController.createErrorResponse('Content-Type must be multipart/form-data', 400);
            }

            const formData = await request.formData();
            const fileEntry = formData.get('file');

            if (!fileEntry || typeof fileEntry === 'string') {
                return KernelController.createErrorResponse('A file field is required', 400);
            }

            // Cast to File -- CF Workers FormData can return Blob/File for binary entries
            const file = fileEntry as unknown as File;
            const buffer = await file.arrayBuffer();
            const mediaService = new KernelMediaService(env);
            const result = await mediaService.upload(
                user.id,
                buffer,
                file.type,
                file.name || null
            );

            return KernelController.createSuccessResponse(result);
        } catch (error: unknown) {
            if (error instanceof Error && error.name === 'MediaValidationError') {
                return KernelController.createErrorResponse(error.message, 400);
            }
            logger.error('Error uploading media', { error });
            return KernelController.createErrorResponse('Failed to upload media', 500);
        }
    }

    /**
     * GET /api/kernel/media/:key+ - Serve a file from R2
     */
    static async serveMedia(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const key = context.pathParams.key;
            if (!key) {
                return KernelController.createErrorResponse('Media key required', 400);
            }

            const mediaService = new KernelMediaService(env);
            const result = await mediaService.serve(key);

            if (!result) {
                return KernelController.createErrorResponse('Media not found', 404);
            }

            return new Response(result.body, {
                headers: {
                    'Content-Type': result.contentType,
                    'Content-Length': String(result.size),
                    'Cache-Control': 'public, max-age=31536000, immutable',
                },
            });
        } catch (error) {
            logger.error('Error serving media', { error });
            return KernelController.createErrorResponse('Failed to serve media', 500);
        }
    }

    /**
     * DELETE /api/kernel/media/:key+ - Delete a file from R2 (owner only)
     */
    static async deleteMedia(request: Request, env: Env, _ctx: ExecutionContext, context: RouteContext): Promise<Response> {
        try {
            const user = context.user!;
            const key = context.pathParams.key;
            if (!key) {
                return KernelController.createErrorResponse('Media key required', 400);
            }

            const mediaService = new KernelMediaService(env);
            const deleted = await mediaService.delete(key, user.id);

            if (!deleted) {
                return KernelController.createErrorResponse('Media not found or not owned by you', 404);
            }

            return KernelController.createSuccessResponse({ deleted: true });
        } catch (error) {
            logger.error('Error deleting media', { error });
            return KernelController.createErrorResponse('Failed to delete media', 500);
        }
    }
}

// ========================================
// Response formatters
// ========================================

function formatObject(obj: {
    objectId: string;
    ownerId: string;
    objectType: string;
    payloadJson: string;
    visibility: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
}) {
    return {
        object_id: obj.objectId,
        owner_id: obj.ownerId,
        object_type: obj.objectType,
        payload: JSON.parse(obj.payloadJson),
        visibility: obj.visibility,
        parent_id: obj.parentId,
        created_at: obj.createdAt,
        updated_at: obj.updatedAt,
    };
}

function formatListing(listing: {
    listingId: string;
    sellerId: string;
    itemType: string;
    itemId: string;
    priceCents: number | null;
    pricingModel: string;
    active: number | null;
    createdAt: number;
}) {
    return {
        listing_id: listing.listingId,
        seller_id: listing.sellerId,
        item_type: listing.itemType,
        item_id: listing.itemId,
        price_cents: listing.priceCents,
        pricing_model: listing.pricingModel,
        active: !!listing.active,
        created_at: listing.createdAt,
    };
}

function formatPurchase(purchase: {
    purchaseId: string;
    buyerId: string;
    listingId: string;
    externalPaymentId: string | null;
    amountCents: number;
    platformFeeCents: number;
    status: string;
    purchasedAt: number;
}) {
    return {
        purchase_id: purchase.purchaseId,
        buyer_id: purchase.buyerId,
        listing_id: purchase.listingId,
        amount_cents: purchase.amountCents,
        platform_fee_cents: purchase.platformFeeCents,
        status: purchase.status,
        purchased_at: purchase.purchasedAt,
    };
}

function formatComponent(component: {
    componentId: string;
    ownerId: string;
    name: string;
    description: string | null;
    r2BundleKey: string;
    interfaceJson: string | null;
    sourceAppId: string | null;
    listingId: string | null;
    createdAt: number;
    updatedAt: number;
}) {
    return {
        component_id: component.componentId,
        owner_id: component.ownerId,
        name: component.name,
        description: component.description,
        r2_bundle_key: component.r2BundleKey,
        interface: component.interfaceJson ? JSON.parse(component.interfaceJson) : null,
        source_app_id: component.sourceAppId,
        listing_id: component.listingId,
        created_at: component.createdAt,
        updated_at: component.updatedAt,
    };
}
