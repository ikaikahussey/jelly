/**
 * @jllly/platform - Auth module
 * Reads user context from X-Jllly-User header (injected by dispatch middleware).
 */

import type { User } from './types';

export class AuthClient {
    private cachedUser: User | null | undefined = undefined;

    /**
     * Get the current user, or null if unauthenticated.
     */
    async getUser(): Promise<User | null> {
        if (this.cachedUser !== undefined) return this.cachedUser;

        const res = await fetch('/api/kernel/auth/me', {
            credentials: 'include',
        });

        if (!res.ok) {
            this.cachedUser = null;
            return null;
        }

        const body = await res.json() as { success: boolean; data?: User };
        this.cachedUser = body.data ?? null;
        return this.cachedUser;
    }

    /**
     * Get the current user, or redirect to login if unauthenticated.
     */
    async requireUser(): Promise<User> {
        const user = await this.getUser();
        if (!user) {
            const returnUrl = encodeURIComponent(window.location.href);
            window.location.href = `/login?return=${returnUrl}`;
            // This promise will never resolve since we're navigating away
            return new Promise(() => {});
        }
        return user;
    }
}
