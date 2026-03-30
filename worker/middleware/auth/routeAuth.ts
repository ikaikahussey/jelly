/**
 * Route Authentication Middleware
 */

import { createMiddleware } from 'hono/factory';
import { AuthUser } from '../../types/auth-types';
import { createLogger } from '../../logger';
import { AppService } from '../../database';
import { authMiddleware } from './auth';
import { RateLimitService } from '../../services/rate-limit/rateLimits';
import { errorResponse } from '../../api/responses';
import { Context } from 'hono';
import { AppEnv } from '../../types/appenv';
import { RateLimitExceededError } from 'shared/types/errors';
import * as Sentry from '@sentry/cloudflare';
import { getUserConfigurableSettings, getGlobalConfigurableSettings } from 'worker/config';
import { authenticateViaTicket, hasTicketParam } from './ticketAuth';
import { generateId } from '../../utils/idGenerator';

const logger = createLogger('RouteAuth');

/**
 * Authentication levels for route protection
 */
export type AuthLevel = 'public' | 'authenticated' | 'authenticated-or-anonymous' | 'owner-only' | 'owner-only-or-anonymous';

/**
 * Authentication requirement configuration
 */
export interface AuthRequirement {
    required: boolean;
    level: 'public' | 'authenticated' | 'authenticated-or-anonymous' | 'owner-only' | 'owner-only-or-anonymous';
    resourceOwnershipCheck?: (user: AuthUser, params: Record<string, string>, env: Env) => Promise<boolean>;
}

/**
 * Ticket authentication configuration
 */
export type TicketResourceType = 'agent' | 'vault';

export interface TicketAuthConfig {
    /** Type of resource this ticket authenticates */
    resourceType: TicketResourceType;
    /** Path parameter name containing the resource ID (for agent) */
    paramName?: string;
}

/**
 * Additional options for setAuthLevel middleware
 */
export interface AuthLevelOptions {
    /** Ticket-based authentication configuration */
    ticketAuth?: TicketAuthConfig;
}

/**
 * Common auth requirement configurations
 */
export const AuthConfig = {
    // Public route - no authentication required
    public: {
        required: false,
        level: 'public' as const
    },

    // Require full authentication (no anonymous users)
    authenticated: {
        required: true,
        level: 'authenticated' as const
    },

    // Allow authenticated users or create anonymous users from session token
    authenticatedOrAnonymous: {
        required: true,
        level: 'authenticated-or-anonymous' as const
    },

    // Require resource ownership (for app editing) - supports anonymous ownership via session token
    ownerOnly: {
        required: true,
        level: 'owner-only' as const,
        resourceOwnershipCheck: checkAppOwnership
    },

    // Owner-only with anonymous session token support
    ownerOnlyOrAnonymous: {
        required: true,
        level: 'owner-only-or-anonymous' as const,
        resourceOwnershipCheck: checkAppOwnership
    },

    // Public read access, but owner required for modifications
    publicReadOwnerWrite: {
        required: false
    }
} as const;

/**
 * Route authentication logic that enforces authentication requirements
 */
export async function routeAuthChecks(
    user: AuthUser | null,
    env: Env,
    requirement: AuthRequirement,
    params?: Record<string, string>
): Promise<{ success: boolean; response?: Response }> {
    try {
        // Public routes always pass
        console.log('requirement', requirement, 'for user', user);
        if (requirement.level === 'public') {
            return { success: true };
        }

        // For authenticated routes
        if (requirement.level === 'authenticated') {
            if (!user) {
                return {
                    success: false,
                    response: createAuthRequiredResponse()
                };
            }

            return { success: true };
        }

        // For authenticated-or-anonymous routes (user is always set by enforceAuthRequirement)
        if (requirement.level === 'authenticated-or-anonymous') {
            if (!user) {
                return {
                    success: false,
                    response: createAuthRequiredResponse()
                };
            }
            return { success: true };
        }

        // For owner-only-or-anonymous routes (ownership checked with session token fallback)
        if (requirement.level === 'owner-only-or-anonymous') {
            if (!user) {
                return {
                    success: false,
                    response: createAuthRequiredResponse('Account required')
                };
            }

            if (requirement.resourceOwnershipCheck) {
                if (params) {
                    const isOwner = await requirement.resourceOwnershipCheck(user, params, env);
                    return {
                        success: isOwner,
                        response: isOwner ? undefined : createForbiddenResponse('You can only access your own resources')
                    }
                }
                return {
                    success: false,
                    response: createForbiddenResponse('Invalid resource ownership')
                };
            }

            return { success: true };
        }

        // For owner-only routes
        if (requirement.level === 'owner-only') {
            if (!user) {
                return {
                    success: false,
                    response: createAuthRequiredResponse('Account required')
                };
            }

            // Check resource ownership if function provided
            if (requirement.resourceOwnershipCheck) {
                if (params) {
                    const isOwner = await requirement.resourceOwnershipCheck(user, params, env);
                    return {
                        success: isOwner,
                        response: isOwner ? undefined : createForbiddenResponse('You can only access your own resources')
                    }
                }
                return {
                    success: false,
                    response: createForbiddenResponse('Invalid resource ownership')
                };
            }

            return { success: true };
        }

        // Default fallback
        return { success: true };
    } catch (error) {
        logger.error('Error in route auth middleware', error);
        return {
            success: false,
            response: new Response(JSON.stringify({
                success: false,
                error: 'Authentication check failed'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            })
        };
    }
}

/*
 * Enforce authentication requirement
 */
export async function enforceAuthRequirement(c: Context<AppEnv>) : Promise<Response | undefined> {
    let user: AuthUser | null = c.get('user') || null;

    const requirement = c.get('authLevel') as AuthRequirement | undefined;
    const authOptions = c.get('authLevelOptions') as AuthLevelOptions | undefined;
    
    if (!requirement) {
        logger.error('No authentication level found');
        return errorResponse('No authentication level found', 500);
    }
    
    const requiresAuth = requirement.level === 'authenticated' || requirement.level === 'owner-only';
    const supportsAnonymous = requirement.level === 'authenticated-or-anonymous' || requirement.level === 'owner-only-or-anonymous';

    // Only perform auth if we need it or don't have user yet
    if (!user && (requiresAuth || supportsAnonymous)) {
        const request = c.req.raw;
        const env = c.env;
        const params = c.req.param();

        // Strategy 1: Ticket-based auth (if configured and ticket present)
        if (authOptions?.ticketAuth && hasTicketParam(request)) {
            const ticketAuth = await authenticateViaTicket(request, env, authOptions.ticketAuth, params);
            if (ticketAuth) {
                user = ticketAuth.user;
                c.set('user', user);
                c.set('sessionId', ticketAuth.sessionId);
                Sentry.setUser({ id: user.id, email: user.email });

                const config = await getUserConfigurableSettings(c.env, user.id);
                c.set('config', config);

                // Skip rate limiting for ticket auth (already rate-limited at ticket creation)
                logger.info('Authenticated via ticket', { userId: user.id, resourceType: authOptions.ticketAuth.resourceType });
            } else {
                // Ticket was provided but invalid - reject immediately
                return errorResponse('Invalid or expired ticket', 403);
            }
        }

        // Strategy 2: Standard JWT auth (header/cookie)
        if (!user) {
            const userSession = await authMiddleware(c.req.raw, c.env);
            if (userSession) {
                user = userSession.user;
                c.set('user', user);
                c.set('sessionId', userSession.sessionId);
                Sentry.setUser({ id: user.id, email: user.email });

                const config = await getUserConfigurableSettings(c.env, user.id);
                c.set('config', config);

                try {
                    await RateLimitService.enforceAuthRateLimit(c.env, config.security.rateLimit, user, c.req.raw);
                } catch (error) {
                    if (error instanceof RateLimitExceededError) {
                        return errorResponse(error, 429);
                    }
                    logger.error('Error enforcing auth rate limit', error);
                    return errorResponse('Internal server error', 500);
                }
            } else if (!supportsAnonymous) {
                // Strict auth required but no user found
                return errorResponse('Authentication required', 401);
            }
        }

        // Strategy 3: Anonymous user from session token (only for anonymous-capable routes)
        // Check header first, then query param (WebSocket connections can't send custom headers)
        if (!user && supportsAnonymous) {
            const url = new URL(request.url);
            const sessionToken = request.headers.get('X-Session-Token') || url.searchParams.get('session_token');
            if (sessionToken) {
                const anonId = `anon_${sessionToken}`;
                user = {
                    id: anonId,
                    email: `${anonId}@anonymous`,
                    displayName: 'Guest',
                    isAnonymous: true,
                };
                c.set('user', user);
                c.set('sessionId', sessionToken);

                const config = await getGlobalConfigurableSettings(c.env);
                c.set('config', config);

                logger.info('Created anonymous user from session token', { userId: anonId });
            } else {
                // No session token either - create a transient anonymous user
                const transientId = `anon_${generateId()}`;
                user = {
                    id: transientId,
                    email: `${transientId}@anonymous`,
                    displayName: 'Guest',
                    isAnonymous: true,
                };
                c.set('user', user);
                c.set('sessionId', transientId);

                const config = await getGlobalConfigurableSettings(c.env);
                c.set('config', config);

                logger.info('Created transient anonymous user', { userId: transientId });
            }
        }
    }
    
    const params = c.req.param();
    const env = c.env;
    const result = await routeAuthChecks(user, env, requirement, params);
    if (!result.success) {
        logger.warn('Authentication check failed', result.response, requirement, user);
        return result.response;
    }
}

export function setAuthLevel(requirement: AuthRequirement, options?: AuthLevelOptions) {
    return createMiddleware(async (c, next) => {
        c.set('authLevel', requirement);
        if (options) {
            c.set('authLevelOptions', options);
        }
        return await next();
    })
}

/**
 * Create standardized authentication required response
 */
function createAuthRequiredResponse(message?: string): Response {
    return new Response(JSON.stringify({
        success: false,
        error: {
            type: 'AUTHENTICATION_REQUIRED',
            message: message || 'Authentication required',
            action: 'login'
        }
    }), {
        status: 401,
        headers: {
            'Content-Type': 'application/json',
            'WWW-Authenticate': 'Bearer realm="API"'
        }
    });
}

/**
 * Create standardized forbidden response
 */
function createForbiddenResponse(message: string): Response {
    return new Response(JSON.stringify({
        success: false,
        error: {
            type: 'FORBIDDEN',
            message,
            action: 'insufficient_permissions'
        }
    }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Check if user owns an app by agent/app ID
 * For anonymous users (id starts with "anon_"), also checks session token ownership
 */
export async function checkAppOwnership(user: AuthUser, params: Record<string, string>, env: Env): Promise<boolean> {
    try {
        const agentId = params.agentId || params.id;
        if (!agentId) {
            return false;
        }

        const appService = new AppService(env);

        // For anonymous users, check ownership by session token
        if (user.isAnonymous && user.id.startsWith('anon_')) {
            const sessionToken = user.id.replace('anon_', '');
            const ownershipBySession = await appService.checkAppOwnershipBySession(agentId, sessionToken);
            if (ownershipBySession) {
                return true;
            }
        }

        const ownershipResult = await appService.checkAppOwnership(agentId, user.id);
        return ownershipResult.isOwner;
    } catch (error) {
        logger.error('Error checking app ownership', error);
        return false;
    }
}