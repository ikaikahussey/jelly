/**
 * Kernel Auth - JWT minting, verification, and middleware for deployed apps.
 * Provides platform-wide identity via httpOnly cookie on the root domain.
 */

import { JWTUtils } from '../utils/jwtUtils';
import { BaseService } from '../database/services/BaseService';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import { generateId } from '../utils/idGenerator';
import { createLogger } from '../logger';

const logger = createLogger('KernelAuth');

export interface KernelJWTPayload {
    sub: string;
    email: string;
    name: string | null;
}

/**
 * Kernel Auth Service
 * Manages kernel user identity and JWT for deployed apps.
 */
export class KernelAuthService extends BaseService {

    /**
     * Ensure a kernel_users row exists for the given platform user.
     * Called during OAuth callback or login to sync identity.
     */
    async syncUser(platformUser: {
        id: string;
        email: string;
        displayName: string;
        avatarUrl?: string | null;
    }): Promise<schema.KernelUser> {
        const now = Date.now();
        const existing = await this.database
            .select()
            .from(schema.kernelUsers)
            .where(eq(schema.kernelUsers.userId, platformUser.id))
            .limit(1);

        if (existing.length > 0) {
            const [updated] = await this.database
                .update(schema.kernelUsers)
                .set({
                    email: platformUser.email,
                    displayName: platformUser.displayName,
                    updatedAt: now,
                })
                .where(eq(schema.kernelUsers.userId, platformUser.id))
                .returning();
            return updated;
        }

        const [created] = await this.database
            .insert(schema.kernelUsers)
            .values({
                userId: platformUser.id,
                email: platformUser.email,
                displayName: platformUser.displayName,
                avatarR2Key: null,
                profileJson: '{}',
                createdAt: now,
                updatedAt: now,
            })
            .returning();
        return created;
    }

    /**
     * Get kernel user by ID
     */
    async getUser(userId: string): Promise<schema.KernelUser | null> {
        const rows = await this.getReadDb()
            .select()
            .from(schema.kernelUsers)
            .where(eq(schema.kernelUsers.userId, userId))
            .limit(1);
        return rows[0] ?? null;
    }

    /**
     * Update the current user's profile fields
     */
    async updateProfile(userId: string, updates: {
        displayName?: string;
        profileJson?: string;
        avatarR2Key?: string;
    }): Promise<schema.KernelUser | null> {
        const [updated] = await this.database
            .update(schema.kernelUsers)
            .set({ ...updates, updatedAt: Date.now() })
            .where(eq(schema.kernelUsers.userId, userId))
            .returning();
        return updated ?? null;
    }
}

/**
 * Mint a kernel JWT for deployed app consumption.
 * Set as httpOnly cookie on the root domain.
 */
export async function mintKernelJWT(
    env: Env,
    user: { id: string; email: string; displayName: string }
): Promise<string> {
    const jwt = JWTUtils.getInstance(env);
    return jwt.signPayload(
        { sub: user.id, email: user.email, name: user.displayName },
        24 * 3600 // 24h
    );
}

/**
 * Verify a kernel JWT and return the payload.
 */
export async function verifyKernelJWT(
    env: Env,
    token: string
): Promise<KernelJWTPayload | null> {
    const jwt = JWTUtils.getInstance(env);
    const payload = await jwt.verifyPayload(token);
    if (!payload || !payload.sub || !payload.email) return null;
    return {
        sub: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) ?? null,
    };
}

/**
 * Auth middleware for the Workers for Platforms dispatch layer.
 * Validates the kernel JWT from the cookie and returns user context,
 * or null if unauthenticated.
 */
export async function kernelAuthMiddleware(
    request: Request,
    env: Env
): Promise<KernelJWTPayload | null> {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = parseCookies(cookieHeader);
    const token = cookies['jelly_session'];
    if (!token) return null;

    return verifyKernelJWT(env, token);
}

function parseCookies(header: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const pair of header.split(';')) {
        const [key, ...rest] = pair.trim().split('=');
        if (key) result[key.trim()] = rest.join('=').trim();
    }
    return result;
}
