/**
 * @jelly/platform - Marketplace module
 * Listings, purchases, and component discovery for generated apps.
 */

export interface Listing {
    listing_id: string;
    seller_id: string;
    item_type: string;
    item_id: string;
    price_cents: number | null;
    pricing_model: string;
    active: boolean;
    created_at: number;
    seller_name?: string | null;
}

export interface Purchase {
    purchase_id: string;
    buyer_id: string;
    listing_id: string;
    amount_cents: number;
    platform_fee_cents: number;
    status: string;
    purchased_at: number;
}

export interface Component {
    component_id: string;
    owner_id: string;
    name: string;
    description: string | null;
    interface: { provides: string[]; consumes: string[] } | null;
    source_app_id: string | null;
    listing_id: string | null;
    created_at: number;
    updated_at: number;
    owner_name?: string | null;
}

export class MarketplaceClient {
    /**
     * Get a listing by ID
     */
    async getListing(listingId: string): Promise<Listing> {
        const res = await fetch(`/api/kernel/listings/${listingId}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get listing: ${res.status}`);
        const body = await res.json() as { data: Listing };
        return body.data;
    }

    /**
     * Initiate checkout for a paid listing.
     * Returns a checkout URL for free items, or purchase info for free ones.
     */
    async checkout(listingId: string, successUrl: string, cancelUrl: string): Promise<{
        checkout_url?: string;
        purchase_id?: string;
        free?: boolean;
    }> {
        const res = await fetch('/api/kernel/purchases/checkout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                listing_id: listingId,
                success_url: successUrl,
                cancel_url: cancelUrl,
            }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { message?: string };
            throw new Error(body.message ?? `Checkout failed: ${res.status}`);
        }
        const body = await res.json() as { data: {
            checkout_url?: string;
            purchase_id?: string;
            free?: boolean;
        }};
        return body.data;
    }

    /**
     * Get the current user's purchases
     */
    async myPurchases(params: { limit?: number; cursor?: string } = {}): Promise<{
        purchases: Purchase[];
        cursor?: string;
    }> {
        const searchParams = new URLSearchParams();
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);

        const res = await fetch(`/api/kernel/purchases/mine?${searchParams}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get purchases: ${res.status}`);
        const body = await res.json() as { data: { purchases: Purchase[]; cursor?: string } };
        return body.data;
    }

    /**
     * Search for reusable components
     */
    async searchComponents(params: {
        query?: string;
        owner?: string;
        limit?: number;
        cursor?: string;
    } = {}): Promise<{ components: Component[]; cursor?: string }> {
        const searchParams = new URLSearchParams();
        if (params.query) searchParams.set('q', params.query);
        if (params.owner) searchParams.set('owner', params.owner);
        if (params.limit) searchParams.set('limit', String(params.limit));
        if (params.cursor) searchParams.set('cursor', params.cursor);

        const res = await fetch(`/api/kernel/components?${searchParams}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to search components: ${res.status}`);
        const body = await res.json() as { data: { components: Component[]; cursor?: string } };
        return body.data;
    }

    /**
     * Get a component by ID
     */
    async getComponent(componentId: string): Promise<Component> {
        const res = await fetch(`/api/kernel/components/${componentId}`, {
            credentials: 'include',
        });
        if (!res.ok) throw new Error(`Failed to get component: ${res.status}`);
        const body = await res.json() as { data: Component };
        return body.data;
    }
}
