/**
 * Kernel Middleware for Workers for Platforms dispatch layer.
 * Validates kernel JWT and injects user context into requests
 * forwarded to deployed apps via X-Jelly-User header.
 * Enforces purchase checking for paid apps.
 */

import { kernelAuthMiddleware, KernelJWTPayload } from './auth';
import { KernelAuthService } from './auth';
import { createLogger } from '../logger';

const logger = createLogger('KernelMiddleware');

/**
 * Process a request through kernel auth before dispatching to a deployed app.
 * Injects X-Jelly-User header with base64-encoded user JSON.
 * Records app access for the dashboard "Apps I Use" section.
 */
export async function injectKernelUserContext(
    request: Request,
    env: Env,
    appId: string
): Promise<Request> {
    const user = await kernelAuthMiddleware(request, env);
    if (!user) return request;

    const userJson = JSON.stringify({
        user_id: user.sub,
        email: user.email,
        display_name: user.name,
    });
    const encoded = btoa(userJson);

    const headers = new Headers(request.headers);
    headers.set('X-Jelly-User', encoded);

    // Record app access asynchronously (don't block the request)
    try {
        await recordAppAccess(env, user.sub, appId);
    } catch (e) {
        logger.debug('Failed to record app access', { error: e });
    }

    return new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        redirect: request.redirect,
    });
}

/**
 * Check if a paid app requires purchase before granting access.
 * Returns null if access is granted, or a Response to return instead.
 */
export async function checkPurchaseAccess(
    request: Request,
    env: Env,
    appId: string
): Promise<Response | null> {
    const user = await kernelAuthMiddleware(request, env);
    const db = env.DB;

    // Look up the app's listing
    const appRow = await db.prepare(
        `SELECT listing_id, owner_id FROM kernel_app_registry WHERE app_id = ?1`
    ).bind(appId).first<{ listing_id: string | null; owner_id: string }>();

    // No registry entry or no listing = free access
    if (!appRow?.listing_id) return null;

    // Check if listing is active and paid
    const listing = await db.prepare(
        `SELECT listing_id, price_cents, active FROM kernel_listings
         WHERE listing_id = ?1 AND active = 1`
    ).bind(appRow.listing_id).first<{ listing_id: string; price_cents: number | null; active: number }>();

    // Inactive listing or free = allow
    if (!listing || !listing.price_cents || listing.price_cents === 0) return null;

    // Owner always has access
    if (user && user.sub === appRow.owner_id) return null;

    // Unauthenticated user for a paid app: redirect to login
    if (!user) {
        const loginUrl = new URL(request.url);
        loginUrl.pathname = '/login';
        loginUrl.searchParams.set('return_to', request.url);
        return Response.redirect(loginUrl.toString(), 302);
    }

    // Check if user has active purchase
    const purchase = await db.prepare(
        `SELECT purchase_id FROM kernel_purchases
         WHERE buyer_id = ?1 AND listing_id = ?2 AND status = 'active'
         LIMIT 1`
    ).bind(user.sub, appRow.listing_id).first<{ purchase_id: string }>();

    if (purchase) return null;

    // No purchase: return listing page redirect
    const listingUrl = new URL(request.url);
    listingUrl.hostname = (env as Record<string, string>).ROOT_DOMAIN ?? listingUrl.hostname;
    listingUrl.pathname = `/dashboard`;
    listingUrl.searchParams.set('listing', appRow.listing_id);
    return Response.redirect(listingUrl.toString(), 302);
}

/**
 * Record that a user accessed a deployed app.
 * Upserts kernel_user_app_access, updating last_accessed_at.
 */
async function recordAppAccess(env: Env, userId: string, appId: string): Promise<void> {
    const now = Date.now();
    const db = env.DB;
    await db.prepare(
        `INSERT INTO kernel_user_app_access (user_id, app_id, role, pinned, first_accessed_at, last_accessed_at)
         VALUES (?1, ?2, 'user', 0, ?3, ?3)
         ON CONFLICT(user_id, app_id) DO UPDATE SET last_accessed_at = ?3`
    ).bind(userId, appId, now).run();
}
